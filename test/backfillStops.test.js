import { test } from "node:test";
import assert from "node:assert/strict";

import { findStopChats, buildBackfillPlan, backfillStops } from "../handlers/backfillStops.js";
import { ACTIVE, STOPPED } from "../handlers/followup.js";

const MESSAGES = [
  { chat_id: "A", platform: "whatsapp", content: "Здравствуйте, что предлагаете?", created_at: "2026-01-01T10:00:00Z" },
  { chat_id: "B", platform: "whatsapp", content: "Не пишите мне больше", created_at: "2026-01-02T10:00:00Z" },
  { chat_id: "A", platform: "whatsapp", content: "Спасибо, не интересно", created_at: "2026-01-03T10:00:00Z" },
  { chat_id: "A", platform: "whatsapp", content: "И вообще отпишите меня", created_at: "2026-01-04T10:00:00Z" },
  { chat_id: "C", platform: "whatsapp", content: "Сколько стоит?", created_at: "2026-01-05T10:00:00Z" }
];

test("findStopChats: находит чаты с отказом, по одному разу", () => {
  const hits = findStopChats(MESSAGES);
  assert.deepEqual(hits.map(h => h.chat_id).sort(), ["A", "B"]);
});

test("findStopChats: запоминает ПЕРВЫЙ отказ чата", () => {
  const a = findStopChats(MESSAGES).find(h => h.chat_id === "A");
  assert.equal(a.text, "Спасибо, не интересно");
  assert.equal(a.at, "2026-01-03T10:00:00Z");
});

test("findStopChats: чаты без отказа не попадают", () => {
  assert.deepEqual(findStopChats([MESSAGES[0], MESSAGES[4]]), []);
});

test("findStopChats: мусорные записи не ломают проход", () => {
  const hits = findStopChats([null, {}, { chat_id: "X" }, { chat_id: "Y", content: "стоп" }]);
  assert.deepEqual(hits.map(h => h.chat_id), ["Y"]);
  assert.equal(hits[0].platform, "whatsapp");
});

test("buildBackfillPlan: активных останавливаем, остановленных не трогаем", () => {
  const states = [
    { chat_id: "A", status: ACTIVE },
    { chat_id: "B", status: STOPPED }
  ];
  const plan = buildBackfillPlan(MESSAGES, states);

  assert.deepEqual(plan.toStop.map(t => t.chat_id), ["A"]);
  assert.equal(plan.toStop[0].hadState, true);
  assert.deepEqual(plan.alreadyStopped.map(t => t.chat_id), ["B"]);
});

test("buildBackfillPlan: без строки состояния — тоже останавливаем, с пометкой", () => {
  const plan = buildBackfillPlan(MESSAGES, []);
  assert.deepEqual(plan.toStop.map(t => t.chat_id).sort(), ["A", "B"]);
  assert.ok(plan.toStop.every(t => t.hadState === false));
});

function makeDeps(states = [{ chat_id: "A", status: ACTIVE }, { chat_id: "B", status: STOPPED }]) {
  const writes = [];
  return {
    writes,
    deps: {
      readMessages: async () => MESSAGES,
      readStates: async () => states,
      upsert: async (chatId, row) => { writes.push({ chatId, ...row }); },
      now: () => new Date("2026-06-27T12:00:00.000Z"),
      log: () => {}
    }
  };
}

test("backfillStops: пробный прогон ничего не пишет", async () => {
  const { writes, deps } = makeDeps();
  const res = await backfillStops({ deps });

  assert.equal(res.dryRun, true);
  assert.deepEqual(writes, []);
  assert.deepEqual(res.targets.map(t => t.chat_id), ["A"]);
  assert.deepEqual(res.applied, []);
});

test("backfillStops: --apply проставляет stopped и гасит фоллоапы", async () => {
  const { writes, deps } = makeDeps();
  const res = await backfillStops({ dryRun: false, deps });

  assert.deepEqual(res.applied, ["A"]);
  assert.equal(writes.length, 1);
  assert.deepEqual(writes[0], {
    chatId: "A",
    platform: "whatsapp",
    status: STOPPED,
    next_followup_at: null,
    updated_at: "2026-06-27T12:00:00.000Z"
  });
});

test("backfillStops: limit ограничивает партию", async () => {
  const { writes, deps } = makeDeps([]); // ни у кого нет состояния → кандидатов двое
  const res = await backfillStops({ dryRun: false, limit: 1, deps });

  assert.equal(res.plan.toStop.length, 2);
  assert.equal(res.applied.length, 1);
  assert.equal(writes.length, 1);
});

test("backfillStops: все уже остановлены — писать нечего", async () => {
  const { writes, deps } = makeDeps([
    { chat_id: "A", status: STOPPED },
    { chat_id: "B", status: STOPPED }
  ]);
  const res = await backfillStops({ dryRun: false, deps });

  assert.deepEqual(res.applied, []);
  assert.deepEqual(writes, []);
  assert.equal(res.plan.alreadyStopped.length, 2);
});

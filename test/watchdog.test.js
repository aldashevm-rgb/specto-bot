import { test } from "node:test";
import assert from "node:assert/strict";

import { withRetry } from "../db.js";
import { isSuspicious } from "../handlers/qualify.js";
import { summarize } from "../handlers/watchdog.js";

const noWait = () => Promise.resolve();

test("withRetry: возвращает результат без повторов при успехе", async () => {
  let calls = 0;
  const r = await withRetry(async () => { calls++; return 42; }, { wait: noWait });
  assert.equal(r, 42);
  assert.equal(calls, 1);
});

test("withRetry: повторяет и в итоге добивается успеха", async () => {
  let calls = 0;
  const r = await withRetry(async () => {
    calls++;
    if (calls < 3) throw new Error("временный сбой");
    return "ok";
  }, { retries: 3, baseMs: 1, wait: noWait, onWait: () => {} });
  assert.equal(r, "ok");
  assert.equal(calls, 3);
});

test("withRetry: не повторяет, если retryOn вернул false", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(async () => { calls++; const e = new Error("400"); e.status = 400; throw e; },
      { retries: 3, wait: noWait, retryOn: (e) => e.status >= 500 }),
    /400/
  );
  assert.equal(calls, 1);
});

test("withRetry: пробрасывает ошибку после исчерпания попыток", async () => {
  let calls = 0;
  await assert.rejects(
    withRetry(async () => { calls++; throw new Error("всегда падает"); },
      { retries: 2, baseMs: 1, wait: noWait, onWait: () => {} }),
    /всегда падает/
  );
  assert.equal(calls, 3); // 1 + 2 повтора
});

test("isSuspicious: нет score → подозрительно", () => {
  assert.equal(isSuspicious({ ai_qual_score: null, ai_qual_profile: {} }), true);
});

test("isSuspicious: горячий с низким баллом → подозрительно", () => {
  assert.equal(isSuspicious({ ai_qual_score: 20, ai_qual_profile: { readiness: "горячий", summary: "x", niche: "кабель" } }), true);
});

test("isSuspicious: холодный с высоким баллом → подозрительно", () => {
  assert.equal(isSuspicious({ ai_qual_score: 80, ai_qual_profile: { readiness: "холодный", summary: "x", niche: "кабель" } }), true);
});

test("isSuspicious: пустое резюме → подозрительно", () => {
  assert.equal(isSuspicious({ ai_qual_score: 50, ai_qual_profile: { readiness: "тёплый", summary: "  ", niche: "кабель" } }), true);
});

test("isSuspicious: высокий балл при неизвестной нише → подозрительно", () => {
  assert.equal(isSuspicious({ ai_qual_score: 70, ai_qual_profile: { readiness: "горячий", summary: "ок", niche: "неизвестно" } }), true);
});

test("isSuspicious: согласованная оценка → норм", () => {
  assert.equal(isSuspicious({ ai_qual_score: 75, ai_qual_profile: { readiness: "горячий", summary: "B2B, крупный заказ", niche: "кабель" } }), false);
});

test("summarize: считает причины и статусы", () => {
  const r = summarize([
    { status: "qualified", reason: "missing" },
    { status: "qualified", reason: "stale" },
    { status: "qualified", reason: "qc" },
    { status: "ai_failed", reason: "qc" },
    { status: "no_lead" },
    { status: "no_signal", reason: "missing" }
  ]);
  assert.equal(r.healed, 3);
  assert.equal(r.missing, 1);
  assert.equal(r.stale, 1);
  assert.equal(r.qc, 1);
  assert.equal(r.failed, 1);
  assert.equal(r.noLead, 1);
  assert.equal(r.noSignal, 1);
});

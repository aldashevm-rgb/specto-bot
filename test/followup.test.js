import { test } from "node:test";
import assert from "node:assert/strict";

import {
  scheduleFollowups, stopFollowups, processDueFollowups,
  computeNextFollowupAt, FOLLOWUP_MESSAGES, ACTIVE, STOPPED
} from "../handlers/followup.js";

const CHAT = "77011234567@c.us";
const NOW = new Date("2026-06-27T12:00:00.000Z");

// Поддельное хранилище состояний вместо Supabase.
function makeStore(initial = {}) {
  const states = { ...initial };
  return {
    states,
    now: () => NOW,
    getState: async (id) => states[id] ?? null,
    upsertState: async (id, row) => { states[id] = { ...(states[id] || {}), chat_id: id, ...row }; },
    updateState: async (id, fields) => { if (states[id]) states[id] = { ...states[id], ...fields }; }
  };
}

// Env, влияющий на модуль, изолируем на время теста.
function withEnv(vars, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  return (async () => {
    try { return await fn(); }
    finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
      }
    }
  })();
}

test("scheduleFollowups: новый чат — цепочка стартует", async () => {
  const store = makeStore();
  const res = await scheduleFollowups(CHAT, "whatsapp", store);
  assert.deepEqual(res, { scheduled: true });
  assert.equal(store.states[CHAT].status, ACTIVE);
  assert.equal(store.states[CHAT].followup_step, 0);
  assert.equal(store.states[CHAT].next_followup_at, computeNextFollowupAt(0, NOW.toISOString()));
});

test("scheduleFollowups: после стопа цепочка НЕ возобновляется (регресс)", async () => {
  const store = makeStore({
    [CHAT]: { chat_id: CHAT, status: STOPPED, followup_step: 2, next_followup_at: null }
  });

  const res = await scheduleFollowups(CHAT, "whatsapp", store);

  assert.equal(res.scheduled, false);
  assert.equal(res.reason, "stopped");
  assert.equal(store.states[CHAT].status, STOPPED, "статус должен остаться stopped");
  assert.equal(store.states[CHAT].next_followup_at, null, "новых фоллоапов быть не должно");
  assert.equal(store.states[CHAT].last_user_at, NOW.toISOString());
});

test("scheduleFollowups: номер из стоп-листа не планируется", async () => {
  await withEnv({ FOLLOWUP_BLOCKLIST: "77011234567" }, async () => {
    const store = makeStore();
    const res = await scheduleFollowups(CHAT, "whatsapp", store);
    assert.equal(res.scheduled, false);
    assert.equal(res.reason, "blocklist");
    assert.deepEqual(store.states, {});
  });
});

test("scheduleFollowups: глобальный стоп FOLLOWUPS_ENABLED=0", async () => {
  await withEnv({ FOLLOWUPS_ENABLED: "0" }, async () => {
    const store = makeStore();
    const res = await scheduleFollowups(CHAT, "whatsapp", store);
    assert.equal(res.scheduled, false);
    assert.equal(res.reason, "disabled");
    assert.deepEqual(store.states, {});
  });
});

test("stopFollowups: ставит стоп и сообщает, был ли он уже", async () => {
  const store = makeStore();

  const first = await stopFollowups(CHAT, "whatsapp", store);
  assert.equal(first.alreadyStopped, false);
  assert.equal(store.states[CHAT].status, STOPPED);
  assert.equal(store.states[CHAT].next_followup_at, null);

  const second = await stopFollowups(CHAT, "whatsapp", store);
  assert.equal(second.alreadyStopped, true);
});

// --- Поллер ---

function dueRow(overrides = {}) {
  return {
    chat_id: CHAT,
    platform: "whatsapp",
    followup_step: 0,
    last_user_at: "2026-06-27T11:00:00.000Z",
    ...overrides
  };
}

function makePoller(store, rows) {
  const sent = [];
  const deps = {
    dbReady: () => true,
    getDue: async () => rows,
    getState: store.getState,
    updateState: store.updateState,
    now: () => NOW,
    log: () => {}
  };
  const send = async (chatId, text, platform) => { sent.push({ chatId, text, platform }); };
  return { sent, deps, send };
}

test("processDueFollowups: активный диалог получает фоллоап, шаг сдвигается", async () => {
  const store = makeStore({ [CHAT]: { chat_id: CHAT, status: ACTIVE, followup_step: 0 } });
  const { sent, deps, send } = makePoller(store, [dueRow()]);

  const result = await processDueFollowups(send, deps);

  assert.equal(sent.length, 1);
  assert.equal(sent[0].text, FOLLOWUP_MESSAGES[0].text);
  assert.deepEqual(result, [{ chat_id: CHAT, step: 0 }]);
  assert.equal(store.states[CHAT].followup_step, 1);
});

test("processDueFollowups: стоп после выборки — не отправляем (регресс)", async () => {
  // Строка попала в выборку как active, но клиент успел сказать «стоп».
  const store = makeStore({ [CHAT]: { chat_id: CHAT, status: STOPPED, followup_step: 0 } });
  const { sent, deps, send } = makePoller(store, [dueRow()]);

  const result = await processDueFollowups(send, deps);

  assert.deepEqual(sent, []);
  assert.deepEqual(result, []);
  assert.equal(store.states[CHAT].followup_step, 0, "шаг не должен сдвигаться");
});

test("processDueFollowups: состояние не прочиталось — не пишем", async () => {
  const store = makeStore(); // строки нет
  const { sent, deps, send } = makePoller(store, [dueRow()]);
  assert.deepEqual(await processDueFollowups(send, deps), []);
  assert.deepEqual(sent, []);
});

test("processDueFollowups: номер из стоп-листа гасится насовсем", async () => {
  await withEnv({ FOLLOWUP_BLOCKLIST: "77011234567" }, async () => {
    const store = makeStore({ [CHAT]: { chat_id: CHAT, status: ACTIVE, followup_step: 0 } });
    const { sent, deps, send } = makePoller(store, [dueRow()]);

    await processDueFollowups(send, deps);

    assert.deepEqual(sent, []);
    assert.equal(store.states[CHAT].status, STOPPED);
    assert.equal(store.states[CHAT].next_followup_at, null);
  });
});

test("processDueFollowups: глобальный стоп молчит по всем чатам", async () => {
  await withEnv({ FOLLOWUPS_ENABLED: "0" }, async () => {
    const store = makeStore({ [CHAT]: { chat_id: CHAT, status: ACTIVE, followup_step: 0 } });
    const { sent, deps, send } = makePoller(store, [dueRow()]);
    assert.deepEqual(await processDueFollowups(send, deps), []);
    assert.deepEqual(sent, []);
  });
});

test("processDueFollowups: без БД ничего не делает", async () => {
  const store = makeStore();
  const { sent, deps, send } = makePoller(store, [dueRow()]);
  assert.deepEqual(await processDueFollowups(send, { ...deps, dbReady: () => false }), []);
  assert.deepEqual(sent, []);
});

test("processDueFollowups: конец цепочки — шаг вне диапазона, сообщений нет", async () => {
  const last = FOLLOWUP_MESSAGES.length;
  const store = makeStore({ [CHAT]: { chat_id: CHAT, status: ACTIVE, followup_step: last } });
  const { sent, deps, send } = makePoller(store, [dueRow({ followup_step: last })]);

  await processDueFollowups(send, deps);

  assert.deepEqual(sent, []);
  assert.equal(store.states[CHAT].next_followup_at, null);
});

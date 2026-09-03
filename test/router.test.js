import { test } from "node:test";
import assert from "node:assert/strict";

import { handleMessage } from "../handlers/router.js";

const CHAT = "77011234567@c.us";

// Полностью поддельные зависимости: ни сети, ни БД.
function makeDeps(overrides = {}) {
  const calls = { sent: [], saved: [], leads: [], scheduled: [], stopped: [] };
  const deps = {
    send: async (chatId, text) => { calls.sent.push({ chatId, text }); },
    ask: async () => "Ответ Алины",
    save: async (chatId, platform, role, content) => { calls.saved.push({ role, content }); },
    lead: async (row) => { calls.leads.push(row); },
    history: async () => [{ role: "user", content: "привет" }],
    count: async () => 1,
    schedule: async (chatId, platform) => { calls.scheduled.push(chatId); return { scheduled: true }; },
    stop: async (chatId) => { calls.stopped.push(chatId); return { alreadyStopped: false }; },
    ...overrides
  };
  return { calls, deps };
}

function withEnv(vars, fn) {
  const saved = {};
  for (const [k, v] of Object.entries(vars)) {
    saved[k] = process.env[k];
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  return (async () => {
    try { return await fn(); }
    finally {
      for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k]; else process.env[k] = v;
      }
    }
  })();
}

test("обычное сообщение: отвечаем и планируем фоллоапы", async () => {
  const { calls, deps } = makeDeps();
  const res = await handleMessage(CHAT, "Расскажите подробнее", "whatsapp", deps);

  assert.equal(res.action, "replied");
  assert.deepEqual(calls.sent.map(s => s.text), ["Ответ Алины"]);
  assert.deepEqual(calls.scheduled, [CHAT]);
  assert.deepEqual(calls.stopped, []);
});

test("«не пишите мне»: ставим стоп, прощаемся один раз, фоллоапы не планируем", async () => {
  const { calls, deps } = makeDeps();
  const res = await handleMessage(CHAT, "Не пишите мне больше, пожалуйста", "whatsapp", deps);

  assert.equal(res.action, "stopped");
  assert.deepEqual(calls.stopped, [CHAT]);
  assert.equal(calls.sent.length, 1);
  assert.deepEqual(calls.scheduled, [], "после стопа цепочку не планируем");
});

test("повторный отказ: стоп подтверждаем, но прощание не дублируем", async () => {
  const { calls, deps } = makeDeps();
  deps.stop = async (chatId) => { calls.stopped.push(chatId); return { alreadyStopped: true }; };

  const res = await handleMessage(CHAT, "Я же просил — отстаньте", "whatsapp", deps);

  assert.equal(res.action, "stopped");
  assert.equal(res.replied, false);
  assert.deepEqual(calls.sent, [], "второе прощание не отправляем");
});

test("отказ первым же сообщением: лид не заводим", async () => {
  const { calls, deps } = makeDeps({ count: async () => 0 });
  await handleMessage(CHAT, "Не интересно, отпишите меня", "whatsapp", deps);
  assert.deepEqual(calls.leads, []);
});

test("первый контакт: лид заводим", async () => {
  const { calls, deps } = makeDeps({ count: async () => 0 });
  await handleMessage(CHAT, "Здравствуйте, что у вас за услуга?", "whatsapp", deps);
  assert.equal(calls.leads.length, 1);
  assert.equal(calls.leads[0].phone, CHAT);
});

test("номер из стоп-листа: сообщение сохраняем, но бот молчит", async () => {
  await withEnv({ FOLLOWUP_BLOCKLIST: "77011234567" }, async () => {
    const { calls, deps } = makeDeps();
    const res = await handleMessage(CHAT, "Отгрузка будет во вторник", "whatsapp", deps);

    assert.equal(res.action, "blocked");
    assert.deepEqual(calls.sent, [], "поставщику бот не пишет");
    assert.deepEqual(calls.scheduled, []);
    assert.deepEqual(calls.leads, []);
    assert.equal(calls.saved.length, 1, "переписку всё равно сохраняем");
  });
});

test("Claude не ответил: шлём заглушку и планируем фоллоапы", async () => {
  const { calls, deps } = makeDeps({ ask: async () => null });
  const res = await handleMessage(CHAT, "Сколько стоит?", "whatsapp", deps);

  assert.equal(res.action, "fallback");
  assert.equal(calls.sent.length, 1);
  assert.deepEqual(calls.scheduled, [CHAT]);
});

import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeMessages } from "../handlers/aiChat.js";
import { FOLLOWUP_MESSAGES, computeNextFollowupAt } from "../handlers/followup.js";

test("normalizeMessages: первое сообщение всегда user", () => {
  const out = normalizeMessages([
    { role: "assistant", content: "привет" },
    { role: "user", content: "здравствуйте" }
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].role, "user");
});

test("normalizeMessages: склеивает подряд идущие сообщения одной роли", () => {
  const out = normalizeMessages([
    { role: "user", content: "а" },
    { role: "user", content: "б" },
    { role: "assistant", content: "ответ" }
  ]);
  assert.deepEqual(out, [
    { role: "user", content: "а\nб" },
    { role: "assistant", content: "ответ" }
  ]);
});

test("FOLLOWUP_MESSAGES: задержки строго возрастают", () => {
  for (let i = 1; i < FOLLOWUP_MESSAGES.length; i++) {
    assert.ok(FOLLOWUP_MESSAGES[i].delay > FOLLOWUP_MESSAGES[i - 1].delay);
  }
});

test("computeNextFollowupAt: считает время от последнего сообщения клиента", () => {
  const base = "2026-01-01T00:00:00.000Z";
  const next = computeNextFollowupAt(0, base);
  assert.equal(next, new Date(Date.parse(base) + FOLLOWUP_MESSAGES[0].delay).toISOString());
});

test("computeNextFollowupAt: за пределами цепочки возвращает null", () => {
  assert.equal(computeNextFollowupAt(FOLLOWUP_MESSAGES.length, "2026-01-01T00:00:00.000Z"), null);
});
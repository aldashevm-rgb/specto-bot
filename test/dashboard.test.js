import { test } from "node:test";
import assert from "node:assert/strict";

import { renderHotHtml } from "../handlers/dashboard.js";
import { isStuck } from "../handlers/watchdog.js";
import { parseQualification } from "../handlers/qualify.js";

test("renderHotHtml: выводит счётчик, балл и поля профиля", () => {
  const html = renderHotHtml([
    { name: "Игорь", phone: "7701", ai_qual_score: 82,
      ai_qual_profile: { readiness: "горячий", category: "ЖБИ", urgency: "высокая", next_step: "позвонить" } }
  ]);
  assert.match(html, /Горячие лиды \(1\)/);
  assert.match(html, /82/);
  assert.match(html, /Игорь/);
  assert.match(html, /позвонить/);
});

test("renderHotHtml: экранирует HTML в данных лида (XSS)", () => {
  const html = renderHotHtml([
    { name: "<script>alert(1)</script>", phone: "x", ai_qual_score: 50, ai_qual_profile: {} }
  ]);
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test("renderHotHtml: пустой список — валидная таблица", () => {
  const html = renderHotHtml([]);
  assert.match(html, /Горячие лиды \(0\)/);
  assert.match(html, /<\/table>/);
});

test("isStuck: клиент написал последним и давно → застрял", () => {
  const now = Date.parse("2026-06-27T14:00:00Z");
  const last = { direction: "in", created_at: "2026-06-27T08:00:00Z" }; // 6ч назад
  assert.equal(isStuck(last, { ai_qual_score: 70 }, { minHours: 4, minScore: 60, now }), true);
});

test("isStuck: менеджер ответил последним → не застрял", () => {
  const now = Date.parse("2026-06-27T14:00:00Z");
  const last = { direction: "out", created_at: "2026-06-27T08:00:00Z" };
  assert.equal(isStuck(last, { ai_qual_score: 70 }, { minHours: 4, minScore: 60, now }), false);
});

test("isStuck: ответа ждут недолго → не застрял", () => {
  const now = Date.parse("2026-06-27T14:00:00Z");
  const last = { direction: "in", created_at: "2026-06-27T13:30:00Z" }; // 30 мин
  assert.equal(isStuck(last, { ai_qual_score: 70 }, { minHours: 4, minScore: 60, now }), false);
});

test("isStuck: холодный лид → не застрял (не важен)", () => {
  const now = Date.parse("2026-06-27T14:00:00Z");
  const last = { direction: "in", created_at: "2026-06-27T08:00:00Z" };
  assert.equal(isStuck(last, { ai_qual_score: 30 }, { minHours: 4, minScore: 60, now }), false);
});

test("parseQualification: новая рубрика — category и next_step", () => {
  const q = parseQualification({
    score: 80, budget: "высокий", urgency: "высокая", niche: "кабель",
    category: "кабель", readiness: "горячий", summary: "B2B", next_step: "выставить КП"
  });
  assert.equal(q.profile.category, "кабель");
  assert.equal(q.profile.next_step, "выставить КП");
});

test("parseQualification: новые поля по умолчанию заполнены", () => {
  const q = parseQualification({ score: 50 });
  assert.equal(q.profile.category, "не определено");
  assert.equal(q.profile.next_step, "");
});

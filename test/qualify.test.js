import { test } from "node:test";
import assert from "node:assert/strict";

import {
  phoneLast10,
  buildTranscript,
  hasEnoughSignal,
  clampScore,
  parseQualification
} from "../handlers/qualify.js";

test("phoneLast10: берёт последние 10 цифр из chat_id", () => {
  assert.equal(phoneLast10("77012424492@c.us"), "7012424492");
  assert.equal(phoneLast10("87009394171"), "7009394171");
});

test("phoneLast10: мусор/короткие номера → null", () => {
  assert.equal(phoneLast10(""), null);
  assert.equal(phoneLast10(null), null);
  assert.equal(phoneLast10("123@c.us"), null);
});

test("buildTranscript: in→Клиент, out→Менеджер, пустые пропускаются", () => {
  const t = buildTranscript([
    { direction: "in", text: "Здравствуйте" },
    { direction: "out", text: "Добрый день!" },
    { direction: "in", text: "  " },
    { direction: "in", text: "Сколько стоит?" }
  ]);
  assert.equal(t, "Клиент: Здравствуйте\nМенеджер: Добрый день!\nКлиент: Сколько стоит?");
});

test("hasEnoughSignal: нужна хотя бы одна реплика клиента", () => {
  assert.equal(hasEnoughSignal([{ direction: "out", text: "Привет" }]), false);
  assert.equal(hasEnoughSignal([{ direction: "in", text: "Привет" }]), true);
  assert.equal(hasEnoughSignal([{ direction: "in", text: "   " }]), false);
});

test("clampScore: округляет и зажимает в 0..100", () => {
  assert.equal(clampScore(73.4), 73);
  assert.equal(clampScore(-5), 0);
  assert.equal(clampScore(150), 100);
  assert.equal(clampScore("не число"), null);
});

test("parseQualification: собирает score + полный профиль", () => {
  const q = parseQualification({
    score: 80,
    budget: "средний",
    urgency: "высокая",
    niche: "мебель",
    readiness: "горячий",
    summary: "Готов к встрече",
    signals: ["просил цену", "назвал сроки"]
  });
  assert.equal(q.score, 80);
  assert.equal(q.profile.niche, "мебель");
  assert.equal(q.profile.readiness, "горячий");
  assert.deepEqual(q.profile.signals, ["просил цену", "назвал сроки"]);
});

test("parseQualification: отсутствующие поля → 'неизвестно', нет score → null", () => {
  const q = parseQualification({ score: 40 });
  assert.equal(q.profile.budget, "неизвестно");
  assert.deepEqual(q.profile.signals, []);
  assert.equal(parseQualification({ budget: "высокий" }), null);
  assert.equal(parseQualification(null), null);
});

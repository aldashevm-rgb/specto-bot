import { test } from "node:test";
import assert from "node:assert/strict";

import { buildDigest, formatDigest } from "../handlers/digest.js";

const NOW = Date.parse("2026-06-27T12:00:00Z");
const hoursAgo = (h) => new Date(NOW - h * 60 * 60 * 1000).toISOString();

const LEADS = [
  { name: "Алма", ai_qual_score: 92, ai_qual_at: hoursAgo(2), assignee: "Жансая",
    ai_qual_profile: { category: "ЖБИ" } },
  { name: "Бекзат", ai_qual_score: 75, ai_qual_at: hoursAgo(10), assignee: "Ильяс",
    ai_qual_profile: { category: "кабель" } },
  { name: "Сара", ai_qual_score: 60, ai_qual_at: hoursAgo(30), assignee: "director",
    ai_qual_profile: { category: "ЖБИ" } },
  { name: "Дамир", ai_qual_score: 40, ai_qual_at: hoursAgo(50), assignee: null,
    ai_qual_profile: { category: "кабель" } },
  { name: "Ержан", ai_qual_score: 15, ai_qual_at: hoursAgo(1), assignee: "Айбек",
    ai_qual_profile: {} }
];

test("buildDigest: total/hot/new24h", () => {
  const d = buildDigest(LEADS, NOW);
  assert.equal(d.total, 5);
  assert.equal(d.hot, 3);     // score >= 60: 92, 75, 60
  assert.equal(d.new24h, 3);  // в пределах 24ч: 2ч, 10ч, 1ч
});

test("buildDigest: byCategory отсортирован по убыванию", () => {
  const d = buildDigest(LEADS, NOW);
  assert.deepEqual(d.byCategory, [
    { category: "ЖБИ", n: 2 },
    { category: "кабель", n: 2 },
    { category: "не определено", n: 1 }
  ]);
  // первый — с наибольшим n
  assert.ok(d.byCategory[0].n >= d.byCategory[1].n);
});

test("buildDigest: top — максимум 5, по убыванию score, с полями", () => {
  const d = buildDigest(LEADS, NOW);
  assert.equal(d.top.length, 5);
  assert.equal(d.top[0].name, "Алма");
  assert.equal(d.top[0].score, 92);
  assert.equal(d.top[0].category, "ЖБИ");
  assert.equal(d.top[0].assignee, "Жансая");
  const scores = d.top.map(t => t.score);
  assert.deepEqual(scores, [...scores].sort((a, b) => b - a));
});

test("buildDigest: top ограничен пятью", () => {
  const many = Array.from({ length: 8 }, (_, i) => ({
    name: `L${i}`, ai_qual_score: i * 10, ai_qual_at: hoursAgo(1),
    ai_qual_profile: { category: "x" }, assignee: "A"
  }));
  assert.equal(buildDigest(many, NOW).top.length, 5);
});

test("buildDigest: дефолты для пропущенных полей", () => {
  const d = buildDigest([{ ai_qual_at: hoursAgo(1) }], NOW);
  assert.equal(d.total, 1);
  assert.equal(d.hot, 0);
  assert.equal(d.byCategory[0].category, "не определено");
  assert.equal(d.top[0].name, "—");
  assert.equal(d.top[0].assignee, "—");
});

test("buildDigest: пустой список", () => {
  const d = buildDigest([], NOW);
  assert.deepEqual(d, { total: 0, hot: 0, new24h: 0, byCategory: [], top: [] });
});

test("formatDigest: содержит итоги, рубрики и топ", () => {
  const text = formatDigest(buildDigest(LEADS, NOW));
  assert.match(text, /Ежедневная сводка/);
  assert.match(text, /Всего квалифицировано: 5/);
  assert.match(text, /горячих \(≥60\): 3/);
  assert.match(text, /новых за 24ч: 3/);
  assert.match(text, /ЖБИ: 2/);
  assert.match(text, /Алма \(92\) — ЖБИ → Жансая/);
});

test("formatDigest: пустая сводка без секций", () => {
  const text = formatDigest(buildDigest([], NOW));
  assert.match(text, /Всего квалифицировано: 0/);
  assert.doesNotMatch(text, /По рубрикам:/);
  assert.doesNotMatch(text, /Топ-5:/);
});

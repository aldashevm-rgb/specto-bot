import { test } from "node:test";
import assert from "node:assert/strict";
import { scanValue } from "../src/core/scanner.js";

// Детерминированное «сейчас» — за 6ч до начала матча в SAMPLE, чтобы событие
// всегда было в окне независимо от реальной даты запуска тестов.
const NOW = Date.parse("2026-07-11T12:00:00Z");

// Три БК; book3 щедро оценивает исход A → лучший коэф. A выгоднее консенсуса.
const SAMPLE = [{
  id: "v1", sport_key: "soccer", commence_time: "2026-07-11T18:00:00Z",
  home_team: "A", away_team: "B",
  bookmakers: [
    { key: "b1", title: "One", markets: [{ key: "h2h", outcomes: [
      { name: "A", price: 2.0 }, { name: "Draw", price: 3.5 }, { name: "B", price: 3.5 } ] }] },
    { key: "b2", title: "Two", markets: [{ key: "h2h", outcomes: [
      { name: "A", price: 2.1 }, { name: "Draw", price: 3.4 }, { name: "B", price: 3.4 } ] }] },
    { key: "b3", title: "Three", markets: [{ key: "h2h", outcomes: [
      { name: "A", price: 2.6 }, { name: "Draw", price: 3.3 }, { name: "B", price: 3.3 } ] }] }
  ]
}];

test("scanValue: находит value (лучший коэф. выгоднее консенсуса рынка)", async () => {
  const r = await scanValue({
    sport: "soccer", markets: ["h2h"], minEdgePct: 2,
    enrichAi: false, maxHours: 0, nowMs: NOW, fetchOddsFn: async () => SAMPLE
  });
  assert.equal(r.scanned, 1);
  assert.ok(r.found >= 1);
  const v = r.values[0];
  assert.equal(v.valueBet.name, "A");           // именно A недооценён рынком
  assert.equal(v.valueBet.bookmaker, "Three");  // лучшая цена у book3
  assert.ok(v.valueBet.edgePct >= 2);
});

test("scanValue: высокий порог отсекает всё", async () => {
  const r = await scanValue({
    sport: "soccer", markets: ["h2h"], minEdgePct: 99, minEdgeSoftPct: 99,
    enrichAi: false, maxHours: 0, nowMs: NOW, fetchOddsFn: async () => SAMPLE
  });
  assert.equal(r.found, 0);
});

test("scanValue: сортировка по убыванию перевеса", async () => {
  const r = await scanValue({
    sport: "soccer", markets: ["h2h"], minEdgePct: 0, minEdgeSoftPct: 0,
    enrichAi: false, maxHours: 0, nowMs: NOW, fetchOddsFn: async () => SAMPLE
  });
  for (let i = 1; i < r.values.length; i++) {
    assert.ok(r.values[i - 1].valueBet.edgePct >= r.values[i].valueBet.edgePct);
  }
});

test("scanValue: minProb режет лонгшоты (низкая вероятность исхода)", async () => {
  // Событие с явным фаворитом и щедрым лонгшотом на аутсайдера.
  const S = [{
    id: "lp", sport_key: "soccer", commence_time: "2026-07-11T18:00:00Z",
    home_team: "Fav", away_team: "Dog",
    bookmakers: [
      { key: "p", title: "Pinnacle", markets: [{ key: "h2h", outcomes: [
        { name: "Fav", price: 1.4 }, { name: "Draw", price: 4.5 }, { name: "Dog", price: 8.0 } ] }] },
      { key: "s", title: "1xBet", markets: [{ key: "h2h", outcomes: [
        { name: "Fav", price: 1.45 }, { name: "Draw", price: 4.6 }, { name: "Dog", price: 11.0 } ] }] } // щедрый лонгшот
    ]
  }];
  // Без minProb — может флагнуть лонгшот Dog @ 11.
  const loose = await scanValue({ sport: "s", markets: ["h2h"], minEdgePct: 1, minEdgeSoftPct: 1,
    minProb: 0, maxHours: 0, nowMs: NOW, fetchOddsFn: async () => S });
  // С minProb 0.4 — лонгшот (шанс ~10%) отсекается; останется только исход с шансом ≥40% или ничего.
  const strict = await scanValue({ sport: "s", markets: ["h2h"], minEdgePct: 1, minEdgeSoftPct: 1,
    minProb: 0.4, maxHours: 0, nowMs: NOW, fetchOddsFn: async () => S });
  for (const v of strict.values) {
    assert.ok(v.valueBet.modelProb >= 40, `лонгшот не должен пройти: ${v.valueBet.name} ${v.valueBet.modelProb}%`);
  }
  // Строгий фильтр даёт не больше ставок, чем свободный.
  assert.ok(strict.found <= loose.found);
});

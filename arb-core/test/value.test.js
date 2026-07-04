import { test } from "node:test";
import assert from "node:assert/strict";
import { scanValue } from "../src/core/scanner.js";

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
    enrichAi: false, fetchOddsFn: async () => SAMPLE
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
    enrichAi: false, fetchOddsFn: async () => SAMPLE
  });
  assert.equal(r.found, 0);
});

test("scanValue: сортировка по убыванию перевеса", async () => {
  const r = await scanValue({
    sport: "soccer", markets: ["h2h"], minEdgePct: 0, minEdgeSoftPct: 0,
    enrichAi: false, fetchOddsFn: async () => SAMPLE
  });
  for (let i = 1; i < r.values.length; i++) {
    assert.ok(r.values[i - 1].valueBet.edgePct >= r.values[i].valueBet.edgePct);
  }
});

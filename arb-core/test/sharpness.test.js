import { test } from "node:test";
import assert from "node:assert/strict";
import { bookTier, bookWeight } from "../src/core/sharpness.js";
import { marketConsensus } from "../src/core/devig.js";
import { scanValue } from "../src/core/scanner.js";

test("bookTier/bookWeight: резкие конторы распознаются и весомее", () => {
  assert.equal(bookTier("Pinnacle"), "sharp");
  assert.equal(bookTier("Betfair"), "sharp");
  assert.equal(bookTier("1xBet"), "soft");
  assert.equal(bookTier("William Hill"), "soft");
  assert.ok(bookWeight("Pinnacle") > bookWeight("1xBet"));
});

test("marketConsensus: вес резкой конторы тянет консенсус к её линии", () => {
  const event = {
    home_team: "A", away_team: "B",
    bookmakers: [
      // софт: A сильный фаворит
      { key: "s1", title: "1xBet", markets: [{ key: "h2h", outcomes: [
        { name: "A", price: 1.5 }, { name: "B", price: 2.6 } ] }] },
      // резкая: почти равные
      { key: "p", title: "Pinnacle", markets: [{ key: "h2h", outcomes: [
        { name: "A", price: 2.0 }, { name: "B", price: 1.9 } ] }] }
    ]
  };
  const equal = marketConsensus(event, "h2h"); // равный вес
  const weighted = marketConsensus(event, "h2h", null, bookWeight); // вес Pinnacle выше
  // При весе Pinnacle вероятность A ближе к её линии (~0.49), т.е. НИЖЕ равного среднего.
  assert.ok(weighted.A < equal.A);
});

// Детерминированное «сейчас» — за 6ч до начала матча в SAMPLE.
const NOW = Date.parse("2026-07-11T12:00:00Z");

// Софт-контора со щедрым лонгшотом vs резкая с точной ценой.
const SAMPLE = [{
  id: "v1", sport_key: "soccer", commence_time: "2026-07-11T18:00:00Z",
  home_team: "A", away_team: "B",
  bookmakers: [
    { key: "p", title: "Pinnacle", markets: [{ key: "h2h", outcomes: [
      { name: "A", price: 1.5 }, { name: "B", price: 2.7 } ] }] },
    { key: "s", title: "1xBet", markets: [{ key: "h2h", outcomes: [
      { name: "A", price: 1.55 }, { name: "B", price: 3.2 } ] }] } // щедрый B у софта
  ]
}];

test("scanValue --sharp: отсекает value у софт-контор", async () => {
  const all = await scanValue({ sport: "soccer", markets: ["h2h"], minEdgePct: 1, minEdgeSoftPct: 1,
    enrichAi: false, maxHours: 0, nowMs: NOW, fetchOddsFn: async () => SAMPLE });
  const sharp = await scanValue({ sport: "soccer", markets: ["h2h"], minEdgePct: 1, minEdgeSoftPct: 1,
    sharpOnly: true, enrichAi: false, maxHours: 0, nowMs: NOW, fetchOddsFn: async () => SAMPLE });
  // В общем скане value у софта (1xBet, B@3.2) присутствует; в --sharp — нет.
  assert.ok(all.values.some(v => v.valueBet.tier === "soft"));
  assert.ok(sharp.values.every(v => v.valueBet.tier === "sharp"));
});

test("scanValue: у софт-контор порог выше (тот же перевес отсекается)", async () => {
  const soft = await scanValue({ sport: "soccer", markets: ["h2h"], minEdgePct: 1, minEdgeSoftPct: 50,
    enrichAi: false, maxHours: 0, nowMs: NOW, fetchOddsFn: async () => SAMPLE });
  // Порог для софта 50% — щедрый B у 1xBet не проходит.
  assert.ok(soft.values.every(v => v.valueBet.tier !== "soft"));
});

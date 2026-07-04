import { test } from "node:test";
import assert from "node:assert/strict";
import { bestOutcomes, normalizeEvents } from "../src/core/normalize.js";

// Мини-фикстура в формате The Odds API: 2 БК с разными коэффициентами.
const event = {
  id: "ev1",
  sport_key: "soccer_epl",
  commence_time: "2026-07-10T18:00:00Z",
  home_team: "Arsenal",
  away_team: "Chelsea",
  bookmakers: [
    {
      key: "bk1", title: "BookOne",
      markets: [{ key: "h2h", outcomes: [
        { name: "Arsenal", price: 2.1 },
        { name: "Draw", price: 3.4 },
        { name: "Chelsea", price: 3.2 }
      ] }]
    },
    {
      key: "bk2", title: "BookTwo",
      markets: [{ key: "h2h", outcomes: [
        { name: "Arsenal", price: 2.0 },
        { name: "Draw", price: 3.6 },   // лучше, чем у BookOne
        { name: "Chelsea", price: 3.5 } // лучше, чем у BookOne
      ] }]
    }
  ]
};

test("bestOutcomes: берёт максимальный коэффициент по каждому исходу", () => {
  const n = bestOutcomes(event, "h2h");
  assert.equal(n.home, "Arsenal");
  assert.equal(n.away, "Chelsea");
  const byName = Object.fromEntries(n.bestOutcomes.map(o => [o.name, o]));
  assert.equal(byName["Arsenal"].odds, 2.1);
  assert.equal(byName["Arsenal"].bookmaker, "BookOne");
  assert.equal(byName["Draw"].odds, 3.6);
  assert.equal(byName["Draw"].bookmaker, "BookTwo");
  assert.equal(byName["Chelsea"].odds, 3.5);
  assert.equal(byName["Chelsea"].bookmaker, "BookTwo");
});

test("bestOutcomes: null если рынка нет или мало исходов", () => {
  assert.equal(bestOutcomes({ bookmakers: [] }, "h2h"), null);
  assert.equal(bestOutcomes(null, "h2h"), null);
  const oneOutcome = { bookmakers: [{ key: "b", title: "B", markets: [{ key: "h2h", outcomes: [{ name: "A", price: 2 }] }] }] };
  assert.equal(bestOutcomes(oneOutcome, "h2h"), null);
});

test("bestOutcomes: игнорирует некорректные коэффициенты", () => {
  const bad = {
    id: "x", home_team: "A", away_team: "B",
    bookmakers: [{ key: "b", title: "B", markets: [{ key: "h2h", outcomes: [
      { name: "A", price: 2.0 }, { name: "B", price: 1.0 } // 1.0 невалиден
    ] }] }]
  };
  assert.equal(bestOutcomes(bad, "h2h"), null); // остаётся 1 валидный исход
});

test("normalizeEvents: пропускает неполные события", () => {
  const res = normalizeEvents([event, { bookmakers: [] }], "h2h");
  assert.equal(res.length, 1);
  assert.equal(res[0].id, "ev1");
});

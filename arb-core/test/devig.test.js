import { test } from "node:test";
import assert from "node:assert/strict";
import { noVig, noVigByName, overroundPct, marketConsensus } from "../src/core/devig.js";

test("noVig: снимает маржу, сумма вероятностей = 1", () => {
  const p = noVig([1.9, 1.9]); // overround ~5.26%
  assert.ok(Math.abs(p[0] + p[1] - 1) < 1e-9);
  assert.ok(Math.abs(p[0] - 0.5) < 1e-9);
});

test("noVig: неравные коэффициенты → неравные вероятности, сумма 1", () => {
  const p = noVig([1.5, 3.0]);
  assert.ok(Math.abs(p[0] + p[1] - 1) < 1e-9);
  assert.ok(p[0] > p[1]); // фаворит с меньшим коэф. — выше вероятность
});

test("noVig: мусор → null", () => {
  assert.equal(noVig([2]), null);       // < 2 исходов
  assert.equal(noVig([2, 0]), null);
  assert.equal(noVig([2, "x"]), null);
});

test("overroundPct: маржа рынка в процентах", () => {
  assert.equal(overroundPct([2, 2]), 0);          // честный рынок
  assert.ok(overroundPct([1.9, 1.9]) > 5);        // ~5.26%
});

test("noVigByName: вероятности по именам исходов", () => {
  const m = noVigByName([{ name: "A", odds: 1.5 }, { name: "B", odds: 3.0 }]);
  assert.ok(Math.abs(m.A + m.B - 1) < 1e-9);
  assert.ok(m.A > m.B);
});

test("marketConsensus: усредняет честные вероятности по всем БК", () => {
  const event = {
    home_team: "A", away_team: "B",
    bookmakers: [
      { key: "b1", markets: [{ key: "h2h", outcomes: [
        { name: "A", price: 2.0 }, { name: "Draw", price: 3.4 }, { name: "B", price: 3.8 }
      ] }] },
      { key: "b2", markets: [{ key: "h2h", outcomes: [
        { name: "A", price: 2.1 }, { name: "Draw", price: 3.3 }, { name: "B", price: 3.6 }
      ] }] }
    ]
  };
  const c = marketConsensus(event, "h2h");
  const sum = c.A + c.Draw + c.B;
  assert.ok(Math.abs(sum - 1) < 1e-9);
  assert.ok(c.A > c.B); // A фаворит
});

test("marketConsensus: null если нет полного рынка", () => {
  assert.equal(marketConsensus({ bookmakers: [] }, "h2h"), null);
  assert.equal(marketConsensus(null, "h2h"), null);
});

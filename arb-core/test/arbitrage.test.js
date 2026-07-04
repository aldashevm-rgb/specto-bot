import { test } from "node:test";
import assert from "node:assert/strict";
import {
  impliedProbability,
  computeArbitrage,
  stakeDistribution,
  findSurebets
} from "../src/core/arbitrage.js";

test("impliedProbability: 1/odds, мусор → null", () => {
  assert.equal(impliedProbability(2), 0.5);
  assert.equal(impliedProbability(4), 0.25);
  assert.equal(impliedProbability(1), null);   // коэф. должен быть > 1
  assert.equal(impliedProbability(0), null);
  assert.equal(impliedProbability("х"), null);
});

test("computeArbitrage: находит вилку когда Σ(1/odds) < 1", () => {
  // 2.10 и 2.10: сумма = 0.952 < 1 → вилка
  const r = computeArbitrage([{ odds: 2.1 }, { odds: 2.1 }]);
  assert.equal(r.valid, true);
  assert.equal(r.isArb, true);
  assert.ok(r.marginPct > 0);
});

test("computeArbitrage: нет вилки при марже букмекера", () => {
  // 1.90 и 1.90: сумма = 1.0526 > 1 → не вилка
  const r = computeArbitrage([{ odds: 1.9 }, { odds: 1.9 }]);
  assert.equal(r.isArb, false);
  assert.ok(r.marginPct < 0);
});

test("computeArbitrage: валидация входа", () => {
  assert.equal(computeArbitrage([]).valid, false);
  assert.equal(computeArbitrage([{ odds: 2 }]).valid, false); // < 2 исходов
  assert.equal(computeArbitrage([{ odds: 2 }, { odds: 1 }]).valid, false); // плохой коэф.
});

test("stakeDistribution: равная выплата по всем исходам и профит > 0", () => {
  const d = stakeDistribution([{ name: "A", odds: 2.1 }, { name: "B", odds: 2.1 }], 1000);
  assert.equal(d.valid, true);
  assert.equal(d.isArb, true);
  // Выплаты по исходам равны (с точностью до копеек).
  const payouts = d.legs.map(l => l.payout);
  assert.ok(Math.abs(payouts[0] - payouts[1]) <= 0.02);
  // Вложили ~1000, гарантированная выплата больше — есть профит.
  assert.ok(d.invested <= 1000.5);
  assert.ok(d.profit > 0);
});

test("stakeDistribution: 3 исхода (1X2)", () => {
  const d = stakeDistribution(
    [{ name: "1", odds: 3.4 }, { name: "X", odds: 3.6 }, { name: "2", odds: 3.5 }],
    900
  );
  assert.equal(d.valid, true);
  assert.equal(d.isArb, true); // 1/3.4+1/3.6+1/3.5 ≈ 0.863 < 1
  assert.equal(d.legs.length, 3);
});

test("findSurebets: фильтрует по минимальной марже и сортирует по убыванию", () => {
  const events = [
    { id: "big", home: "A", away: "B", bestOutcomes: [{ name: "A", odds: 2.3 }, { name: "B", odds: 2.3 }] },
    { id: "none", home: "C", away: "D", bestOutcomes: [{ name: "C", odds: 1.8 }, { name: "D", odds: 1.8 }] },
    { id: "small", home: "E", away: "F", bestOutcomes: [{ name: "E", odds: 2.02 }, { name: "F", odds: 2.02 }] }
  ];
  const res = findSurebets(events, { minMarginPct: 0.5, totalStake: 1000 });
  const ids = res.map(r => r.id);
  assert.ok(ids.includes("big"));
  assert.ok(!ids.includes("none")); // не вилка
  // Отсортировано по убыванию маржи — "big" впереди "small".
  assert.equal(res[0].id, "big");
  for (let i = 1; i < res.length; i++) {
    assert.ok(res[i - 1].arb.marginPct >= res[i].arb.marginPct);
  }
});

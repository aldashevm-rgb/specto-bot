import { test } from "node:test";
import assert from "node:assert/strict";
import { kellyFraction, kellyStake } from "../src/core/kelly.js";

test("kellyFraction: f = (p·odds−1)/(odds−1)", () => {
  // p=0.6, odds=2.0 → (1.2−1)/1 = 0.2
  assert.ok(Math.abs(kellyFraction(0.6, 2.0) - 0.2) < 1e-9);
  // p=0.55, odds=2.0 → 0.1
  assert.ok(Math.abs(kellyFraction(0.55, 2.0) - 0.1) < 1e-9);
});

test("kellyFraction: нет эджа или мусор → 0", () => {
  assert.equal(kellyFraction(0.5, 2.0), 0);   // ровно на грани
  assert.equal(kellyFraction(0.4, 2.0), 0);   // отрицательный эдж
  assert.equal(kellyFraction(0.6, 1.0), 0);   // коэф. без прибыли
  assert.equal(kellyFraction(1.5, 2.0), 0);   // p вне [0,1]
});

test("kellyStake: дробный Кельли от банка", () => {
  // full Kelly 0.2, четверть → 0.05, банк 1000 → 50
  const k = kellyStake(0.6, 2.0, { bankroll: 1000, fraction: 0.25, maxFraction: 1 });
  assert.ok(Math.abs(k.fullKelly - 0.2) < 1e-9);
  assert.ok(Math.abs(k.fractionOfBank - 0.05) < 1e-9);
  assert.equal(k.stake, 50);
});

test("kellyStake: потолок ограничивает долю банка", () => {
  // full Kelly высокий, но потолок 5% → доля = 0.05
  const k = kellyStake(0.8, 3.0, { bankroll: 1000, fraction: 1, maxFraction: 0.05 });
  assert.equal(k.fractionOfBank, 0.05);
  assert.equal(k.stake, 50);
});

test("kellyStake: нет эджа → ставка 0", () => {
  const k = kellyStake(0.45, 2.0, { bankroll: 1000 });
  assert.equal(k.stake, 0);
  assert.equal(k.fractionOfBank, 0);
});

test("kellyStake: минимум суммы поднимает мелкие ставки", () => {
  // Кельли дал бы копейки (маленький банк) → поднимаем до минимума.
  const k = kellyStake(0.55, 2.0, { bankroll: 1000, fraction: 0.25, maxFraction: 0.05, minStake: 5000 });
  assert.equal(k.stake, 5000);
});

test("kellyStake: максимум суммы ограничивает крупные ставки", () => {
  const k = kellyStake(0.6, 2.0, { bankroll: 1000000, fraction: 0.25, maxFraction: 1, maxStake: 10000 });
  assert.equal(k.stake, 10000);
});

test("kellyStake: нет эджа → 0, минимум не форсим", () => {
  const k = kellyStake(0.4, 2.0, { bankroll: 1000, minStake: 5000 });
  assert.equal(k.stake, 0);
});

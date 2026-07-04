import { test } from "node:test";
import assert from "node:assert/strict";
import { blendProbs, agreement, brierScore, logLoss } from "../src/core/blend.js";

test("blendProbs: взвешенное усреднение, сумма 1", () => {
  const b = blendProbs([
    { probs: { A: 0.6, B: 0.4 }, weight: 0.5 },
    { probs: { A: 0.4, B: 0.6 }, weight: 0.5 }
  ]);
  assert.ok(Math.abs(b.A + b.B - 1) < 1e-9);
  assert.ok(Math.abs(b.A - 0.5) < 1e-9); // равные веса → среднее
});

test("blendProbs: вес смещает результат", () => {
  const b = blendProbs([
    { probs: { A: 0.8, B: 0.2 }, weight: 0.75 },
    { probs: { A: 0.2, B: 0.8 }, weight: 0.25 }
  ]);
  assert.ok(b.A > 0.6); // ближе к источнику с большим весом
});

test("blendProbs: игнорирует нулевой вес и пустые источники", () => {
  const b = blendProbs([
    { probs: { A: 0.7, B: 0.3 }, weight: 1 },
    { probs: { A: 0.1, B: 0.9 }, weight: 0 },
    null
  ]);
  assert.ok(Math.abs(b.A - 0.7) < 1e-9);
});

test("blendProbs: нет валидных источников → null", () => {
  assert.equal(blendProbs([]), null);
  assert.equal(blendProbs([{ probs: null, weight: 1 }]), null);
});

test("agreement: одинаковые источники → ~1, противоположные → ниже", () => {
  const same = [
    { probs: { A: 0.6, B: 0.4 }, weight: 1 },
    { probs: { A: 0.6, B: 0.4 }, weight: 1 }
  ];
  const blendedSame = blendProbs(same);
  assert.ok(agreement(same, blendedSame) > 0.99);

  const diff = [
    { probs: { A: 0.9, B: 0.1 }, weight: 1 },
    { probs: { A: 0.1, B: 0.9 }, weight: 1 }
  ];
  // Расходящиеся источники дают согласие ниже, чем совпадающие (~1).
  assert.ok(agreement(diff, blendProbs(diff)) < agreement(same, blendedSame));
  assert.ok(agreement(diff, blendProbs(diff)) < 0.7);
});

test("brierScore: точный прогноз близок к 0, неверный — велик", () => {
  assert.ok(brierScore({ A: 1, B: 0 }, "A") < 1e-6);
  assert.ok(brierScore({ A: 0, B: 1 }, "A") > 1.9);
  // калиброванный 0.5/0.5 → 0.5
  assert.ok(Math.abs(brierScore({ A: 0.5, B: 0.5 }, "A") - 0.5) < 1e-6);
});

test("logLoss: уверенный верный → ~0, уверенный неверный → большой", () => {
  assert.ok(logLoss({ A: 0.99, B: 0.01 }, "A") < 0.02);
  assert.ok(logLoss({ A: 0.01, B: 0.99 }, "A") > 4);
});

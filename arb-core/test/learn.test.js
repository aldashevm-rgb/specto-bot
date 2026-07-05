import { test } from "node:test";
import assert from "node:assert/strict";
import { learnWeights } from "../src/core/learn.js";

// Источник "good" всегда близок к истине, "bad" — мимо. Winner = "A".
function rec(goodA, badA) {
  return {
    winner: "A",
    source_probs: {
      good: { A: goodA, B: 1 - goodA },
      bad: { A: badA, B: 1 - badA }
    }
  };
}

test("learnWeights: точный источник получает больший вес", () => {
  const graded = Array.from({ length: 30 }, () => rec(0.8, 0.2)); // good угадывает, bad мимо
  const r = learnWeights(graded, { minSamples: 20 });
  assert.ok(r, "должно хватить данных");
  assert.ok(r.weights.good > r.weights.bad, "точный источник — больший вес");
  assert.ok(r.brier.good < r.brier.bad, "у точного меньше Brier");
  assert.ok(Math.abs(r.weights.good + r.weights.bad - 1) < 1e-6, "веса нормированы");
});

test("learnWeights: мало данных → null (не учимся на шуме)", () => {
  const graded = Array.from({ length: 5 }, () => rec(0.8, 0.2));
  assert.equal(learnWeights(graded, { minSamples: 20 }), null);
});

test("learnWeights: нет source_probs/winner → пропуск", () => {
  const graded = [{ winner: "A" }, { source_probs: {} }];
  assert.equal(learnWeights(graded, { minSamples: 1 }), null);
});

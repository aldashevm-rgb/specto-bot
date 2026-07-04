import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeProbs, parseMatchRead, valueEdges } from "../src/core/motivation.js";

test("normalizeProbs: приводит проценты к сумме 1", () => {
  const p = normalizeProbs({ prob_home: 50, prob_draw: 30, prob_away: 20 });
  assert.ok(Math.abs(p.home + p.draw + p.away - 1) < 1e-9);
  assert.ok(Math.abs(p.home - 0.5) < 1e-9);
});

test("normalizeProbs: нормирует даже если сумма != 100", () => {
  const p = normalizeProbs({ prob_home: 60, prob_draw: 60, prob_away: 60 });
  assert.ok(Math.abs(p.home - 1 / 3) < 1e-9);
});

test("normalizeProbs: нули → null", () => {
  assert.equal(normalizeProbs({ prob_home: 0, prob_draw: 0, prob_away: 0 }), null);
});

test("parseMatchRead: собирает разбор из tool-input", () => {
  const r = parseMatchRead({
    needs_win: "home", likely_outcome: "home",
    prob_home: 55, prob_draw: 25, prob_away: 20,
    confidence: 70, reasoning: "хозяева борются за топ-4"
  });
  assert.equal(r.needsWin, "home");
  assert.equal(r.likelyOutcome, "home");
  assert.equal(r.confidence, 70);
  assert.ok(Math.abs(r.probs.home - 0.55) < 1e-9);
});

test("parseMatchRead: мусор → null, confidence зажимается в 0..100", () => {
  assert.equal(parseMatchRead(null), null);
  const r = parseMatchRead({ prob_home: 40, prob_draw: 30, prob_away: 30, confidence: 999 });
  assert.equal(r.confidence, 100);
});

test("valueEdges: считает перевес p*odds-1 и сортирует по убыванию", () => {
  const probs = { home: 0.5, draw: 0.25, away: 0.25 };
  const outcomes = [
    { name: "Arsenal", odds: 2.5 },  // 0.5*2.5-1 = +0.25 → +25%
    { name: "Draw", odds: 3.0 },     // 0.25*3-1 = -0.25 → -25%
    { name: "Chelsea", odds: 4.5 }   // 0.25*4.5-1 = +0.125 → +12.5%
  ];
  const edges = valueEdges({ home: "Arsenal", away: "Chelsea" }, probs, outcomes);
  assert.equal(edges[0].name, "Arsenal");
  assert.equal(edges[0].edgePct, 25);
  // Отсортировано по убыванию перевеса.
  for (let i = 1; i < edges.length; i++) {
    assert.ok(edges[i - 1].edgePct >= edges[i].edgePct);
  }
});

test("valueEdges: пустой при отсутствии вероятностей", () => {
  assert.deepEqual(valueEdges({ home: "A", away: "B" }, null, []), []);
});

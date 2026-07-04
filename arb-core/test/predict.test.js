import { test } from "node:test";
import assert from "node:assert/strict";
import { computeEdges, buildPrediction, hdaToNamed, ouToNamed } from "../src/core/predict.js";

test("computeEdges: edge = p·odds − 1, сортировка по убыванию", () => {
  const edges = computeEdges(
    { Arsenal: 0.5, Draw: 0.25, Chelsea: 0.25 },
    [{ name: "Arsenal", odds: 2.5 }, { name: "Draw", odds: 3.0 }, { name: "Chelsea", odds: 4.5 }]
  );
  assert.equal(edges[0].name, "Arsenal");
  assert.equal(edges[0].edgePct, 25);      // 0.5*2.5-1
  for (let i = 1; i < edges.length; i++) {
    assert.ok(edges[i - 1].edgePct >= edges[i].edgePct);
  }
});

test("buildPrediction: смешивает источники и находит лучший value", () => {
  const pred = buildPrediction({
    sources: [
      { label: "consensus", probs: { A: 0.55, B: 0.45 }, weight: 0.5 },
      { label: "model", probs: { A: 0.5, B: 0.5 }, weight: 0.3 },
      { label: "ai", probs: { A: 0.6, B: 0.4 }, weight: 0.2 }
    ],
    bestOutcomes: [{ name: "A", odds: 2.0 }, { name: "B", odds: 2.0 }]
  });
  assert.ok(Math.abs(pred.probs.A + pred.probs.B - 1) < 1e-9);
  assert.deepEqual(pred.sources, ["consensus", "model", "ai"]);
  assert.ok(pred.top.name === "A"); // A выше по вероятности → выше edge
  assert.ok(pred.agreement > 0.5);
});

test("buildPrediction: null если нет источников", () => {
  assert.equal(buildPrediction({ sources: [], bestOutcomes: [] }), null);
});

test("hdaToNamed / ouToNamed: маппинг в имена исходов", () => {
  const h = hdaToNamed({ home: 0.5, draw: 0.3, away: 0.2 }, "Arsenal", "Chelsea");
  assert.equal(h["Arsenal"], 0.5);
  assert.equal(h["Draw"], 0.3);
  assert.equal(h["Chelsea"], 0.2);

  const o = ouToNamed({ over: 0.6, under: 0.4 });
  assert.equal(o.Over, 0.6);
  assert.equal(o.Under, 0.4);
});

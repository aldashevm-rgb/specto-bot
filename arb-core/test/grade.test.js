import { test } from "node:test";
import assert from "node:assert/strict";
import { winnerName, gradePrediction, buildGradePatch } from "../src/store/grade.js";

test("winnerName: исход → имя (для h2h probs по именам)", () => {
  assert.equal(winnerName("home", "Arsenal", "Chelsea"), "Arsenal");
  assert.equal(winnerName("away", "Arsenal", "Chelsea"), "Chelsea");
  assert.equal(winnerName("draw", "Arsenal", "Chelsea"), "Draw");
  assert.equal(winnerName("???", "A", "B"), null);
});

test("gradePrediction: Brier/log-loss + флаг попадания", () => {
  const probs = { Arsenal: 0.6, Draw: 0.25, Chelsea: 0.15 };
  const g = gradePrediction(probs, "Arsenal");
  assert.ok(g.correct);                 // максимум был на Arsenal
  assert.ok(g.brier >= 0 && g.brier < 1);
  assert.ok(g.logLoss > 0);

  const miss = gradePrediction(probs, "Chelsea");
  assert.equal(miss.correct, false);
  assert.ok(miss.brier > g.brier);      // ошибка → выше Brier
});

test("gradePrediction: null при отсутствии вероятности исхода", () => {
  assert.equal(gradePrediction(null, "A"), null);
  assert.equal(gradePrediction({ A: 0.5 }, "B"), null);
});

test("buildGradePatch: собирает патч результата для строки", () => {
  const row = { home: "Arsenal", away: "Chelsea", pred_probs: { Arsenal: 0.6, Draw: 0.25, Chelsea: 0.15 } };
  const patch = buildGradePatch(row, "home", "2026-07-11T00:00:00Z");
  assert.equal(patch.actual_outcome, "home");
  assert.ok(patch.brier >= 0);
  assert.ok(patch.log_loss > 0);
  assert.equal(patch.graded_at, "2026-07-11T00:00:00Z");
});

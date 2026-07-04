import { test } from "node:test";
import assert from "node:assert/strict";
import { poissonPmf, lambdasFromAverages, outcomeProbs, totalsProbs } from "../src/core/poisson.js";

test("poissonPmf: базовые значения", () => {
  // P(0; λ) = e^-λ
  assert.ok(Math.abs(poissonPmf(0, 1) - Math.exp(-1)) < 1e-9);
  assert.ok(Math.abs(poissonPmf(1, 2) - 2 * Math.exp(-2)) < 1e-9);
  assert.equal(poissonPmf(-1, 1), 0);
});

test("poissonPmf: сумма по k ≈ 1", () => {
  let s = 0;
  for (let k = 0; k <= 20; k++) s += poissonPmf(k, 2.5);
  assert.ok(Math.abs(s - 1) < 1e-6);
});

test("outcomeProbs: суммируются в 1; сильная атака хозяев → выше П1", () => {
  const p = outcomeProbs(2.0, 0.8);
  assert.ok(Math.abs(p.home + p.draw + p.away - 1) < 1e-6);
  assert.ok(p.home > p.away);
});

test("outcomeProbs: равные λ → П1 ≈ П2", () => {
  const p = outcomeProbs(1.3, 1.3);
  assert.ok(Math.abs(p.home - p.away) < 1e-6);
  assert.ok(p.draw > 0.2); // при низких λ ничьи заметны
});

test("totalsProbs: растёт Over с ростом λ; сумма 1", () => {
  const low = totalsProbs(0.7, 0.7, 2.5);
  const high = totalsProbs(2.2, 2.2, 2.5);
  assert.ok(Math.abs(low.over + low.under - 1) < 1e-6);
  assert.ok(high.over > low.over); // больше голов ожидается — выше Over
});

test("lambdasFromAverages: атака+оборона → λ, преимущество поля у хозяев", () => {
  const lam = lambdasFromAverages({
    homeScoredAvg: 1.6, homeConcededAvg: 1.0,
    awayScoredAvg: 1.2, awayConcededAvg: 1.4
  });
  assert.ok(lam.lh > 0 && lam.la > 0);
  // при симметрии по голам λ хозяев выше за счёт homeAdvantage
  const sym = lambdasFromAverages({
    homeScoredAvg: 1.3, homeConcededAvg: 1.3,
    awayScoredAvg: 1.3, awayConcededAvg: 1.3
  });
  assert.ok(sym.lh > sym.la);
});

test("lambdasFromAverages: мусор → null", () => {
  assert.equal(lambdasFromAverages({ homeScoredAvg: "x", homeConcededAvg: 1, awayScoredAvg: 1, awayConcededAvg: 1 }), null);
});

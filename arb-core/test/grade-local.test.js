import { test } from "node:test";
import assert from "node:assert/strict";
import {
  resultGoals, winningOutcomeName, gradeLoggedRecord, summarizeGrades
} from "../src/store/grade.js";

test("resultGoals: завершённый матч → голы; иначе null", () => {
  const ev = {
    completed: true, home_team: "A", away_team: "B",
    scores: [{ name: "A", score: "2" }, { name: "B", score: "1" }]
  };
  assert.deepEqual(resultGoals(ev), { homeGoals: 2, awayGoals: 1 });
  assert.equal(resultGoals({ ...ev, completed: false }), null);
  assert.equal(resultGoals(null), null);
});

test("winningOutcomeName(h2h): победитель по имени", () => {
  const r = { market: "h2h", home: "A", away: "B" };
  assert.equal(winningOutcomeName(r, 2, 1), "A");
  assert.equal(winningOutcomeName(r, 0, 3), "B");
  assert.equal(winningOutcomeName(r, 1, 1), "Draw");
});

test("winningOutcomeName(totals): Over/Under/push по линии", () => {
  const r = { market: "totals", point: 2.5 };
  assert.equal(winningOutcomeName(r, 2, 1), "Over");  // 3 > 2.5
  assert.equal(winningOutcomeName(r, 1, 1), "Under"); // 2 < 2.5
  const push = { market: "totals", point: 3 };
  assert.equal(winningOutcomeName(push, 2, 1), null); // 3 == 3 → возврат
});

test("gradeLoggedRecord: Brier + результат value-ставки", () => {
  const rec = {
    market: "h2h", home: "A", away: "B",
    probs: { A: 0.6, Draw: 0.25, B: 0.15 },
    valueBet: { name: "A", odds: 2.0 }
  };
  const g = gradeLoggedRecord(rec, 2, 0); // победа A
  assert.equal(g.winner, "A");
  assert.ok(g.correct);           // argmax был A
  assert.equal(g.betWon, true);
  assert.equal(g.betProfit, 1);   // odds 2.0 → +1 на ставку

  const lose = gradeLoggedRecord({ ...rec, valueBet: { name: "B", odds: 5 } }, 2, 0);
  assert.equal(lose.betWon, false);
  assert.equal(lose.betProfit, -1);
});

test("gradeLoggedRecord: push/нет вероятности → null", () => {
  const r = { market: "totals", point: 3, probs: { Over: 0.5, Under: 0.5 } };
  assert.equal(gradeLoggedRecord(r, 2, 1), null); // total 3 == линия → push
});

test("summarizeGrades: свод Brier/hit rate/ROI", () => {
  const graded = [
    { brier: 0.2, logLoss: 0.5, correct: true, betWon: true, betProfit: 1 },
    { brier: 0.8, logLoss: 1.2, correct: false, betWon: false, betProfit: -1 }
  ];
  const s = summarizeGrades(graded);
  assert.equal(s.count, 2);
  assert.equal(s.brier, 0.5);        // среднее
  assert.equal(s.hitRatePct, 50);
  assert.equal(s.bets, 2);
  assert.equal(s.betWins, 1);
  assert.equal(s.betRoiPct, 0);      // (+1 −1)/2 = 0
});

test("summarizeGrades: пусто → count 0", () => {
  assert.deepEqual(summarizeGrades([]), { count: 0 });
});

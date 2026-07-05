import { test } from "node:test";
import assert from "node:assert/strict";
import { buildLadder } from "../src/core/ladder.js";

const picks = [
  { home: "A", away: "B", name: "A", odds: 1.2, prob: 0.85 },
  { home: "C", away: "D", name: "C", odds: 1.25, prob: 0.82 },
  { home: "E", away: "F", name: "E", odds: 1.3, prob: 0.78 }
];

test("buildLadder: катит банк, множитель и суммы растут", () => {
  const l = buildLadder(picks, { targetMult: 3, maxSteps: 10, startStake: 5000 });
  assert.equal(l.steps.length, 3);
  assert.equal(l.steps[0].stakeIn, 5000);          // старт весь
  assert.ok(l.steps[1].stakeIn > 5000);            // катим выигрыш дальше
  // множитель = произведение коэффициентов
  assert.ok(Math.abs(l.finalMult - (1.2 * 1.25 * 1.3)) < 0.01);
  assert.equal(l.finalAmount, l.startStake * l.finalMult);
});

test("buildLadder: успех = произведение вероятностей всех шагов", () => {
  const l = buildLadder(picks, { targetMult: 10, maxSteps: 10, startStake: 1000 });
  const expected = 0.85 * 0.82 * 0.78;
  assert.ok(Math.abs(l.successProb - expected) < 1e-3);
});

test("buildLadder: останавливается по достижении цели", () => {
  const l = buildLadder(picks, { targetMult: 1.2, maxSteps: 10, startStake: 1000 });
  assert.equal(l.steps.length, 1);        // уже первый шаг даёт ×1.2
  assert.equal(l.reached, true);
});

test("buildLadder: ограничение по числу шагов", () => {
  const many = Array.from({ length: 20 }, () => ({ home: "x", away: "y", name: "x", odds: 1.1, prob: 0.9 }));
  const l = buildLadder(many, { targetMult: 999, maxSteps: 10, startStake: 100 });
  assert.equal(l.steps.length, 10);
  assert.equal(l.reached, false);         // до ×999 не дошли
});

test("buildLadder: пустые пики → пустая лесенка", () => {
  const l = buildLadder([], { targetMult: 3 });
  assert.equal(l.steps.length, 0);
  assert.equal(l.successProb, 1);         // ничего не поставлено
});

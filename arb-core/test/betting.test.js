import { test } from "node:test";
import assert from "node:assert/strict";
import { validateBet } from "../src/betting/caps.js";
import { addPending, takePending, sweepExpired, shortId } from "../src/betting/pending.js";
import { matchSelectionId, norm } from "../src/betting/match.js";
import { buildPlaceOrders, isPlaced } from "../src/betting/betfair.js";

// --- Лимиты ---
test("validateBet: пропускает в пределах лимитов", () => {
  assert.equal(validateBet({ stake: 10, maxStake: 20, dailyCap: 100, spentToday: 30 }).ok, true);
});
test("validateBet: режет выше лимита на ставку", () => {
  const r = validateBet({ stake: 50, maxStake: 20, dailyCap: 100 });
  assert.equal(r.ok, false);
  assert.match(r.reason, /лимит/);
});
test("validateBet: режет по дневному лимиту", () => {
  const r = validateBet({ stake: 30, maxStake: 100, dailyCap: 100, spentToday: 80 });
  assert.equal(r.ok, false);
  assert.match(r.reason, /дневн/);
});
test("validateBet: нулевая ставка → нет", () => {
  assert.equal(validateBet({ stake: 0, maxStake: 20 }).ok, false);
});

// --- Ожидающие подтверждения ---
test("pending: добавить и забрать одноразово", () => {
  const store = new Map();
  addPending(store, "b1", { size: 10 }, 1000, 5000);
  assert.deepEqual(takePending(store, "b1", 2000), { size: 10 });
  assert.equal(takePending(store, "b1", 2000), null); // уже забрали
});
test("pending: просроченное не возвращается", () => {
  const store = new Map();
  addPending(store, "b2", { size: 5 }, 1000, 1000); // истекает в 2000
  assert.equal(takePending(store, "b2", 3000), null);
});
test("pending: sweepExpired чистит старьё", () => {
  const store = new Map();
  addPending(store, "a", {}, 0, 1000);
  addPending(store, "b", {}, 0, 10000);
  assert.equal(sweepExpired(store, 5000), 1);
  assert.equal(store.size, 1);
});
test("shortId: буквенно-цифровой короткий id", () => {
  assert.match(shortId("175abc9932"), /^b\d+$/);
});

// --- Матчинг раннера Betfair ---
test("matchSelectionId: команда и ничья", () => {
  const runners = [
    { selectionId: 1, runnerName: "Arsenal" },
    { selectionId: 2, runnerName: "The Draw" },
    { selectionId: 3, runnerName: "Chelsea" }
  ];
  assert.equal(matchSelectionId(runners, { outcomeName: "Chelsea", home: "Arsenal", away: "Chelsea" }), 3);
  assert.equal(matchSelectionId(runners, { outcomeName: "Draw" }), 2);
  assert.equal(matchSelectionId(runners, { outcomeName: "Unknown FC" }), null);
});
test("norm: нормализует имена для сравнения", () => {
  assert.equal(norm("Man. United!"), "manunited");
});

// --- Сборка placeOrders ---
test("buildPlaceOrders: BACK LIMIT с ценой и размером", () => {
  const o = buildPlaceOrders({ marketId: "1.23", selectionId: 47973, price: 3.75, size: 18.005 });
  assert.equal(o.marketId, "1.23");
  const i = o.instructions[0];
  assert.equal(i.selectionId, 47973);
  assert.equal(i.side, "BACK");
  assert.equal(i.orderType, "LIMIT");
  assert.equal(i.limitOrder.price, 3.75);
  assert.equal(i.limitOrder.size, 18.01); // округление до копеек
});
test("isPlaced: успех только при EXECUTION_COMPLETE", () => {
  assert.equal(isPlaced({ status: "SUCCESS", instructionReports: [{ orderStatus: "EXECUTION_COMPLETE" }] }), true);
  assert.equal(isPlaced({ status: "FAILURE", instructionReports: [] }), false);
  assert.equal(isPlaced(null), false);
});

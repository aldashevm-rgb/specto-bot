import { test } from "node:test";
import assert from "node:assert/strict";
import { parseBooks, bookAllowed, restrictOutcome, restrictBestOutcomes } from "../src/core/mybooks.js";

test("parseBooks: список из строки", () => {
  assert.deepEqual(parseBooks("1xBet, Melbet ,Parimatch"), ["1xbet", "melbet", "parimatch"]);
  assert.deepEqual(parseBooks(""), []);
});

test("bookAllowed: пусто = все; иначе по подстроке", () => {
  assert.equal(bookAllowed("Pinnacle", []), true);           // фильтра нет
  assert.equal(bookAllowed("1xBet", ["1xbet", "melbet"]), true);
  assert.equal(bookAllowed("Unibet (SE)", ["1xbet", "melbet"]), false);
});

test("restrictOutcome: оставляет только мои конторы, лучший = максимум среди моих", () => {
  const oc = {
    name: "A", odds: 3.9, bookmaker: "Betfair",
    books: [{ bookmaker: "Betfair", odds: 3.9 }, { bookmaker: "1xBet", odds: 3.7 }, { bookmaker: "Pinnacle", odds: 3.6 }]
  };
  const r = restrictOutcome(oc, ["1xbet", "melbet"]);
  assert.equal(r.bookmaker, "1xBet");   // Betfair отфильтрован
  assert.equal(r.odds, 3.7);            // лучший среди моих
  assert.equal(r.books.length, 1);
});

test("restrictOutcome: нет моих контор → null", () => {
  const oc = { name: "A", books: [{ bookmaker: "Betfair", odds: 3.9 }] };
  assert.equal(restrictOutcome(oc, ["1xbet"]), null);
});

test("restrictBestOutcomes: выкидывает исходы без моих контор", () => {
  const best = [
    { name: "A", books: [{ bookmaker: "1xBet", odds: 2.0 }] },
    { name: "B", books: [{ bookmaker: "Pinnacle", odds: 2.0 }] }
  ];
  const r = restrictBestOutcomes(best, ["1xbet"]);
  assert.equal(r.length, 1);
  assert.equal(r[0].name, "A");
});

test("restrictBestOutcomes: пустой список = без изменений", () => {
  const best = [{ name: "A", books: [{ bookmaker: "X", odds: 2 }] }];
  assert.equal(restrictBestOutcomes(best, []), best);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { surebetKey, valueKey, pickNew } from "../src/notify/dedup.js";
import { formatValueAlert, formatGradeResult } from "../src/notify/telegram.js";

test("valueKey/surebetKey: включают ставку и контору", () => {
  const v = { id: "e1", market: "h2h", line: null, valueBet: { name: "A", bookmaker: "Pinnacle" } };
  assert.equal(valueKey(v), "VAL:e1:h2h:-:A:Pinnacle");
  const sb = { id: "e2", market: "totals", line: "Тотал 2.5", arb: { marginPct: 3.1 } };
  assert.equal(surebetKey(sb), "SURE:e2:totals:Тотал 2.5:3.1");
});

test("pickNew: возвращает только новые, помечает их в seen", () => {
  const seen = new Set();
  const items = [
    { id: "a", market: "h2h", line: null, valueBet: { name: "X", bookmaker: "B" } },
    { id: "b", market: "h2h", line: null, valueBet: { name: "Y", bookmaker: "B" } }
  ];
  const first = pickNew(items, seen, valueKey);
  assert.equal(first.length, 2);           // оба новые
  const second = pickNew(items, seen, valueKey);
  assert.equal(second.length, 0);          // повтор — уже видели
  // новая контора по тому же матчу = новая возможность
  const third = pickNew([{ ...items[0], valueBet: { name: "X", bookmaker: "1xBet" } }], seen, valueKey);
  assert.equal(third.length, 1);
});

test("formatValueAlert: понятный текст (спорт, исход, кэф, сумма); экранирует", () => {
  const v = {
    id: "e1", sport: "soccer_epl", market: "h2h", line: null, point: null,
    home: "Hull<b>", away: "Man Utd", commence: "2026-08-22T16:30:00Z",
    valueBet: {
      name: "Hull<b>", odds: 7.8, bookmaker: "Betfair", edgePct: 8.9, tier: "sharp",
      books: [{ bookmaker: "Betfair", odds: 7.8 }, { bookmaker: "1xBet", odds: 7.0 }]
    },
    prediction: { probs: { "Hull<b>": 0.14, Draw: 0.21, "Man Utd": 0.65 } }
  };
  const msg = formatValueAlert(v, { bankroll: 1000, fraction: 0.25, maxFraction: 0.05 });
  assert.match(msg, /\+8\.9%/);
  assert.match(msg, /⚽ Футбол/);           // человеческое название спорта
  assert.match(msg, /Ставить на:/);
  assert.match(msg, /Победа Hull&lt;b&gt; \(П1\)/); // понятный исход + экранирование
  assert.match(msg, /Лучший коэф: <b>7\.8<\/b>/);
  assert.match(msg, /надёжная/);
  assert.match(msg, /Сумма ставки/);
  assert.match(msg, /📊 Кэфы:.*Betfair 7\.8 ⭐/);   // сравнение кэфов, лучший помечен
  assert.match(msg, /1xBet 7/);                     // и другая контора
  assert.doesNotMatch(msg, /soccer_epl/);   // сырого ключа спорта нет
});

test("formatGradeResult: сыгравшая ставка → плюс, счёт, понятный исход", () => {
  const rec = {
    home: "Goiás", away: "Ceará", sport: "soccer_brazil_serie_b", market: "totals",
    line: "Тотал 2.5", point: 2.5,
    actual_home: 2, actual_away: 1, winner: "Over", bet_won: true,
    valueBet: { name: "Over", odds: 2.74, bookmaker: "Matchbook" },
    probs: { Over: 0.4, Under: 0.6 }
  };
  const msg = formatGradeResult(rec, { bankroll: 5000, fraction: 0.25, maxFraction: 0.05 });
  assert.match(msg, /СЫГРАЛА/);
  assert.match(msg, /счёт 2:1/);
  assert.match(msg, /Тотал больше 2\.5/);   // понятный исход
  assert.match(msg, /кэф 2\.74/);
  assert.match(msg, /\+/);
});

test("formatGradeResult: не зашла → минус, понятный исход", () => {
  const rec = {
    home: "A", away: "B", sport: "tennis_atp", market: "h2h", actual_home: 0, actual_away: 1,
    winner: "B", bet_won: false,
    valueBet: { name: "A", odds: 3.0, bookmaker: "1xBet" }, probs: { A: 0.33, Draw: 0.3, B: 0.37 }
  };
  const msg = formatGradeResult(rec, { bankroll: 1000, fraction: 0.25, maxFraction: 0.05 });
  assert.match(msg, /не зашла/i);
  assert.match(msg, /Победа A \(П1\)/);
});

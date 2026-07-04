import { test } from "node:test";
import assert from "node:assert/strict";
import { surebetKey, valueKey, pickNew } from "../src/notify/dedup.js";
import { formatValueAlert } from "../src/notify/telegram.js";

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

test("formatValueAlert: содержит матч, перевес, ставку по Кельли; экранирует", () => {
  const v = {
    id: "e1", sport: "soccer_epl", market: "h2h", line: null,
    home: "Hull<b>", away: "Man Utd", commence: "2026-08-22T16:30:00Z",
    valueBet: { name: "Hull<b>", odds: 7.8, bookmaker: "Betfair", edgePct: 8.9, tier: "sharp" },
    prediction: { probs: { "Hull<b>": 0.14, Draw: 0.21, "Man Utd": 0.65 } }
  };
  const msg = formatValueAlert(v, { bankroll: 1000, fraction: 0.25, maxFraction: 0.05 });
  assert.match(msg, /Value \+8\.9%/);
  assert.match(msg, /резкая/);
  assert.match(msg, /Ставка:/);
  assert.match(msg, /Hull&lt;b&gt;/);       // экранировано
  assert.doesNotMatch(msg, /Hull<b>/);
});

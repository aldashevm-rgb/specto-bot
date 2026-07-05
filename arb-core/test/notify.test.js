import { test } from "node:test";
import assert from "node:assert/strict";
import { formatSurebet } from "../src/notify/telegram.js";

const sb = {
  id: "ev1", sport: "soccer_epl", market: "h2h", line: null,
  home: "Arsenal", away: "Chelsea", commence: "2026-07-10T18:00:00Z",
  arb: {
    marginPct: 4.78, roi: 5.02, invested: 1000, guaranteedPayout: 1050.17, profit: 50.17,
    legs: [
      { name: "Arsenal", odds: 2.35, bookmaker: "BookOne", stake: 446.89, payout: 1050.19 },
      { name: "Chelsea", odds: 3.7, bookmaker: "BookTwo", stake: 283.83, payout: 1050.17 }
    ]
  },
  ai: { needsWin: "home", likelyOutcome: "home", confidence: 70,
        probs: { home: 0.5, draw: 0.25, away: 0.25 }, reasoning: "x" }
};

test("formatSurebet: понятный текст — спорт, команды, маржа, раскладка", () => {
  const msg = formatSurebet(sb);
  assert.match(msg, /⚽ Футбол/);            // человеческое название спорта
  assert.match(msg, /Arsenal — Chelsea/);
  assert.match(msg, /\+4\.78%/);
  assert.match(msg, /Победа Arsenal \(П1\)/); // понятный исход
  assert.match(msg, /446\.89/);
  assert.doesNotMatch(msg, /soccer_epl/);     // сырого ключа спорта нет
});

test("formatSurebet: экранирует HTML-спецсимволы в названиях", () => {
  const evil = { ...sb, home: "A<b>&", ai: null, line: "Тотал 2.5" };
  const msg = formatSurebet(evil);
  assert.match(msg, /A&lt;b&gt;&amp;/);   // экранировано
  assert.doesNotMatch(msg, /A<b>&/);      // сырых тегов нет
  assert.match(msg, /Тотал 2\.5/);        // линия попала в текст
});

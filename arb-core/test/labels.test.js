import { test } from "node:test";
import assert from "node:assert/strict";
import { sportLabel, outcomeLabel, timeUntil } from "../src/notify/labels.js";

test("sportLabel: ключ спорта → иконка + русское название", () => {
  assert.equal(sportLabel("soccer_epl"), "⚽ Футбол");
  assert.equal(sportLabel("tennis_atp_wimbledon"), "🎾 Теннис");
  assert.equal(sportLabel("basketball_nba"), "🏀 Баскетбол");
  assert.equal(sportLabel("boxing_boxing"), "🥊 Бокс");
  assert.equal(sportLabel("americanfootball_nfl"), "🏈 Ам. футбол");
  assert.match(sportLabel("darts_pdc"), /🏆 darts_pdc/); // неизвестный — с ключом
});

test("outcomeLabel(h2h): Победа/Ничья с П1/Х/П2", () => {
  const base = { market: "h2h", home: "Real", away: "Barca" };
  assert.equal(outcomeLabel({ ...base, name: "Real" }), "Победа Real (П1)");
  assert.equal(outcomeLabel({ ...base, name: "Barca" }), "Победа Barca (П2)");
  assert.equal(outcomeLabel({ ...base, name: "Draw" }), "Ничья (Х)");
});

test("outcomeLabel(totals): Тотал больше/меньше N", () => {
  assert.equal(outcomeLabel({ market: "totals", name: "Over", point: 2.5 }), "Тотал больше 2.5");
  assert.equal(outcomeLabel({ market: "totals", name: "Under", point: 3 }), "Тотал меньше 3");
});

test("timeUntil: человекочитаемо", () => {
  const now = Date.parse("2026-07-05T12:00:00Z");
  const at = (min) => new Date(now + min * 60000).toISOString();
  assert.equal(timeUntil(at(25), now), "через 25 мин");
  assert.equal(timeUntil(at(180), now), "через 3 ч");
  assert.equal(timeUntil(at(190), now), "через 3 ч 10 мин");
  assert.equal(timeUntil(at(60 * 24 * 2), now), "через 2 дн");
  assert.equal(timeUntil(at(-10), now), "уже идёт");
  assert.equal(timeUntil(null, now), "");
});
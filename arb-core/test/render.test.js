import { test } from "node:test";
import assert from "node:assert/strict";
import { renderDashboardHtml } from "../src/render.js";

const data = {
  sport: "soccer_epl",
  settings: {
    maxHours: 72, bankroll: 1000, minEdgePct: 2, minMarginPct: 0.5, minEdgeSoftPct: 4,
    sharpOnly: false, enrichAi: false, markets: ["h2h", "totals"],
    kellyFraction: 0.25, kellyMax: 0.05,
    sources: { football: true, claude: false, telegram: false }
  },
  surebets: [{
    home: "A", away: "B", sport: "soccer_epl", market: "h2h", line: null,
    arb: { marginPct: 4.78, roi: 5.02, invested: 1000, guaranteedPayout: 1050, profit: 50,
      legs: [{ name: "A", odds: 2.35, bookmaker: "AlphaBet", stake: 446, payout: 1050 }] }
  }],
  values: [{
    home: "Hull City", away: "Man Utd", sport: "soccer_epl", market: "h2h", line: null,
    commence: "2026-08-22T16:30:00Z",
    valueBet: { name: "Hull City", odds: 7.8, bookmaker: "Betfair", edgePct: 8.9, tier: "sharp" },
    prediction: { probs: { "Hull City": 0.14, Draw: 0.21, "Man Utd": 0.65 }, sources: ["consensus"] }
  }],
  accuracy: { count: 24, brier: 0.34, hitRatePct: 54, bets: 12, betWins: 3, betRoiPct: 2.1 }
};

test("renderDashboardHtml: валидная страница с ключевыми блоками", () => {
  const html = renderDashboardHtml(data);
  assert.match(html, /<!doctype html>/i);
  assert.match(html, /SPECTO ARB/);
  assert.match(html, /Hull City/);
  assert.match(html, /8\.9%/);            // перевес
  assert.match(html, /ставка/);           // Kelly
  assert.match(html, /Brier/);
  assert.match(html, /54%/);              // hit rate
  assert.match(html, /form/);             // панель управления
});

test("renderDashboardHtml: экранирует HTML в названиях", () => {
  const evil = { ...data, values: [{
    ...data.values[0], home: "<script>x</script>", away: "A&B",
    valueBet: { ...data.values[0].valueBet, bookmaker: "<b>" }
  }] };
  const html = renderDashboardHtml(evil);
  assert.doesNotMatch(html, /<script>x<\/script>/);
  assert.match(html, /&lt;script&gt;/);
});

test("renderDashboardHtml: пустые секции дают заглушки, не падает", () => {
  const empty = { sport: "upcoming", settings: data.settings, surebets: [], values: [], accuracy: { count: 0 } };
  const html = renderDashboardHtml(empty);
  assert.match(html, /Вилок нет/);
  assert.match(html, /Value-ставок выше порога нет/);
  assert.match(html, /Нет оценённых/);
});

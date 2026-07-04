import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRow } from "../src/store/supabase.js";

test("buildRow: раскладывает вилку и ИИ-разбор по колонкам", () => {
  const sb = {
    id: "ev1", sport: "soccer_epl", market: "totals", line: "Тотал 2.5",
    home: "A", away: "B", commence: "2026-07-10T18:00:00Z",
    arb: { marginPct: 3.1, roi: 3.2, invested: 1000, guaranteedPayout: 1031, profit: 31,
           legs: [{ name: "Over", odds: 2.1, stake: 500 }] },
    ai: { needsWin: "away", likelyOutcome: "draw", confidence: 55,
          probs: { home: 0.3, draw: 0.4, away: 0.3 }, reasoning: "ровный матч" }
  };
  const row = buildRow(sb);
  assert.equal(row.event_id, "ev1");
  assert.equal(row.market, "totals");
  assert.equal(row.line, "Тотал 2.5");
  assert.equal(row.margin_pct, 3.1);
  assert.equal(row.ai_needs_win, "away");
  assert.equal(row.ai_confidence, 55);
  assert.deepEqual(row.ai_probs, { home: 0.3, draw: 0.4, away: 0.3 });
  assert.ok(Array.isArray(row.legs));
});

test("buildRow: без ИИ-разбора поля ai_* = null", () => {
  const sb = {
    id: "ev2", sport: "s", market: "h2h", line: null, home: "A", away: "B", commence: null,
    arb: { marginPct: 1, roi: 1, invested: 1000, guaranteedPayout: 1010, profit: 10, legs: [] },
    ai: null
  };
  const row = buildRow(sb);
  assert.equal(row.line, null);
  assert.equal(row.ai_needs_win, null);
  assert.equal(row.ai_probs, null);
});

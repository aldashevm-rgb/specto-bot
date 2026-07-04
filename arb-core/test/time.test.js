import { test } from "node:test";
import assert from "node:assert/strict";
import { withinWindow } from "../src/util/time.js";
import { scanValue } from "../src/core/scanner.js";

const NOW = Date.parse("2026-07-04T12:00:00Z");
const H = 3600 * 1000;

test("withinWindow: в пределах окна — true", () => {
  assert.equal(withinWindow(new Date(NOW + 10 * H).toISOString(), NOW, 72), true);
});

test("withinWindow: дальше окна — false", () => {
  assert.equal(withinWindow(new Date(NOW + 100 * H).toISOString(), NOW, 72), false);
});

test("withinWindow: уже начался/прошёл — false", () => {
  assert.equal(withinWindow(new Date(NOW - 1 * H).toISOString(), NOW, 72), false);
});

test("withinWindow: maxHours<=0 → без верхней границы (но прошлое режется)", () => {
  assert.equal(withinWindow(new Date(NOW + 1000 * H).toISOString(), NOW, 0), true);
  assert.equal(withinWindow(new Date(NOW - 1 * H).toISOString(), NOW, 0), false);
});

test("withinWindow: нет/битое время → не отсекаем", () => {
  assert.equal(withinWindow(null, NOW, 72), true);
  assert.equal(withinWindow("не дата", NOW, 72), true);
});

test("scanValue: окно отсекает далёкие матчи", async () => {
  const soon = new Date(NOW + 24 * H).toISOString();
  const far = new Date(NOW + 30 * 24 * H).toISOString(); // через месяц
  const mk = (id, commence) => ({
    id, sport_key: "soccer", commence_time: commence, home_team: "A", away_team: "B",
    bookmakers: [
      { key: "p", title: "Pinnacle", markets: [{ key: "h2h", outcomes: [{ name: "A", price: 1.5 }, { name: "B", price: 2.7 }] }] },
      { key: "s", title: "1xBet", markets: [{ key: "h2h", outcomes: [{ name: "A", price: 1.55 }, { name: "B", price: 3.2 }] }] }
    ]
  });
  const sample = [mk("soon", soon), mk("far", far)];
  const r = await scanValue({
    sport: "soccer", markets: ["h2h"], minEdgePct: 1, minEdgeSoftPct: 1,
    maxHours: 72, nowMs: NOW, fetchOddsFn: async () => sample
  });
  assert.equal(r.windowHours, 72);
  assert.ok(r.values.every(v => v.id === "soon")); // далёкий "far" отсечён
});

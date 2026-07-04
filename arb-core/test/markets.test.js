import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeLines, normalizeEventsMulti } from "../src/core/normalize.js";

// --- Тоталы: арбитраж только в пределах одной линии (point) ---
const totalsEvent = {
  id: "t1", sport_key: "soccer", commence_time: "2026-07-10T18:00:00Z",
  home_team: "A", away_team: "B",
  bookmakers: [
    { key: "b1", title: "One", markets: [{ key: "totals", outcomes: [
      { name: "Over", price: 2.1, point: 2.5 },
      { name: "Under", price: 1.8, point: 2.5 },
      { name: "Over", price: 1.7, point: 3.0 }   // другая линия — не смешивать
    ] }] },
    { key: "b2", title: "Two", markets: [{ key: "totals", outcomes: [
      { name: "Over", price: 1.9, point: 2.5 },
      { name: "Under", price: 2.15, point: 2.5 }, // лучший Under на линии 2.5
      { name: "Under", price: 2.4, point: 3.0 }
    ] }] }
  ]
};

test("normalizeLines(totals): группирует по линии и берёт лучший коэф. на сторону", () => {
  const lines = normalizeLines(totalsEvent, "totals");
  const l25 = lines.find(l => l.point === 2.5);
  assert.ok(l25, "линия 2.5 должна быть");
  const byName = Object.fromEntries(l25.bestOutcomes.map(o => [o.name, o]));
  assert.equal(byName.Over.odds, 2.1);   // лучший Over 2.5 у One
  assert.equal(byName.Under.odds, 2.15); // лучший Under 2.5 у Two
  assert.equal(l25.line, "Тотал 2.5");
  // Линия 3.0 неполная (нет Under у одного и Over у другого корректной пары?) —
  // здесь есть Over@3.0 (One) и Under@3.0 (Two) → линия должна собраться.
  const l30 = lines.find(l => l.point === 3.0);
  assert.ok(l30);
  assert.equal(l30.bestOutcomes.length, 2);
});

test("normalizeLines(totals): линия без обеих сторон пропускается", () => {
  const oneSide = {
    id: "t2", home_team: "A", away_team: "B",
    bookmakers: [{ key: "b", title: "B", markets: [{ key: "totals", outcomes: [
      { name: "Over", price: 2.0, point: 2.5 } // нет Under
    ] }] }]
  };
  assert.equal(normalizeLines(oneSide, "totals").length, 0);
});

// --- Форы: зеркальная пара хозяева@-h / гости@+h ---
const spreadsEvent = {
  id: "s1", sport_key: "soccer", home_team: "Home", away_team: "Away",
  bookmakers: [
    { key: "b1", title: "One", markets: [{ key: "spreads", outcomes: [
      { name: "Home", price: 2.05, point: -1.5 },
      { name: "Away", price: 1.85, point: 1.5 }
    ] }] },
    { key: "b2", title: "Two", markets: [{ key: "spreads", outcomes: [
      { name: "Home", price: 1.95, point: -1.5 },
      { name: "Away", price: 2.1, point: 1.5 } // лучший Away +1.5
    ] }] }
  ]
};

test("normalizeLines(spreads): пара хозяева@-h против гостей@+h", () => {
  const lines = normalizeLines(spreadsEvent, "spreads");
  const l = lines.find(x => x.point === -1.5);
  assert.ok(l);
  const byName = Object.fromEntries(l.bestOutcomes.map(o => [o.name, o]));
  assert.equal(byName.Home.odds, 2.05); // лучший Home -1.5 у One
  assert.equal(byName.Away.odds, 2.1);  // лучший Away +1.5 у Two
  assert.equal(l.line, "Фора -1.5");
});

test("normalizeEventsMulti: собирает линии по нескольким рынкам", () => {
  const h2h = { ...totalsEvent, bookmakers: [
    ...totalsEvent.bookmakers,
    { key: "b3", title: "Three", markets: [{ key: "h2h", outcomes: [
      { name: "A", price: 2.0 }, { name: "B", price: 2.0 }
    ] }] }
  ] };
  const lines = normalizeEventsMulti([h2h], ["h2h", "totals"]);
  const markets = new Set(lines.map(l => l.market));
  assert.ok(markets.has("h2h"));
  assert.ok(markets.has("totals"));
  // У каждой линии уникальный lineId.
  const ids = lines.map(l => l.lineId);
  assert.equal(new Set(ids).size, ids.length);
});

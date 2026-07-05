// Нормализация линий букмекеров в единый вид + поиск ЛУЧШЕГО коэффициента по
// каждому исходу среди всех БК. Чистые функции — тестируются без сети.
//
// Вход — формат The Odds API (событие с массивом bookmakers[].markets[].outcomes[]).
// Выход — «линии» с bestOutcomes: по одному лучшему коэф. на исход (кандидаты в вилку).
//
// Важно про рынки с точкой (тоталы/форы): арбитраж считается ТОЛЬКО в пределах
// одной линии. Нельзя смешивать «Тотал 2.5» и «Тотал 3.0» — это разные рынки.
// Для фор пара «мирроринг»: хозяева с форой -h против гостей с форой +h.

// --- h2h (1X2): по каждому исходу — максимальный коэффициент среди БК ---
export function bestOutcomes(event, marketKey = "h2h") {
  if (!event || !Array.isArray(event.bookmakers)) return null;

  // name → [{ bookmaker, odds }] по всем БК (для сравнения кэфов).
  const byName = new Map();
  for (const bk of event.bookmakers) {
    const market = (bk.markets || []).find(m => m.key === marketKey);
    if (!market) continue;
    for (const oc of market.outcomes || []) {
      const odds = Number(oc.price);
      if (!Number.isFinite(odds) || odds <= 1) continue;
      const arr = byName.get(oc.name) || [];
      arr.push({ bookmaker: bk.title || bk.key, odds });
      byName.set(oc.name, arr);
    }
  }
  if (byName.size < 2) return null;

  return {
    id: event.id,
    sport: event.sport_key || event.sport,
    commence: event.commence_time,
    home: event.home_team,
    away: event.away_team,
    market: marketKey,
    bestOutcomes: [...byName.entries()].map(([name, arr]) => makeOutcome(name, arr))
  };
}

// Список котировок по исходу → лучший коэф. + отсортированный список books.
function makeOutcome(name, books, extra = {}) {
  books.sort((a, b) => b.odds - a.odds);
  return { name, odds: books[0].odds, bookmaker: books[0].bookmaker, books, ...extra };
}

// --- Тоталы (Over/Under): лучший коэф. на каждую сторону В ПРЕДЕЛАХ линии ---
function totalsLines(event) {
  const byPoint = new Map(); // point → { Over:[{bk,odds}], Under:[...] }
  for (const bk of event.bookmakers || []) {
    const market = (bk.markets || []).find(m => m.key === "totals");
    if (!market) continue;
    for (const oc of market.outcomes || []) {
      const odds = Number(oc.price);
      if (!Number.isFinite(odds) || odds <= 1 || oc.point == null) continue;
      const slot = byPoint.get(oc.point) || {};
      (slot[oc.name] = slot[oc.name] || []).push({ bookmaker: bk.title || bk.key, odds });
      byPoint.set(oc.point, slot);
    }
  }
  const lines = [];
  for (const [point, slot] of byPoint) {
    if (slot.Over && slot.Under) {
      lines.push({
        line: `Тотал ${point}`, point,
        bestOutcomes: [makeOutcome("Over", slot.Over, { point }), makeOutcome("Under", slot.Under, { point })]
      });
    }
  }
  return lines;
}

// --- Форы (spreads): хозяева @ -h против гостей @ +h (зеркальная пара) ---
function spreadsLines(event) {
  const home = event.home_team;
  const away = event.away_team;
  const homeBooks = new Map(); // point → [{bk,odds}]
  const awayBooks = new Map();
  for (const bk of event.bookmakers || []) {
    const market = (bk.markets || []).find(m => m.key === "spreads");
    if (!market) continue;
    for (const oc of market.outcomes || []) {
      const odds = Number(oc.price);
      if (!Number.isFinite(odds) || odds <= 1 || oc.point == null) continue;
      const target = oc.name === home ? homeBooks : oc.name === away ? awayBooks : null;
      if (!target) continue;
      const arr = target.get(oc.point) || [];
      arr.push({ bookmaker: bk.title || bk.key, odds });
      target.set(oc.point, arr);
    }
  }
  const lines = [];
  for (const [ph, hArr] of homeBooks) {
    const aArr = awayBooks.get(-ph); // зеркальная фора у гостей
    if (aArr) {
      lines.push({
        line: `Фора ${ph > 0 ? "+" : ""}${ph}`, point: ph,
        bestOutcomes: [makeOutcome(home, hArr, { point: ph }), makeOutcome(away, aArr, { point: -ph })]
      });
    }
  }
  return lines;
}

// Единая нормализация одного события в набор «линий» под указанный рынок.
// Возвращает массив линий (для h2h — одна линия), каждая пригодна для
// computeArbitrage. Пустой массив, если полного рынка нет.
export function normalizeLines(event, marketKey = "h2h") {
  if (!event || !Array.isArray(event.bookmakers)) return [];
  const meta = {
    id: event.id,
    sport: event.sport_key || event.sport,
    commence: event.commence_time,
    home: event.home_team,
    away: event.away_team,
    market: marketKey
  };
  let lines;
  if (marketKey === "totals") lines = totalsLines(event);
  else if (marketKey === "spreads") lines = spreadsLines(event);
  else {
    const h = bestOutcomes(event, marketKey);
    lines = h ? [{ line: null, point: null, bestOutcomes: h.bestOutcomes }] : [];
  }
  return lines.map(l => ({
    ...meta,
    line: l.line,
    point: l.point,
    // Уникальный ключ линии — чтобы не путать разные точки одного события.
    lineId: `${meta.id}:${marketKey}:${l.point ?? "-"}`,
    bestOutcomes: l.bestOutcomes
  }));
}

// Пакетная нормализация: массив событий × список рынков → плоский список линий.
export function normalizeEventsMulti(events = [], markets = ["h2h"]) {
  const out = [];
  for (const ev of events) {
    for (const mk of markets) {
      for (const line of normalizeLines(ev, mk)) out.push(line);
    }
  }
  return out;
}

// Обратная совместимость: только h2h, по одной записи на событие.
export function normalizeEvents(events = [], marketKey = "h2h") {
  const out = [];
  for (const ev of events) {
    const n = bestOutcomes(ev, marketKey);
    if (n) out.push(n);
  }
  return out;
}

// Нормализация линий букмекеров в единый вид + поиск ЛУЧШЕГО коэффициента по
// каждому исходу среди всех БК. Чистые функции — тестируются без сети.
//
// Вход — формат The Odds API (событие с массивом bookmakers[].markets[].outcomes[]).
// Выход — компактное событие с bestOutcomes: по одному лучшему коэф. на исход,
// с указанием, у какого букмекера он взят (это и есть кандидаты в вилку).

// Из одного события The Odds API берём указанный рынок (по умолчанию h2h —
// «победа1 / ничья / победа2») и по каждому исходу находим максимальный коэф.
// Возвращает { id, sport, commence, home, away, market, bestOutcomes:[...] }.
export function bestOutcomes(event, marketKey = "h2h") {
  if (!event || !Array.isArray(event.bookmakers)) return null;

  // name → { name, odds, bookmaker } с лучшим (максимальным) коэффициентом.
  const best = new Map();
  for (const bk of event.bookmakers) {
    const market = (bk.markets || []).find(m => m.key === marketKey);
    if (!market) continue;
    for (const oc of market.outcomes || []) {
      const odds = Number(oc.price);
      if (!Number.isFinite(odds) || odds <= 1) continue;
      const prev = best.get(oc.name);
      if (!prev || odds > prev.odds) {
        best.set(oc.name, {
          name: oc.name,
          odds,
          point: oc.point, // для тоталов/фор (если рынок не h2h)
          bookmaker: bk.title || bk.key
        });
      }
    }
  }
  if (best.size < 2) return null;

  return {
    id: event.id,
    sport: event.sport_key || event.sport,
    commence: event.commence_time,
    home: event.home_team,
    away: event.away_team,
    market: marketKey,
    bestOutcomes: [...best.values()]
  };
}

// Пакетная нормализация массива событий. Пропускает те, где нет полного рынка.
export function normalizeEvents(events = [], marketKey = "h2h") {
  const out = [];
  for (const ev of events) {
    const n = bestOutcomes(ev, marketKey);
    if (n) out.push(n);
  }
  return out;
}

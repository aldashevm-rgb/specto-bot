// Оркестратор: коэффициенты → нормализация → поиск вилок → ИИ-разбор мотивации.
//
// Поток:
//   1. Тянем линии всех БК (The Odds API).
//   2. По каждому событию берём лучший коэф. на исход (normalize).
//   3. Ищем вилки (arbitrage.findSurebets) и считаем раскладку ставок.
//   4. По найденным событиям дергаем статистику (API-Football) и просим Claude
//      оценить, кому нужнее победа и какой исход вероятнее (motivation).
//   5. Отдаём отсортированный список: сверху — самые маржинальные вилки.

import { fetchOdds } from "../sources/oddsApi.js";
import { findTeam, teamForm, summarizeContext } from "../sources/apiFootball.js";
import { normalizeEvents } from "./normalize.js";
import { findSurebets } from "./arbitrage.js";
import { readMatch, valueEdges } from "./motivation.js";
import { config, haveApiFootball, haveClaude } from "../config.js";

// Собрать контекст матча из API-Football (форма обеих команд). Без ключа/данных
// возвращает пустую строку — ИИ тогда оценивает осторожно.
async function buildContext(home, away) {
  if (!haveApiFootball()) return "";
  try {
    const [ht, at] = await Promise.all([findTeam(home), findTeam(away)]);
    const [hf, af] = await Promise.all([
      ht ? teamForm(ht.id) : Promise.resolve([]),
      at ? teamForm(at.id) : Promise.resolve([])
    ]);
    return summarizeContext({ home, away, homeForm: hf, awayForm: af, table: [] });
  } catch (err) {
    console.warn(`Контекст ${home}–${away} не собран: ${err.message}`);
    return "";
  }
}

// Обогатить одно событие ИИ-разбором (мотивация + вероятный исход + value).
async function enrich(ev) {
  if (!haveClaude()) return ev;
  const context = await buildContext(ev.home, ev.away);
  const read = await readMatch({ home: ev.home, away: ev.away, context });
  if (!read) return { ...ev, ai: null };
  const edges = valueEdges({ home: ev.home, away: ev.away }, read.probs, ev.bestOutcomes);
  return { ...ev, ai: { ...read, edges } };
}

// Полный скан. opts:
//   sport        — ключ вида спорта The Odds API ("upcoming" | "soccer_epl" | ...)
//   minMarginPct — минимальная маржа вилки, %
//   totalStake   — банк на событие для раскладки ставок
//   enrichAi     — обогащать ли найденные вилки ИИ-разбором (по умолчанию true)
//   fetchOddsFn  — инъекция источника (для тестов)
// Возвращает { scanned, surebets: [...] }.
export async function scan({
  sport = "upcoming",
  minMarginPct = config.minMarginPct,
  totalStake = config.totalStake,
  market = config.market,
  enrichAi = true,
  fetchOddsFn = fetchOdds
} = {}) {
  const raw = await fetchOddsFn(sport, { markets: market });
  const events = normalizeEvents(raw, market);
  const surebets = findSurebets(events, { minMarginPct, totalStake });

  const enriched = [];
  for (const sb of surebets) {
    enriched.push(enrichAi ? await enrich(sb) : sb);
  }

  return { scanned: events.length, found: enriched.length, surebets: enriched };
}

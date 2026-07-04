// Оркестратор: коэффициенты → нормализация → поиск вилок → ИИ-разбор →
// уведомления (Telegram) и лог (Supabase).
//
// Поток:
//   1. Тянем линии всех БК (The Odds API) по выбранным рынкам.
//   2. Нормализуем в «линии» (h2h / тоталы / форы), берём лучший коэф. на исход.
//   3. Ищем вилки (arbitrage.findSurebets) и считаем раскладку ставок.
//   4. По найденным событиям — статистика (API-Football) + ИИ-разбор (Claude):
//      кому нужнее победа и какой исход вероятнее. Разбор кэшируется по событию.
//   5. Уведомляем о вилках выше порога и логируем в БД.

import { fetchOdds } from "../sources/oddsApi.js";
import { findTeam, teamForm, summarizeContext } from "../sources/apiFootball.js";
import { normalizeEventsMulti } from "./normalize.js";
import { findSurebets } from "./arbitrage.js";
import { readMatch, valueEdges } from "./motivation.js";
import { notifySurebets } from "../notify/telegram.js";
import { logSurebets } from "../store/supabase.js";
import { config, haveApiFootball, haveClaude } from "../config.js";

// Собрать контекст матча из API-Football (форма обеих команд).
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

// Обогатить линию ИИ-разбором. cache — Map(eventId → read), чтобы не дёргать
// Claude по каждой линии тотала одного и того же матча.
async function enrich(line, cache) {
  if (!haveClaude()) return line;
  let read = cache.get(line.id);
  if (read === undefined) {
    const context = await buildContext(line.home, line.away);
    read = await readMatch({ home: line.home, away: line.away, context });
    cache.set(line.id, read);
  }
  if (!read) return { ...line, ai: null };
  // value-перевес считаем только для 1X2 (Over/Under к именам команд не мапится).
  const edges = line.market === "h2h"
    ? valueEdges({ home: line.home, away: line.away }, read.probs, line.bestOutcomes)
    : [];
  return { ...line, ai: { ...read, edges } };
}

// Полный скан. opts:
//   sport        — ключ вида спорта The Odds API ("upcoming" | "soccer_epl" | ...)
//   markets      — рынки: ["h2h","totals","spreads"]
//   minMarginPct — минимальная маржа вилки, %
//   totalStake   — банк на событие
//   enrichAi     — обогащать ли ИИ-разбором (по умолчанию true)
//   notify       — слать ли уведомления в Telegram (по умолчанию true)
//   store        — логировать ли в Supabase (по умолчанию true)
//   fetchOddsFn  — инъекция источника (для тестов)
export async function scan({
  sport = "upcoming",
  markets = config.markets,
  minMarginPct = config.minMarginPct,
  totalStake = config.totalStake,
  enrichAi = true,
  notify = true,
  store = true,
  fetchOddsFn = fetchOdds
} = {}) {
  const raw = await fetchOddsFn(sport, { markets: markets.join(",") });
  const lines = normalizeEventsMulti(raw, markets);
  const surebets = findSurebets(lines, { minMarginPct, totalStake });

  const cache = new Map();
  const enriched = [];
  for (const sb of surebets) {
    enriched.push(enrichAi ? await enrich(sb, cache) : sb);
  }

  let notified = 0;
  let logged = 0;
  if (notify) notified = await notifySurebets(enriched);
  if (store) logged = await logSurebets(enriched);

  return { scanned: lines.length, found: enriched.length, notified, logged, surebets: enriched };
}

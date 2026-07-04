// Оркестратор: коэффициенты → нормализация → поиск вилок → ПРОГНОЗ (ансамбль:
// консенсус рынка + Пуассон + LLM) → уведомления (Telegram) и лог (Supabase).
//
// Поток:
//   1. Тянем линии всех БК (The Odds API) по выбранным рынкам.
//   2. Нормализуем в «линии» (h2h / тоталы / форы), берём лучший коэф. на исход.
//   3. Ищем вилки (arbitrage.findSurebets) и считаем раскладку ставок.
//   4. По найденным событиям строим прогноз из независимых источников:
//        • consensus — «честные» вероятности рынка без маржи (все БК);
//        • model     — модель Пуассона по средним голам (API-Football);
//        • ai        — разбор Claude (кому нужна победа / вероятный исход).
//      Смешиваем их в финальную вероятность и считаем value-перевес.
//   5. Уведомляем о вилках выше порога и логируем в БД (с прогнозом).

import { fetchOdds } from "../sources/oddsApi.js";
import { findTeam, teamForm, teamGoalAverages, summarizeContext } from "../sources/apiFootball.js";
import { normalizeEventsMulti } from "./normalize.js";
import { findSurebets } from "./arbitrage.js";
import { readMatch } from "./motivation.js";
import { marketConsensus } from "./devig.js";
import { lambdasFromAverages, outcomeProbs, totalsProbs } from "./poisson.js";
import { buildPrediction, hdaToNamed, ouToNamed, DEFAULT_WEIGHTS } from "./predict.js";
import { notifySurebets } from "../notify/telegram.js";
import { logSurebets } from "../store/supabase.js";
import { config, haveApiFootball, haveClaude } from "../config.js";

// Статистика матча из API-Football: текст-контекст для LLM + средние голов
// обеих команд для модели Пуассона. Без ключа/данных — пустые поля.
async function gatherStats(home, away) {
  if (!haveApiFootball()) return { context: "", homeAvg: null, awayAvg: null };
  try {
    const [ht, at] = await Promise.all([findTeam(home), findTeam(away)]);
    const [hf, af] = await Promise.all([
      ht ? teamForm(ht.id) : Promise.resolve([]),
      at ? teamForm(at.id) : Promise.resolve([])
    ]);
    return {
      context: summarizeContext({ home, away, homeForm: hf, awayForm: af, table: [] }),
      homeAvg: teamGoalAverages(hf, home),
      awayAvg: teamGoalAverages(af, away)
    };
  } catch (err) {
    console.warn(`Статистика ${home}–${away} не собрана: ${err.message}`);
    return { context: "", homeAvg: null, awayAvg: null };
  }
}

// Модель Пуассона → вероятности исходов для конкретной линии (или null).
function modelProbs(line, homeAvg, awayAvg) {
  if (!homeAvg || !awayAvg) return null;
  const lam = lambdasFromAverages({
    homeScoredAvg: homeAvg.scoredAvg, homeConcededAvg: homeAvg.concededAvg,
    awayScoredAvg: awayAvg.scoredAvg, awayConcededAvg: awayAvg.concededAvg
  });
  if (!lam) return null;
  const max = config.poissonMaxGoals;
  if (line.market === "h2h") {
    const p = outcomeProbs(lam.lh, lam.la, max);
    return hdaToNamed(p, line.home, line.away);
  }
  if (line.market === "totals" && line.point != null) {
    return ouToNamed(totalsProbs(lam.lh, lam.la, line.point, max));
  }
  return null; // форы моделью не прогнозируем
}

// Кэш собранных по событию данных (статистика + LLM-разбор), чтобы много линий
// тоталов одного матча не дёргали внешние API повторно. eventId → {stats, ai}.
async function gatherOnce(cache, line) {
  let bundle = cache.get(line.id);
  if (bundle) return bundle;
  const stats = await gatherStats(line.home, line.away);
  const ai = haveClaude()
    ? await readMatch({ home: line.home, away: line.away, context: stats.context })
    : null;
  bundle = { stats, ai };
  cache.set(line.id, bundle);
  return bundle;
}

// Прогноз для одной линии: собрать источники и смешать.
async function predictLine(line, rawEvent, cache, weights) {
  const { stats, ai } = await gatherOnce(cache, line);

  const sources = [];

  // 1) Консенсус рынка (все БК без маржи) — по именам исходов линии.
  const consensus = rawEvent ? marketConsensus(rawEvent, line.market) : null;
  if (consensus) sources.push({ label: "consensus", probs: consensus, weight: weights.consensus });

  // 2) Модель Пуассона.
  const model = modelProbs(line, stats.homeAvg, stats.awayAvg);
  if (model) sources.push({ label: "model", probs: model, weight: weights.model });

  // 3) LLM (только для h2h — даёт вероятности 1X2).
  if (ai && line.market === "h2h") {
    sources.push({ label: "ai", probs: hdaToNamed(ai.probs, line.home, line.away), weight: weights.ai });
  }

  const prediction = buildPrediction({ sources, bestOutcomes: line.bestOutcomes });
  return { ...line, ai: ai || null, prediction };
}

// Полный скан. opts:
//   sport, markets, minMarginPct, totalStake — параметры отбора вилок
//   enrichAi — строить ли прогноз (по умолчанию true)
//   notify   — слать ли уведомления в Telegram
//   store    — логировать ли в Supabase
//   weights  — веса ансамбля (по умолчанию из config)
//   fetchOddsFn — инъекция источника (для тестов)
export async function scan({
  sport = "upcoming",
  markets = config.markets,
  minMarginPct = config.minMarginPct,
  totalStake = config.totalStake,
  enrichAi = true,
  notify = true,
  store = true,
  weights = config.weights || DEFAULT_WEIGHTS,
  fetchOddsFn = fetchOdds
} = {}) {
  const raw = await fetchOddsFn(sport, { markets: markets.join(",") });
  const byId = new Map((raw || []).map(ev => [ev.id, ev]));
  const lines = normalizeEventsMulti(raw, markets);
  const surebets = findSurebets(lines, { minMarginPct, totalStake });

  const cache = new Map();
  const enriched = [];
  for (const sb of surebets) {
    enriched.push(enrichAi ? await predictLine(sb, byId.get(sb.id), cache, weights) : sb);
  }

  let notified = 0;
  let logged = 0;
  if (notify) notified = await notifySurebets(enriched);
  if (store) logged = await logSurebets(enriched);

  return { scanned: lines.length, found: enriched.length, notified, logged, surebets: enriched };
}

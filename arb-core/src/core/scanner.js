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
import { bookTier, bookWeight } from "./sharpness.js";
import { withinWindow } from "../util/time.js";
import { restrictBestOutcomes } from "./mybooks.js";
import { upsertPredictions } from "../store/localLog.js";
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
// Гейт: минимум 3 сыгранных матча у каждой команды — иначе средние по голам
// слишком шумные и модель врёт (особенно на межлиговых матчах).
const MODEL_MIN_GAMES = 3;
function modelProbs(line, homeAvg, awayAvg) {
  if (!homeAvg || !awayAvg) return null;
  if ((homeAvg.games || 0) < MODEL_MIN_GAMES || (awayAvg.games || 0) < MODEL_MIN_GAMES) return null;
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
// consensusOnly=true — только консенсус рынка (мгновенно, без затрат на
// API-Football/Claude); нужен для сканирования value по всем событиям.
async function predictLine(line, rawEvent, cache, weights, { consensusOnly = false } = {}) {
  const sources = [];

  // 1) Консенсус рынка (все БК без маржи) — строго в пределах линии события
  //    (для тоталов — по конкретному point), с весом в пользу резких контор.
  const consensus = rawEvent
    ? marketConsensus(rawEvent, line.market, line.point ?? null, bookWeight)
    : null;
  if (consensus) sources.push({ label: "consensus", probs: consensus, weight: weights.consensus });

  let ai = null;
  if (!consensusOnly) {
    const bundle = await gatherOnce(cache, line);
    ai = bundle.ai;
    // 2) Модель Пуассона.
    const model = modelProbs(line, bundle.stats.homeAvg, bundle.stats.awayAvg);
    if (model) sources.push({ label: "model", probs: model, weight: weights.model });
    // 3) LLM (только для h2h — даёт вероятности 1X2).
    if (ai && line.market === "h2h") {
      sources.push({ label: "ai", probs: hdaToNamed(ai.probs, line.home, line.away), weight: weights.ai });
    }
  }

  const prediction = buildPrediction({ sources, bestOutcomes: line.bestOutcomes });
  return { ...line, ai, prediction };
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
  maxHours = config.maxHours,
  weights = config.weights || DEFAULT_WEIGHTS,
  fetchOddsFn = fetchOdds,
  nowMs = Date.now()
} = {}) {
  const raw = await fetchOddsFn(sport, { markets: markets.join(",") });
  const byId = new Map((raw || []).map(ev => [ev.id, ev]));
  const lines = normalizeEventsMulti(raw, markets)
    .filter(l => withinWindow(l.commence, nowMs, maxHours))
    // Рекомендация/вилка — только среди моих контор (если список задан).
    .map(l => ({ ...l, bestOutcomes: restrictBestOutcomes(l.bestOutcomes, config.myBooks) }));
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

  return { scanned: lines.length, found: enriched.length, notified, logged, windowHours: maxHours, surebets: enriched };
}

// Скан value-ставок: прогноз по ВСЕМ событиям (не только вилкам) и отбор тех,
// где лучший коэффициент выгоднее честной вероятности рынка (перевес ≥ порога).
// Работает даже когда чистых вилок нет. По умолчанию — только консенсус рынка
// (мгновенно, без затрат на статистику/LLM); enrichAi=true добавляет Пуассон+LLM.
// Порог value зависит от резкости конторы, где стоит ставка: у софт-контор
// щедрость обманчива → требуем перевес выше; у резких — обычный порог.
// opts: sport, markets, minEdgePct, minEdgeSoftPct, sharpOnly, enrichAi, weights, fetchOddsFn.
export async function scanValue({
  sport = "upcoming",
  markets = config.markets,
  minEdgePct = config.minEdgePct,
  minEdgeSoftPct = config.minEdgeSoftPct,
  minProb = config.minProb,
  sharpOnly = false,
  enrichAi = false,
  maxHours = config.maxHours,
  weights = config.weights || DEFAULT_WEIGHTS,
  logFile = null,        // путь к predictions.jsonl — писать прогнозы для грейдинга
  fetchOddsFn = fetchOdds,
  nowMs = Date.now()
} = {}) {
  const raw = await fetchOddsFn(sport, { markets: markets.join(",") });
  const byId = new Map((raw || []).map(ev => [ev.id, ev]));
  const lines = normalizeEventsMulti(raw, markets)
    .filter(l => withinWindow(l.commence, nowMs, maxHours))
    // Рекомендация — только среди моих контор (если список задан).
    .map(l => ({ ...l, bestOutcomes: restrictBestOutcomes(l.bestOutcomes, config.myBooks) }));

  const cache = new Map();
  const values = [];
  const logRecords = [];
  for (const line of lines) {
    const p = await predictLine(line, byId.get(line.id), cache, weights, { consensusOnly: !enrichAi });
    const edges = (p.prediction && p.prediction.edges) || [];

    // Выбираем лучший value-исход, проходящий фильтры. Ключевое: minProb режет
    // лонгшоты — исходы с низкой вероятностью (@20, ничьи в боксе), которые
    // проигрывают почти всегда, даже будучи «выгодными».
    let chosen = null;
    for (const e of edges) { // отсортированы по перевесу убыв.
      if (minProb && e.modelProb < minProb * 100) continue;
      const tier = bookTier(e.bookmaker);
      if (sharpOnly && tier !== "sharp") continue;
      const threshold = tier === "sharp" ? minEdgePct : minEdgeSoftPct;
      if (e.edgePct < threshold) continue;
      chosen = { ...e, tier };
      break;
    }
    if (chosen) values.push({ ...p, valueBet: chosen });

    // Логируем прогноз по КАЖДОЙ линии — для честной оценки калибровки.
    if (logFile && p.prediction && p.prediction.probs) {
      logRecords.push({
        event_id: line.id, sport: line.sport, market: line.market,
        line: line.line, point: line.point ?? null,
        home: line.home, away: line.away, commence: line.commence,
        probs: p.prediction.probs,
        valueBet: chosen
          ? { name: chosen.name, odds: chosen.odds, bookmaker: chosen.bookmaker, edgePct: chosen.edgePct, tier: chosen.tier }
          : null,
        logged_at: new Date(nowMs).toISOString()
      });
    }
  }
  values.sort((a, b) => b.valueBet.edgePct - a.valueBet.edgePct);

  let logged = null;
  if (logFile && logRecords.length) logged = upsertPredictions(logFile, logRecords);

  return { scanned: lines.length, found: values.length, windowHours: maxHours, logged, values };
}

// Безопасные пики для лесенки: по каждому событию берём самый вероятный исход
// (фаворита) среди моих контор с шансом ≥ minProb. Сортировка по вероятности
// убыв. (безопасные первыми). Возвращает массив пиков для buildLadder.
export async function scanLadderPicks({
  sport = "upcoming",
  markets = ["h2h"],
  minProb = 0.6,
  maxHours = config.maxHours,
  weights = config.weights || DEFAULT_WEIGHTS,
  fetchOddsFn = fetchOdds,
  nowMs = Date.now()
} = {}) {
  const raw = await fetchOddsFn(sport, { markets: markets.join(",") });
  const byId = new Map((raw || []).map(ev => [ev.id, ev]));
  const lines = normalizeEventsMulti(raw, markets)
    .filter(l => withinWindow(l.commence, nowMs, maxHours))
    .map(l => ({ ...l, bestOutcomes: restrictBestOutcomes(l.bestOutcomes, config.myBooks) }));

  const cache = new Map();
  const picks = [];
  for (const line of lines) {
    const p = await predictLine(line, byId.get(line.id), cache, weights, { consensusOnly: true });
    if (!p.prediction || !p.prediction.probs) continue;
    // Самый вероятный исход среди доступных у моих контор.
    let best = null;
    for (const o of line.bestOutcomes) {
      const prob = p.prediction.probs[o.name];
      if (prob == null) continue;
      if (!best || prob > best.prob) best = { name: o.name, odds: o.odds, bookmaker: o.bookmaker, prob };
    }
    if (best && best.prob >= minProb) {
      picks.push({
        home: line.home, away: line.away, sport: line.sport, commence: line.commence,
        market: line.market, point: line.point ?? null, ...best
      });
    }
  }
  picks.sort((a, b) => b.prob - a.prob); // безопасные первыми
  return picks;
}

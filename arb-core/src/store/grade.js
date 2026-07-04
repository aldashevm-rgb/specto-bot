// Грейдинг прогноза по факту матча — измеряет точность (Brier, log-loss) и
// пишет результат обратно в Supabase. Так со временем видно, насколько
// откалиброван ансамбль и какие веса источников работают.

import { brierScore, logLoss } from "../core/blend.js";
import { config, haveSupabase } from "../config.js";
import { withRetry } from "../util/http.js";

// Имя-победитель для h2h из фактического исхода. probs хранятся по именам
// (home team / "Draw" / away team), а результат приходит как home|draw|away.
export function winnerName(outcome, home, away, drawName = "Draw") {
  if (outcome === "home") return home;
  if (outcome === "away") return away;
  if (outcome === "draw") return drawName;
  return null;
}

// Чистая оценка прогноза против фактического победителя (по имени исхода).
// Возвращает { brier, logLoss, correct } или null.
export function gradePrediction(probs, winnerKey) {
  if (!probs || !winnerKey || probs[winnerKey] == null) return null;
  // Предсказанный исход — с максимальной вероятностью.
  let best = null, bestP = -1;
  for (const [k, v] of Object.entries(probs)) {
    if (v > bestP) { bestP = v; best = k; }
  }
  return {
    brier: brierScore(probs, winnerKey),
    logLoss: logLoss(probs, winnerKey),
    correct: best === winnerKey
  };
}

// Патч строки в Supabase (по event_id/market/line). Best-effort.
export async function patchGrade({ eventId, market, line }, patch) {
  if (!haveSupabase()) return false;
  const base = config.supabaseUrl.replace(/\/$/, "");
  const params = new URLSearchParams({
    event_id: `eq.${eventId}`,
    market: `eq.${market}`
  });
  // line может быть null — PostgREST требует is.null.
  params.append("line", line == null ? "is.null" : `eq.${line}`);
  const url = `${base}/rest/v1/${config.supabaseTable}?${params}`;
  try {
    await withRetry(
      async () => {
        const res = await fetch(url, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            apikey: config.supabaseKey,
            Authorization: `Bearer ${config.supabaseKey}`,
            Prefer: "return=minimal"
          },
          body: JSON.stringify(patch)
        });
        if (!res.ok) {
          const body = await res.text();
          const err = new Error(`Supabase PATCH ${res.status}: ${body}`);
          err.status = res.status;
          throw err;
        }
        return true;
      },
      { retries: 2, baseMs: 700, label: "Supabase grade", retryOn: e => !e.status || e.status >= 500 || e.status === 429 }
    );
    return true;
  } catch (err) {
    console.error("Ошибка грейдинга в Supabase:", err.message);
    return false;
  }
}

// Собрать патч результата для строки прогноза (h2h). Чистая функция.
// row — { pred_probs, home, away }; outcome — home|draw|away; nowIso — метка.
export function buildGradePatch(row, outcome, nowIso) {
  const wk = winnerName(outcome, row.home, row.away);
  const g = gradePrediction(row.pred_probs, wk);
  return {
    actual_outcome: outcome,
    brier: g ? g.brier : null,
    log_loss: g ? g.logLoss : null,
    graded_at: nowIso
  };
}

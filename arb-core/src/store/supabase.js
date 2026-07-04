// Лог найденных вилок в Supabase (через PostgREST — без доп. зависимостей).
// Схема таблицы — в schema.sql. Позволяет копить историю и потом сверять
// ИИ-прогноз (кому нужна победа / вероятный исход) с реальными результатами.

import { config, haveSupabase } from "../config.js";
import { withRetry } from "../util/http.js";

// Вилка → строка таблицы arb_surebets. Чистая функция — тестируется без сети.
export function buildRow(sb) {
  const ai = sb.ai || null;
  return {
    event_id: sb.id,
    sport: sb.sport,
    market: sb.market,
    line: sb.line || null,
    home: sb.home,
    away: sb.away,
    commence: sb.commence || null,
    margin_pct: sb.arb.marginPct,
    roi_pct: sb.arb.roi,
    invested: sb.arb.invested,
    guaranteed_payout: sb.arb.guaranteedPayout,
    profit: sb.arb.profit,
    legs: sb.arb.legs,                       // jsonb
    ai_needs_win: ai ? ai.needsWin : null,
    ai_likely: ai ? ai.likelyOutcome : null,
    ai_confidence: ai ? ai.confidence : null,
    ai_probs: ai ? ai.probs : null,          // jsonb
    ai_reasoning: ai ? ai.reasoning : null
  };
}

// Вставить строки. upsert по (event_id, market, line) — повторный скан не плодит
// дубли. Возвращает число записанных или 0 при ошибке/отсутствии ключей.
export async function logSurebets(surebets = []) {
  if (!haveSupabase() || surebets.length === 0) return 0;
  const rows = surebets.map(buildRow);
  const url = `${config.supabaseUrl.replace(/\/$/, "")}/rest/v1/${config.supabaseTable}` +
    `?on_conflict=event_id,market,line`;
  try {
    await withRetry(
      async () => {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: config.supabaseKey,
            Authorization: `Bearer ${config.supabaseKey}`,
            Prefer: "resolution=merge-duplicates,return=minimal"
          },
          body: JSON.stringify(rows)
        });
        if (!res.ok) {
          const body = await res.text();
          const err = new Error(`Supabase ${res.status}: ${body}`);
          err.status = res.status;
          throw err;
        }
        return true;
      },
      { retries: 2, baseMs: 700, label: "Supabase", retryOn: e => !e.status || e.status >= 500 || e.status === 429 }
    );
    return rows.length;
  } catch (err) {
    console.error("Ошибка записи в Supabase:", err.message);
    return 0;
  }
}

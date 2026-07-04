// Конфигурация ядра из переменных окружения. Одна точка правды.

import { loadEnv } from "./util/loadEnv.js";

// Подхватываем arb-core/.env (если есть) до чтения переменных ниже.
// Реальные переменные окружения имеют приоритет над файлом.
loadEnv(new URL("../.env", import.meta.url));

// "h2h,totals,spreads" → ["h2h","totals","spreads"]
function parseMarkets(raw) {
  return String(raw || "h2h")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
}

export const config = {
  // The Odds API — коэффициенты букмекеров. https://the-odds-api.com
  oddsApiKey: process.env.ODDS_API_KEY || "",
  oddsApiBase: process.env.ODDS_API_BASE || "https://api.the-odds-api.com/v4",

  // API-Football — статистика, составы, турнирные таблицы (мотивация).
  apiFootballKey: process.env.API_FOOTBALL_KEY || "",
  apiFootballBase: process.env.API_FOOTBALL_BASE || "https://v3.football.api-sports.io",

  // Claude — ИИ-анализ «кому нужна победа / вероятный исход».
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  claudeModel: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",

  // Telegram — уведомления о вилках выше порога.
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID || "",
  notifyMinMarginPct: Number(process.env.ARB_NOTIFY_MARGIN) || 1.0, // порог уведомления, %

  // Supabase — лог найденных вилок для аналитики точности ИИ-прогноза.
  supabaseUrl: process.env.SUPABASE_URL || "",
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  supabaseTable: process.env.ARB_TABLE || "arb_surebets",

  // Веса ансамбля прогноза: консенсус рынка / модель Пуассона / LLM.
  weights: {
    consensus: Number(process.env.ARB_W_CONSENSUS ?? 0.5),
    model: Number(process.env.ARB_W_MODEL ?? 0.3),
    ai: Number(process.env.ARB_W_AI ?? 0.2)
  },
  poissonMaxGoals: Number(process.env.ARB_POISSON_MAXGOALS) || 10,

  // Параметры сканера.
  minMarginPct: Number(process.env.ARB_MIN_MARGIN) || 0.5, // мин. маржа вилки, %
  minEdgePct: Number(process.env.ARB_MIN_EDGE) || 2,       // мин. value-перевес, %
  totalStake: Number(process.env.ARB_STAKE) || 1000,       // банк на событие
  region: process.env.ODDS_REGION || "eu",                 // регион БК
  markets: parseMarkets(process.env.ODDS_MARKET || "h2h,totals") // рынки: h2h,totals,spreads
};

export function haveOddsApi() {
  return Boolean(config.oddsApiKey);
}
export function haveApiFootball() {
  return Boolean(config.apiFootballKey);
}
export function haveClaude() {
  return Boolean(config.anthropicKey);
}
export function haveTelegram() {
  return Boolean(config.telegramToken && config.telegramChatId);
}
export function haveSupabase() {
  return Boolean(config.supabaseUrl && config.supabaseKey);
}

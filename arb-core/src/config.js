// Конфигурация ядра из переменных окружения. Одна точка правды.

import { fileURLToPath } from "node:url";
import { loadEnv } from "./util/loadEnv.js";

// Подхватываем arb-core/.env (если есть) до чтения переменных ниже.
// Реальные переменные окружения имеют приоритет над файлом.
loadEnv(new URL("../.env", import.meta.url));

function enabledEnv(name) {
  return ["1", "true", "yes"].includes(String(process.env[name] || "").toLowerCase());
}

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
  // Консенсус рынка — самый точный предиктор, поэтому доминирует. Пуассон на
  // форме из 5 матчей слаб → малый вес, чтобы не раздувать фейковые перевесы.
  weights: {
    consensus: Number(process.env.ARB_W_CONSENSUS ?? 0.7),
    model: Number(process.env.ARB_W_MODEL ?? 0.15),
    ai: Number(process.env.ARB_W_AI ?? 0.15)
  },
  poissonMaxGoals: Number(process.env.ARB_POISSON_MAXGOALS) || 10,

  // Параметры сканера.
  minMarginPct: Number(process.env.ARB_MIN_MARGIN) || 0.5, // мин. маржа вилки, %
  minEdgePct: Number(process.env.ARB_MIN_EDGE) || 2,       // мин. value-перевес у резких контор, %
  minEdgeSoftPct: Number(process.env.ARB_MIN_EDGE_SOFT) || 4, // выше порог у софт-контор, %
  maxHours: Number(process.env.ARB_MAX_HOURS ?? 72),       // окно до матча, ч (0 = без ограничения)

  // Автогрейдинг: локальный лог прогнозов и окно результатов The Odds API.
  logFile: process.env.ARB_LOG_FILE || fileURLToPath(new URL("../predictions.jsonl", import.meta.url)),
  scoresDaysFrom: Number(process.env.ARB_SCORES_DAYS) || 3, // за сколько суток брать результаты (1–3)

  // Kelly-стейкинг: размер ставки от банка для value-ставок.
  bankroll: Number(process.env.ARB_BANKROLL) || 1000,
  kellyFraction: Number(process.env.ARB_KELLY_FRACTION ?? 0.25),   // четверть-Кельли
  kellyMaxFraction: Number(process.env.ARB_KELLY_MAX ?? 0.05),     // потолок 5% банка/ставка

  // Автоставка через биржу Betfair (с подтверждением кнопкой в Telegram).
  // ПО УМОЛЧАНИЮ ВЫКЛ и DRY-RUN — реальные деньги не трогаются, пока сам не включишь.
  betting: {
    enabled: enabledEnv("BETTING_ENABLED"),                        // мастер-выключатель
    dryRun: process.env.BETTING_DRY_RUN !== "0",                   // по умолчанию dry-run
    maxStake: Number(process.env.BETTING_MAX_STAKE) || 20,         // потолок на ставку
    dailyCap: Number(process.env.BETTING_DAILY_CAP) || 100,        // дневной лимит суммарно
    confirmTtlMs: (Number(process.env.BETTING_CONFIRM_TTL_MIN) || 15) * 60000,
    betfair: {
      appKey: process.env.BETFAIR_APP_KEY || "",
      username: process.env.BETFAIR_USERNAME || "",
      password: process.env.BETFAIR_PASSWORD || ""
    }
  },
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
export function haveBetfair() {
  const b = config.betting.betfair;
  return Boolean(b.appKey && b.username && b.password);
}

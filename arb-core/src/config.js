// Конфигурация ядра из переменных окружения. Одна точка правды.

export const config = {
  // The Odds API — коэффициенты букмекеров. https://the-odds-api.com
  oddsApiKey: process.env.ODDS_API_KEY || "",
  oddsApiBase: process.env.ODDS_API_BASE || "https://api.the-odds-api.com/v4",

  // API-Football — статистика, составы, турнирные таблицы (мотивация).
  // https://www.api-football.com  (через RapidAPI или напрямую)
  apiFootballKey: process.env.API_FOOTBALL_KEY || "",
  apiFootballBase: process.env.API_FOOTBALL_BASE || "https://v3.football.api-sports.io",

  // Claude — ИИ-анализ «кому нужна победа / вероятный исход».
  anthropicKey: process.env.ANTHROPIC_API_KEY || "",
  claudeModel: process.env.CLAUDE_MODEL || "claude-sonnet-4-6",

  // Параметры сканера.
  minMarginPct: Number(process.env.ARB_MIN_MARGIN) || 0.5, // мин. маржа вилки, %
  totalStake: Number(process.env.ARB_STAKE) || 1000,       // банк на событие
  region: process.env.ODDS_REGION || "eu",                 // регион БК
  market: process.env.ODDS_MARKET || "h2h"                 // рынок (1X2)
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

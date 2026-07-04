// Источник коэффициентов: The Odds API (v4).
// Отдаёт события с линиями всех БК в регионе — сырьё для поиска вилок.

import { getJson } from "../util/http.js";
import { config } from "../config.js";

// Список доступных видов спорта (для выбора, что сканировать).
export async function listSports() {
  if (!config.oddsApiKey) throw new Error("ODDS_API_KEY не задан");
  const url = `${config.oddsApiBase}/sports/?apiKey=${config.oddsApiKey}`;
  return getJson(url, { label: "odds/sports" });
}

// Коэффициенты по виду спорта. sport — ключ вида (напр. "soccer_epl",
// "soccer" для всех футбольных, "upcoming" для ближайших любых).
// Возвращает сырой массив событий The Odds API.
export async function fetchOdds(sport = "upcoming", {
  regions = config.region,
  markets = config.market,
  oddsFormat = "decimal"
} = {}) {
  if (!config.oddsApiKey) throw new Error("ODDS_API_KEY не задан");
  const params = new URLSearchParams({
    apiKey: config.oddsApiKey,
    regions,
    markets,
    oddsFormat,
    dateFormat: "iso"
  });
  const url = `${config.oddsApiBase}/sports/${encodeURIComponent(sport)}/odds/?${params}`;
  return getJson(url, { label: "odds/odds" });
}

// Результаты матчей за последние daysFrom суток (1–3). Те же event_id, что и в
// /odds — для грейдинга прогноза. Возвращает события с полями completed и scores.
export async function fetchScores(sport, { daysFrom = 3 } = {}) {
  if (!config.oddsApiKey) throw new Error("ODDS_API_KEY не задан");
  const params = new URLSearchParams({
    apiKey: config.oddsApiKey,
    daysFrom: String(Math.max(1, Math.min(3, daysFrom))),
    dateFormat: "iso"
  });
  const url = `${config.oddsApiBase}/sports/${encodeURIComponent(sport)}/scores/?${params}`;
  return getJson(url, { label: "odds/scores" });
}

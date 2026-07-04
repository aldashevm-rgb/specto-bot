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

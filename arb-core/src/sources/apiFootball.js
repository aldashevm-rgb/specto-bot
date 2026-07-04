// Источник статистики: API-Football (v3).
// Даёт контекст для ИИ-анализа мотивации: турнирная таблица (кому нужнее очки),
// форма команд, история личных встреч. Используется как «начинка» для вилки.

import { getJson } from "../util/http.js";
import { config } from "../config.js";

function headers() {
  if (!config.apiFootballKey) throw new Error("API_FOOTBALL_KEY не задан");
  // API-Football принимает ключ либо напрямую, либо через RapidAPI.
  return { "x-apisports-key": config.apiFootballKey };
}

// Найти команду по имени (id нужен для остальных запросов).
export async function findTeam(name) {
  const url = `${config.apiFootballBase}/teams?search=${encodeURIComponent(name)}`;
  const data = await getJson(url, { headers: headers(), label: "af/teams" });
  return data?.response?.[0]?.team || null;
}

// Последние N матчей команды — «форма».
export async function teamForm(teamId, last = 5) {
  const url = `${config.apiFootballBase}/fixtures?team=${teamId}&last=${last}`;
  const data = await getJson(url, { headers: headers(), label: "af/form" });
  return data?.response || [];
}

// Позиция команды в таблице лиги (кому нужнее очки — сигнал мотивации).
export async function standings(leagueId, season) {
  const url = `${config.apiFootballBase}/standings?league=${leagueId}&season=${season}`;
  const data = await getJson(url, { headers: headers(), label: "af/standings" });
  return data?.response?.[0]?.league?.standings?.[0] || [];
}

// Средние голы команды по последним матчам (для модели Пуассона).
// fixtures — ответ teamForm(); teamName — имя команды. null, если нет данных.
export function teamGoalAverages(fixtures = [], teamName) {
  let scored = 0, conceded = 0, n = 0;
  for (const f of fixtures) {
    const g = f.goals || {};
    if (g.home == null || g.away == null) continue;
    const isHome = f.teams?.home?.name === teamName;
    scored += isHome ? g.home : g.away;
    conceded += isHome ? g.away : g.home;
    n += 1;
  }
  if (!n) return null;
  return { scoredAvg: scored / n, concededAvg: conceded / n, games: n };
}

// Результат завершённого матча по fixture id (для грейдинга прогноза).
// Возвращает { status, home, away, outcome } или null. outcome: home|draw|away.
export async function fixtureResult(fixtureId) {
  const url = `${config.apiFootballBase}/fixtures?id=${fixtureId}`;
  const data = await getJson(url, { headers: headers(), label: "af/result" });
  const f = data?.response?.[0];
  if (!f) return null;
  const status = f.fixture?.status?.short;
  if (status !== "FT" && status !== "AET" && status !== "PEN") return { status, outcome: null };
  const g = f.goals || {};
  if (g.home == null || g.away == null) return { status, outcome: null };
  const outcome = g.home > g.away ? "home" : g.home < g.away ? "away" : "draw";
  return { status, home: g.home, away: g.away, outcome };
}

// Свести контекст матча в компактную сводку для промпта ИИ.
// Возвращает строку вида: форма, позиции, очки — то, из чего модель делает вывод.
export function summarizeContext({ home, away, homeForm = [], awayForm = [], table = [] } = {}) {
  const formLine = (name, fixtures) => {
    const res = fixtures.slice(0, 5).map(f => {
      const g = f.goals || {};
      const isHome = f.teams?.home?.name === name;
      const my = isHome ? g.home : g.away;
      const opp = isHome ? g.away : g.home;
      if (my == null || opp == null) return "?";
      return my > opp ? "В" : my < opp ? "П" : "Н";
    });
    return `${name}: форма ${res.join("") || "нет данных"}`;
  };

  const pos = (name) => {
    const row = table.find(r => r.team?.name === name);
    return row ? `${name}: ${row.rank} место, ${row.points} очк.` : `${name}: позиция неизвестна`;
  };

  return [
    formLine(home, homeForm),
    formLine(away, awayForm),
    pos(home),
    pos(away)
  ].join("\n");
}

// Локальный веб-дашборд: поднимает страницу на localhost, где всё видно и есть
// кнопки управления. Встроенный http-сервер Node — без зависимостей и без облака.
// Запуск: npm run web  →  открыть http://localhost:3010 в браузере.

import http from "node:http";
import { scan, scanValue } from "./core/scanner.js";
import { fetchOdds } from "./sources/oddsApi.js";
import { readLog } from "./store/localLog.js";
import { summarizeGrades } from "./store/grade.js";
import { renderDashboardHtml } from "./render.js";
import { haveOddsApi, haveApiFootball, haveClaude, haveTelegram, config } from "./config.js";

const PORT = Number(process.env.ARB_WEB_PORT) || 3010;

// Собрать данные дашборда по query-параметрам (один запрос коэффициентов).
async function buildData(params) {
  const sport = params.get("sport") || "upcoming";
  const enrichAi = params.get("ai") === "1";
  const sharpOnly = params.get("sharp") === "1";
  const maxHours = params.has("hours") ? Number(params.get("hours")) : config.maxHours;
  const bankroll = params.has("bank") ? Number(params.get("bank")) : config.bankroll;
  const minEdgePct = params.has("edge") ? Number(params.get("edge")) : config.minEdgePct;

  const raw = await fetchOdds(sport, { markets: config.markets.join(",") });
  const once = async () => raw;

  const sure = await scan({
    sport, markets: config.markets, minMarginPct: config.minMarginPct,
    maxHours, enrichAi, notify: false, store: false, fetchOddsFn: once
  });
  const val = await scanValue({
    sport, markets: config.markets, minEdgePct, sharpOnly, enrichAi, maxHours,
    logFile: config.logFile, fetchOddsFn: once
  });
  const graded = readLog(config.logFile).filter(r => r.graded_at);
  const accuracy = summarizeGrades(graded.map(r => ({
    brier: r.brier, logLoss: r.log_loss, correct: r.correct, betWon: r.bet_won, betProfit: r.bet_profit
  })));

  return {
    sport,
    settings: {
      maxHours, bankroll, minEdgePct, minMarginPct: config.minMarginPct,
      minEdgeSoftPct: config.minEdgeSoftPct, sharpOnly, enrichAi, markets: config.markets,
      kellyFraction: config.kellyFraction, kellyMax: config.kellyMaxFraction,
      sources: { football: haveApiFootball(), claude: haveClaude(), telegram: haveTelegram() }
    },
    surebets: sure.surebets, values: val.values, accuracy
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (url.pathname === "/favicon.ico") { res.writeHead(204); res.end(); return; }
  if (url.pathname !== "/") { res.writeHead(404); res.end("not found"); return; }

  const html = (code, body) => {
    res.writeHead(code, { "Content-Type": "text/html; charset=utf-8" });
    res.end(body);
  };

  if (!haveOddsApi()) {
    html(500, "<h1>Нужен ODDS_API_KEY</h1><p>Впиши ключ в arb-core/.env (см. .env.example).</p>");
    return;
  }
  try {
    console.log(`→ скан: ${url.search || "(по умолчанию)"}`);
    html(200, renderDashboardHtml(await buildData(url.searchParams)));
  } catch (err) {
    console.error("Ошибка:", err.message);
    html(500, `<h1>Ошибка</h1><pre>${String(err.message).replace(/</g, "&lt;")}</pre>`);
  }
});

server.listen(PORT, () => {
  console.log(`\n  Дашборд открыт:  http://localhost:${PORT}\n`);
  console.log("  Открой этот адрес в браузере. Управление — прямо на странице.");
  console.log("  Ctrl+C — остановить.\n");
});

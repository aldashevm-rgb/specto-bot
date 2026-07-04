// Единый дашборд: за ОДИН проход (и один запрос коэффициентов) показывает
//   1) вилки (surebet),
//   2) value-ставки с размером ставки по Кельли,
//   3) точность прогноза по уже оценённым записям лога,
//   4) активные настройки и подсказку по управлению.
//
// Запуск: npm run dashboard [sport] [флаги]
// Флаги (после `--` при запуске через npm):
//   --hours=N     окно до матча в часах (0 = без окна)
//   --bank=N      размер банка для Кельли
//   --min-edge=N  порог value-перевеса у резких контор, %
//   --sharp       только value у резких контор
//   --ai          добавить модель Пуассона и LLM (нужны ключи, дольше)
//   --no-log      не писать прогнозы в predictions.jsonl

import { scan, scanValue } from "./core/scanner.js";
import { fetchOdds } from "./sources/oddsApi.js";
import { kellyStake } from "./core/kelly.js";
import { readLog } from "./store/localLog.js";
import { summarizeGrades } from "./store/grade.js";
import { haveOddsApi, haveApiFootball, haveClaude, haveTelegram, config } from "./config.js";

function flagVal(flags, name, fallback) {
  const f = flags.find(x => x.startsWith(`--${name}=`));
  return f ? Number(f.split("=")[1]) : fallback;
}

function hr(title) {
  console.log(`\n${"─".repeat(64)}\n${title}\n${"─".repeat(64)}`);
}

function printSurebet(sb, i) {
  const lineTag = sb.line ? `  {${sb.line}}` : "";
  console.log(`\n${i + 1}. ${sb.home} — ${sb.away}  [${sb.sport} · ${sb.market}]${lineTag}`);
  console.log(`   маржа ${sb.arb.marginPct}%, ROI ${sb.arb.roi}% · банк ${sb.arb.invested} → ` +
    `${sb.arb.guaranteedPayout} (профит ${sb.arb.profit})`);
  for (const l of sb.arb.legs) {
    console.log(`     • ${l.name} @ ${l.odds} (${l.bookmaker}) — ставка ${l.stake}`);
  }
}

function printValue(v, i, bankroll) {
  const b = v.valueBet;
  const tier = b.tier === "sharp" ? "РЕЗКАЯ" : "софт";
  const kickoff = v.commence ? new Date(v.commence).toLocaleString("ru-RU") : "?";
  const lineTag = v.line ? `  {${v.line}}` : "";
  console.log(`\n${i + 1}. ${v.home} — ${v.away}  [${v.sport} · ${v.market}]${lineTag}  ${kickoff}`);
  console.log(`   ➤ ${b.name} @ ${b.odds} (${b.bookmaker} · ${tier}) — перевес +${b.edgePct}%`);
  const p = v.prediction && v.prediction.probs[b.name];
  if (p != null) {
    const k = kellyStake(p, b.odds, {
      bankroll, fraction: config.kellyFraction, maxFraction: config.kellyMaxFraction
    });
    console.log(`     ставка ${k.stake} (${(k.fractionOfBank * 100).toFixed(1)}% банка, ` +
      `${config.kellyFraction}·Kelly) · модель ${Math.round(p * 100)}%`);
  }
}

async function main() {
  if (!haveOddsApi()) {
    console.error("Нужен ODDS_API_KEY (см. .env.example). Ключ: https://the-odds-api.com");
    process.exit(1);
  }
  const flags = process.argv.slice(2).filter(a => a.startsWith("--"));
  const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
  const sport = args[0] || "upcoming";
  const enrichAi = flags.includes("--ai");
  const sharpOnly = flags.includes("--sharp");
  const noLog = flags.includes("--no-log");
  const maxHours = flagVal(flags, "hours", config.maxHours);
  const bankroll = flagVal(flags, "bank", config.bankroll);
  const minEdgePct = flagVal(flags, "min-edge", config.minEdgePct);

  // Один запрос коэффициентов на весь дашборд (экономим квоту API).
  const raw = await fetchOdds(sport, { markets: config.markets.join(",") });
  const fetchOnce = async () => raw;

  hr("SPECTO ARB — ДАШБОРД");
  console.log(`Спорт: ${sport} · рынки [${config.markets.join(", ")}] · ` +
    `окно ${maxHours > 0 ? maxHours + "ч" : "выкл"} · банк ${bankroll}`);
  console.log(`Пороги: вилка ≥${config.minMarginPct}% · value резкие +${minEdgePct}% / софт +${config.minEdgeSoftPct}%` +
    `${sharpOnly ? " · только резкие" : ""}`);
  console.log(`Источники: Odds ✓ · Football ${haveApiFootball() ? "✓" : "—"} · ` +
    `Claude ${haveClaude() ? "✓" : "—"} · Telegram ${haveTelegram() ? "✓" : "—"} · ` +
    `прогноз ${enrichAi ? "консенсус+Пуассон+LLM" : "консенсус"}`);

  // 1) Вилки.
  const sure = await scan({
    sport, markets: config.markets, minMarginPct: config.minMarginPct,
    maxHours, enrichAi, notify: false, store: false, fetchOddsFn: fetchOnce
  });
  hr(`ВИЛКИ (surebet) — ${sure.found}`);
  if (sure.found) sure.surebets.forEach(printSurebet);
  else console.log("нет (это нормально — чистые вилки редки и живут секунды)");

  // 2) Value-ставки + размер по Кельли.
  const val = await scanValue({
    sport, markets: config.markets, minEdgePct, sharpOnly, enrichAi, maxHours,
    logFile: noLog ? null : config.logFile, fetchOddsFn: fetchOnce
  });
  hr(`VALUE-СТАВКИ — ${val.found}${val.logged ? ` (в лог +${val.logged.added})` : ""}`);
  if (val.found) val.values.forEach((v, i) => printValue(v, i, bankroll));
  else console.log("нет выше порога (на ликвидном рынке — обычное дело)");

  // 3) Точность по уже оценённым прогнозам (без запроса результатов — только лог).
  const graded = readLog(config.logFile).filter(r => r.graded_at);
  const s = summarizeGrades(graded.map(r => ({
    brier: r.brier, logLoss: r.log_loss, correct: r.correct, betWon: r.bet_won, betProfit: r.bet_profit
  })));
  hr("ТОЧНОСТЬ ПРОГНОЗА (по оценённым)");
  if (s.count) {
    console.log(`оценено ${s.count} · Brier ${s.brier} · hit rate ${s.hitRatePct}%` +
      (s.bets ? ` · value-ставки ${s.betWins}/${s.bets}, ROI ${s.betRoiPct >= 0 ? "+" : ""}${s.betRoiPct}%` : ""));
  } else {
    console.log("нет оценённых прогнозов. Копи прогнозы дашбордом, потом: npm run grade");
  }

  // 4) Управление.
  hr("УПРАВЛЕНИЕ");
  console.log("npm run dashboard <sport> -- [флаги]");
  console.log("  <sport>       soccer_epl | upcoming | soccer | basketball_nba …");
  console.log("  --hours=N     окно до матча, ч (0 = без окна)");
  console.log("  --bank=N      банк для расчёта ставки (Кельли)");
  console.log("  --min-edge=N  порог value-перевеса у резких контор, %");
  console.log("  --sharp       только value у резких контор (их не режут)");
  console.log("  --ai          + модель Пуассона и LLM (нужны ключи, дольше)");
  console.log("  --no-log      не писать прогнозы в лог");
  console.log("Отдельно: npm run grade  — точность по факту · npm run demo — пример без сети");
  console.log("Постоянные настройки — в .env (пороги, банк, Кельли, окно).");
}

main().catch(err => { console.error("Ошибка дашборда:", err.message); process.exit(1); });

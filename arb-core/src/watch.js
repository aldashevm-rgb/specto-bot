// Вотчер: периодически сканирует и шлёт в Telegram, КАК ТОЛЬКО появляется новая
// ставка (вилка или value выше порога). Дедуп — одна линия не спамит повторно.
// Работает и без Telegram: тогда просто печатает находки в консоль.
//
// Запуск: npm run watch [sport] [флаги]   (те же флаги, что и у dashboard)
// Интервал: ARB_WATCH_MS (мс) или --every=МИНУТЫ. Ctrl+C — остановить.
//
// ВНИМАНИЕ про квоту: каждый цикл = 1 запрос к The Odds API. На free-тарифе
// (~500 запросов/мес) непрерывный вотч не проживёт — запускай точечно перед
// турами или ставь большой интервал (см. оценку при старте).

import { scan, scanValue } from "./core/scanner.js";
import { fetchOdds } from "./sources/oddsApi.js";
import { notifySurebets, notifyValues } from "./notify/telegram.js";
import { surebetKey, valueKey, pickNew } from "./notify/dedup.js";
import { haveOddsApi, haveTelegram, config } from "./config.js";

function flagVal(flags, name, fallback) {
  const f = flags.find(x => x.startsWith(`--${name}=`));
  return f ? Number(f.split("=")[1]) : fallback;
}

async function tick(opts, seen) {
  const raw = await fetchOdds(opts.sport, { markets: config.markets.join(",") });
  const once = async () => raw;

  const sure = await scan({
    sport: opts.sport, markets: config.markets, minMarginPct: config.minMarginPct,
    maxHours: opts.maxHours, enrichAi: false, notify: false, store: false, fetchOddsFn: once
  });
  const val = await scanValue({
    sport: opts.sport, markets: config.markets, minEdgePct: opts.minEdgePct,
    sharpOnly: opts.sharpOnly, maxHours: opts.maxHours, enrichAi: false,
    logFile: config.logFile, fetchOddsFn: once
  });

  const newSure = pickNew(sure.surebets, seen, surebetKey);
  const newVal = pickNew(val.values, seen, valueKey);

  const ts = new Date().toLocaleTimeString("ru-RU");
  console.log(`[${ts}] линий ${val.scanned} · вилки ${sure.found} (нов ${newSure.length}) · ` +
    `value ${val.found} (нов ${newVal.length})`);

  for (const sb of newSure) {
    console.log(`  🎯 вилка ${sb.arb.marginPct}%: ${sb.home} — ${sb.away} [${sb.market}]`);
  }
  for (const v of newVal) {
    const b = v.valueBet;
    console.log(`  💡 +${b.edgePct}% ${b.tier === "sharp" ? "резкая" : "софт"}: ${v.home} — ${v.away} → ${b.name} @ ${b.odds} (${b.bookmaker})`);
  }

  if (haveTelegram()) {
    const kelly = { bankroll: opts.bankroll, fraction: config.kellyFraction, maxFraction: config.kellyMaxFraction };
    const s = await notifySurebets(newSure);
    const vv = await notifyValues(newVal, kelly);
    if (s + vv) console.log(`  → отправлено в Telegram: ${s + vv}`);
  }
}

async function main() {
  if (!haveOddsApi()) {
    console.error("Нужен ODDS_API_KEY (см. .env.example).");
    process.exit(1);
  }
  const flags = process.argv.slice(2).filter(a => a.startsWith("--"));
  const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
  const everyMin = flags.find(f => f.startsWith("--every="));
  const intervalMs = everyMin ? Number(everyMin.split("=")[1]) * 60000 : (Number(process.env.ARB_WATCH_MS) || 30 * 60000);

  const opts = {
    sport: args[0] || "upcoming",
    sharpOnly: flags.includes("--sharp"),
    maxHours: flagVal(flags, "hours", config.maxHours),
    bankroll: flagVal(flags, "bank", config.bankroll),
    minEdgePct: flagVal(flags, "min-edge", config.minEdgePct)
  };

  const perDay = Math.round((24 * 60 * 60000) / intervalMs);
  console.log(`Вотчер: ${opts.sport} · окно ${opts.maxHours > 0 ? opts.maxHours + "ч" : "выкл"} · ` +
    `интервал ${Math.round(intervalMs / 60000)}мин${opts.sharpOnly ? " · только резкие" : ""}`);
  console.log(`Telegram: ${haveTelegram() ? "ВКЛ" : "ВЫКЛ (шлём только в консоль; задай TELEGRAM_BOT_TOKEN/CHAT_ID)"}.`);
  console.log(`≈${perDay} запросов/сутки (~${perDay * 30}/мес). Free-тариф Odds API ~500/мес — ` +
    `для непрерывного вотча подними интервал или тариф. Ctrl+C — стоп.\n`);

  const seen = new Set();
  const run = () => tick(opts, seen).catch(err => console.error("Ошибка цикла:", err.message));
  await run();                       // сразу первый прогон
  setInterval(run, intervalMs);      // и далее по интервалу
}

main().catch(err => { console.error("Ошибка вотчера:", err.message); process.exit(1); });

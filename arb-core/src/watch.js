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
import { runGrade } from "./store/gradeRun.js";
import { maybeOffer, pollConfirmations } from "./betting/autobet.js";
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
    const kelly = { bankroll: opts.bankroll, fraction: config.kellyFraction, maxFraction: config.kellyMaxFraction, minStake: config.minStake, maxStake: config.maxStake };
    const s = await notifySurebets(newSure);
    // value: Betfair-пики с включённой автоставкой шлём с кнопкой подтверждения,
    // остальные — обычным алертом.
    const manual = [];
    for (const v of newVal) {
      if (!(await maybeOffer(v))) manual.push(v);
    }
    const vv = await notifyValues(manual, kelly);
    if (s + vv || manual.length !== newVal.length) {
      console.log(`  → отправлено в Telegram: ${s + newVal.length}`);
    }
  }

  // Проверяем сыгравшие ставки и шлём результат «сыграла/не зашла».
  // Счёт тянется только по уже начавшимся матчам (экономит квоту).
  try {
    const g = await runGrade({ notify: haveTelegram(), log: (m) => console.log(`  ${m}`) });
    if (g.gradedNow) {
      console.log(`  ✔ оценено сыгравших: ${g.gradedNow}${g.sent ? ` · результатов в Telegram: ${g.sent}` : ""}`);
    }
  } catch (err) {
    console.error("  Ошибка грейдинга:", err.message);
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

  // На сервере флагов нет — берём из переменных окружения (см. DEPLOY.md).
  const enabled = v => ["1", "true", "yes"].includes(String(v || "").toLowerCase());
  const opts = {
    sport: args[0] || process.env.ARB_WATCH_SPORT || "upcoming",
    sharpOnly: flags.includes("--sharp") || enabled(process.env.ARB_WATCH_SHARP),
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

  if (config.betting.enabled) {
    const m = config.betting.dryRun ? "DRY-RUN (реальные деньги НЕ трогаются)" : "РЕАЛЬНЫЕ ставки на Betfair";
    console.log(`Автоставка: ВКЛ — ${m}. Лимит ${config.betting.maxStake}/ставка, день ${config.betting.dailyCap}.`);
    // Подтверждения кнопок опрашиваем часто (независимо от интервала сканов).
    setInterval(() => pollConfirmations().catch(err => console.error("Ошибка подтверждений:", err.message)), 8000);
  }

  const seen = new Set();
  const run = () => tick(opts, seen).catch(err => console.error("Ошибка цикла:", err.message));
  await run();                       // сразу первый прогон
  setInterval(run, intervalMs);      // и далее по интервалу
}

main().catch(err => { console.error("Ошибка вотчера:", err.message); process.exit(1); });

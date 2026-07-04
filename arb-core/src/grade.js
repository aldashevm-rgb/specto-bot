// CLI автогрейдинга: оценивает сыгравшие ставки из лога, считает точность и
// шлёт в Telegram «сыграла/не зашла». Запуск: npm run grade [sport]
//
// /scores отдаёт результаты за последние 1–3 суток — запускай регулярно.

import { readLog } from "./store/localLog.js";
import { runGrade } from "./store/gradeRun.js";
import { haveOddsApi, haveTelegram, config } from "./config.js";

async function main() {
  if (!haveOddsApi()) {
    console.error("Нужен ODDS_API_KEY (см. .env.example).");
    process.exit(1);
  }
  // "upcoming" — сборная выдача, не реальный ключ спорта → не фильтруем по нему.
  const rawArg = process.argv.slice(2).find(a => !a.startsWith("--"));
  const sportFilter = rawArg && rawArg !== "upcoming" ? rawArg : null;

  const records = readLog(config.logFile);
  if (!records.length) {
    console.log(`Лог пуст (${config.logFile}). Сначала собери прогнозы: npm run value <sport> (или dashboard).`);
    return;
  }

  const { gradedNow, sent, pending, summary } = await runGrade({
    sportFilter, notify: haveTelegram(), log: (m) => console.log(m)
  });

  console.log(`Оценено сейчас: ${gradedNow}${sent ? ` · в Telegram: ${sent}` : ""}. ` +
    `Всего оценено: ${summary.count || 0}.`);

  if (summary.count) {
    console.log(`\nТОЧНОСТЬ ПРОГНОЗА (накопительно):`);
    console.log(`  Brier: ${summary.brier}   (0 — идеально; ~0.67 — «наугад» для 3 исходов)`);
    console.log(`  log-loss: ${summary.logLoss}`);
    console.log(`  hit rate: ${summary.hitRatePct}%  (доля угаданных наиболее вероятных исходов)`);
    if (summary.bets) {
      const sign = summary.betRoiPct >= 0 ? "+" : "";
      console.log(`\nVALUE-СТАВКИ: ${summary.bets} шт., угадано ${summary.betWins}, ` +
        `ROI ${sign}${summary.betRoiPct}%  (на дистанции; малые выборки шумят)`);
    }
  } else if (!gradedNow) {
    const times = records.filter(r => !r.graded_at && r.commence).map(r => r.commence).sort();
    const soon = times.length ? ` Ближайший из ждущих: ${new Date(times[0]).toLocaleString("ru-RU")}.` : "";
    console.log(`Пока нечего сводить — сыгравших ставок нет.${soon} Запусти позже (в пределах ${config.scoresDaysFrom} сут после матчей).`);
  }
}

main().catch(err => { console.error("Ошибка грейдинга:", err.message); process.exit(1); });

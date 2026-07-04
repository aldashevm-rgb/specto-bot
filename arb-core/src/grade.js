// CLI автогрейдинга: берёт локальный лог прогнозов (predictions.jsonl), тянет
// результаты матчей с The Odds API (/scores, те же event_id) и считает точность
// прогноза — Brier, log-loss, hit rate, а по value-ставкам — ROI.
// Запуск: npm run grade [sport]   (по умолчанию — все виды спорта из лога)
//
// Важно: /scores отдаёт результаты только за последние 1–3 суток, поэтому
// запускай грейдинг регулярно (в пределах ARB_SCORES_DAYS после матчей).

import { readLog, writeLog } from "./store/localLog.js";
import { fetchScores } from "./sources/oddsApi.js";
import { resultGoals, gradeLoggedRecord, summarizeGrades } from "./store/grade.js";
import { haveOddsApi, config } from "./config.js";

async function main() {
  if (!haveOddsApi()) {
    console.error("Нужен ODDS_API_KEY (см. .env.example).");
    process.exit(1);
  }
  // "upcoming" — не реальный вид спорта (сборная выдача), в логе у записей
  // настоящие ключи, поэтому как фильтр он бессмыслен → трактуем как «все».
  const rawArg = process.argv.slice(2).find(a => !a.startsWith("--"));
  const sportArg = rawArg && rawArg !== "upcoming" ? rawArg : null;

  const records = readLog(config.logFile);
  if (!records.length) {
    console.log(`Лог пуст (${config.logFile}). Сначала собери прогнозы: npm run value <sport>`);
    return;
  }

  // Что ещё не оценено (и подходит под фильтр спорта, если задан).
  const pending = records.filter(r => !r.graded_at && (!sportArg || r.sport === sportArg));
  const sports = [...new Set(pending.map(r => r.sport))];
  console.log(`В логе: ${records.length}. Ждут оценки: ${pending.length}` +
    (sports.length ? ` (спорт: ${sports.join(", ")})` : "") + ".");

  // Тянем результаты по каждому виду спорта и строим карту event_id → счёт.
  const goalsById = new Map();
  for (const sport of sports) {
    try {
      const scores = await fetchScores(sport, { daysFrom: config.scoresDaysFrom });
      for (const ev of scores || []) {
        const g = resultGoals(ev);
        if (g) goalsById.set(ev.id, g);
      }
    } catch (err) {
      console.warn(`Результаты ${sport} не получены: ${err.message}`);
    }
  }

  // Оцениваем и проставляем результат в записи.
  const nowIso = new Date().toISOString();
  let gradedNow = 0;
  for (const r of records) {
    if (r.graded_at) continue;
    const g = goalsById.get(r.event_id);
    if (!g) continue; // матч ещё не завершён или вне окна результатов
    const res = gradeLoggedRecord(r, g.homeGoals, g.awayGoals);
    if (!res) continue;
    r.actual_home = g.homeGoals;
    r.actual_away = g.awayGoals;
    r.winner = res.winner;
    r.brier = res.brier;
    r.log_loss = res.logLoss;
    r.correct = res.correct;
    r.bet_won = res.betWon;
    r.bet_profit = res.betProfit;
    r.graded_at = nowIso;
    gradedNow += 1;
  }
  writeLog(config.logFile, records);

  // Свод по ВСЕМ уже оценённым записям (накопительно).
  const gradedRecords = records.filter(r => r.graded_at && (!sportArg || r.sport === sportArg));
  const summary = summarizeGrades(gradedRecords.map(r => ({
    brier: r.brier, logLoss: r.log_loss, correct: r.correct, betWon: r.bet_won, betProfit: r.bet_profit
  })));

  console.log(`Оценено сейчас: ${gradedNow}. Всего оценено: ${summary.count || 0}.`);
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
  } else {
    const times = pending.map(r => r.commence).filter(Boolean).sort();
    const soon = times.length ? ` Ближайший матч: ${new Date(times[0]).toLocaleString("ru-RU")}.` : "";
    console.log(`Пока нечего сводить — матчи ещё не сыграны.${soon} ` +
      `Запусти grade после игр (в пределах ${config.scoresDaysFrom} сут).`);
  }
}

main().catch(err => {
  console.error("Ошибка грейдинга:", err.message);
  process.exit(1);
});

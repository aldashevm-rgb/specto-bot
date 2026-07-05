// Оркестратор грейдинга (переиспользуется CLI `grade` и вотчером).
// Берёт из лога незаграженные ставки по УЖЕ начавшимся матчам, тянет их
// результаты с The Odds API, оценивает, пишет обратно и (опц.) шлёт в Telegram
// «сыграла/не зашла». Счёт тянется только по начавшимся матчам — экономит квоту.

import { readLog, writeLog } from "./localLog.js";
import { fetchScores } from "../sources/oddsApi.js";
import { resultGoals, gradeLoggedRecord, summarizeGrades } from "./grade.js";
import { notifyResults } from "../notify/telegram.js";
import { haveTelegram, config } from "../config.js";

export async function runGrade({ sportFilter = null, notify = false, nowMs = Date.now(), log = () => {} } = {}) {
  const records = readLog(config.logFile);

  // Незаграженные ставки по матчам, которые уже должны были начаться/закончиться.
  const pending = records.filter(r =>
    !r.graded_at &&
    (!sportFilter || r.sport === sportFilter) &&
    (!r.commence || Date.parse(r.commence) < nowMs)
  );
  if (!pending.length) {
    const graded0 = records.filter(r => r.graded_at && (!sportFilter || r.sport === sportFilter));
    return { gradedNow: 0, sent: 0, pending: 0, justGraded: [], summary: summarizeGrades(graded0.map(toGrade)) };
  }

  // Результаты по каждому виду спорта из pending (тот же event_id).
  const goalsById = new Map();
  for (const sport of [...new Set(pending.map(r => r.sport))]) {
    try {
      const scores = await fetchScores(sport, { daysFrom: config.scoresDaysFrom });
      for (const ev of scores || []) {
        const g = resultGoals(ev);
        if (g) goalsById.set(ev.id, g);
      }
    } catch (err) {
      log(`результаты ${sport} не получены: ${err.message}`);
    }
  }

  const stamp = new Date(nowMs).toISOString();
  const justGraded = [];
  for (const r of records) {
    if (r.graded_at) continue;
    const g = goalsById.get(r.event_id);
    if (!g) continue; // матч ещё не завершён / вне окна результатов
    const res = gradeLoggedRecord(r, g.homeGoals, g.awayGoals);
    if (!res) continue;
    Object.assign(r, {
      actual_home: g.homeGoals, actual_away: g.awayGoals, winner: res.winner,
      brier: res.brier, log_loss: res.logLoss, correct: res.correct,
      bet_won: res.betWon, bet_profit: res.betProfit, graded_at: stamp
    });
    justGraded.push(r);
  }
  writeLog(config.logFile, records);

  let sent = 0;
  if (notify && haveTelegram()) {
    const kelly = { bankroll: config.bankroll, fraction: config.kellyFraction, maxFraction: config.kellyMaxFraction, minStake: config.minStake, maxStake: config.maxStake };
    sent = await notifyResults(justGraded, kelly);
  }

  const graded = records.filter(r => r.graded_at && (!sportFilter || r.sport === sportFilter));
  return { gradedNow: justGraded.length, sent, pending: pending.length, justGraded, summary: summarizeGrades(graded.map(toGrade)) };
}

function toGrade(r) {
  return { brier: r.brier, logLoss: r.log_loss, correct: r.correct, betWon: r.bet_won, betProfit: r.bet_profit };
}

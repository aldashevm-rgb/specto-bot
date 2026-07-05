// CLI «лесенки»: строит цепочку безопасных ставок (фавориты), катящих банк до
// целевого множителя (по умолч. ×3), и ЧЕСТНО показывает вероятность пройти всю
// цепочку. Лесенка проходит только если выигрывают все шаги подряд.
//
// Запуск: npm run ladder [sport] [-- --x=3 --steps=10 --start=5000 --minprob=0.6]

import { scanLadderPicks } from "./core/scanner.js";
import { buildLadder } from "./core/ladder.js";
import { haveOddsApi, config } from "./config.js";
import { outcomeLabel } from "./notify/labels.js";

function flag(flags, name, def) {
  const f = flags.find(x => x.startsWith(`--${name}=`));
  return f ? Number(f.split("=")[1]) : def;
}

async function main() {
  if (!haveOddsApi()) { console.error("Нужен ODDS_API_KEY (см. .env.example)."); process.exit(1); }
  const flags = process.argv.slice(2).filter(a => a.startsWith("--"));
  const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
  const sport = args[0] || "upcoming";
  const targetMult = flag(flags, "x", 3);
  const maxSteps = flag(flags, "steps", 10);
  const startStake = flag(flags, "start", config.bankroll);
  const minProb = flag(flags, "minprob", 0.6);

  console.log(`Лесенка: ${sport} · цель ×${targetMult} · до ${maxSteps} шагов · старт ${startStake} · ` +
    `фавориты с шансом ≥${Math.round(minProb * 100)}%\n`);

  const picks = await scanLadderPicks({ sport, minProb });
  const ladder = buildLadder(picks, { targetMult, maxSteps, startStake });

  if (!ladder.steps.length) {
    console.log("Нет подходящих фаворитов в окне. Попробуй другой спорт, минимум пониже (--minprob=0.55) или упусти окно.");
    return;
  }

  for (const s of ladder.steps) {
    const pick = outcomeLabel({ name: s.name, market: s.market, home: s.home, away: s.away, point: s.point });
    const when = s.commence ? new Date(s.commence).toLocaleString("ru-RU") : "?";
    console.log(`Шаг ${s.n}: ${s.home} — ${s.away}  (${when})`);
    console.log(`   ставь ${s.stakeIn} на «${pick}» @ ${s.odds} (${s.bookmaker}) · шанс ${Math.round(s.prob * 100)}%`);
    console.log(`   если зайдёт → станет ${s.willBe}  (×${s.runMult})\n`);
  }

  const pct = Math.round(ladder.successProb * 100);
  console.log("─".repeat(56));
  console.log(`Итог цепочки: ×${ladder.finalMult} → ${ladder.finalAmount} из ${ladder.startStake}` +
    `${ladder.reached ? "" : " (до ×" + targetMult + " не хватило пиков)"}`);
  console.log(`ШАНС ПРОЙТИ ВСЮ ЛЕСЕНКУ: ~${pct}%  (провалишь любой шаг — теряешь всё)`);
  console.log("─".repeat(56));
  console.log("⚠️ Лесенка — высокий риск. ~" + (100 - pct) + "% потерять весь старт. Ставь только то, что не жалко.");
}

main().catch(err => { console.error("Ошибка лесенки:", err.message); process.exit(1); });

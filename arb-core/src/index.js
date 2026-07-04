// CLI-точка входа: запускает скан и печатает найденные вилки с раскладкой ставок
// и ИИ-разбором. Пример: node src/index.js soccer_epl
//
// Флаги окружения см. в .env.example / config.js.

import { scan } from "./core/scanner.js";
import { haveOddsApi, config } from "./config.js";

function fmtLeg(l) {
  return `    ${l.name} @ ${l.odds} (${l.bookmaker}) → ставка ${l.stake}, выплата ${l.payout}`;
}

function printSurebet(sb, i) {
  const kickoff = sb.commence ? new Date(sb.commence).toLocaleString("ru-RU") : "?";
  const lineTag = sb.line ? `  {${sb.line}}` : "";
  console.log(`\n${i + 1}. ${sb.home} — ${sb.away}  [${sb.sport} · ${sb.market}]${lineTag}  ${kickoff}`);
  console.log(`   Вилка: маржа ${sb.arb.marginPct}%, ROI ${sb.arb.roi}%, ` +
    `банк ${sb.arb.invested} → гаранта ${sb.arb.guaranteedPayout} (профит ${sb.arb.profit})`);
  sb.arb.legs.forEach(l => console.log(fmtLeg(l)));
  const pred = sb.prediction;
  if (pred) {
    const parts = Object.entries(pred.probs)
      .map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(" / ");
    const agree = pred.agreement != null ? `, согласие источников ${Math.round(pred.agreement * 100)}%` : "";
    console.log(`   Прогноз [${pred.sources.join("+")}]: ${parts}${agree}`);
    if (pred.top && pred.top.edgePct > 0) {
      console.log(`       value: ${pred.top.name} @ ${pred.top.odds} — перевес +${pred.top.edgePct}%`);
    }
  }
  if (sb.ai) {
    console.log(`   ИИ: нужнее победа — ${sb.ai.needsWin}; вероятный исход — ${sb.ai.likelyOutcome}` +
      (sb.ai.reasoning ? ` (${sb.ai.reasoning})` : ""));
  }
}

async function main() {
  if (!haveOddsApi()) {
    console.error("Нужен ODDS_API_KEY (см. .env.example). Ключ The Odds API: https://the-odds-api.com");
    process.exit(1);
  }
  const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
  const hoursFlag = process.argv.slice(2).find(f => f.startsWith("--hours="));
  const maxHours = hoursFlag ? Number(hoursFlag.split("=")[1]) : config.maxHours;
  const sport = args[0] || "upcoming";
  const win = maxHours > 0 ? `окно ${maxHours}ч` : "без окна";
  console.log(`Скан вилок: ${sport} · рынки [${config.markets.join(", ")}] · ${win} ...`);
  const { scanned, found, notified, logged, surebets } = await scan({ sport, maxHours });
  console.log(`В окне линий: ${scanned}. Найдено вилок: ${found}. ` +
    `Уведомлено: ${notified}. Записано в БД: ${logged}.`);
  surebets.forEach(printSurebet);
  if (!found) console.log("Прибыльных вилок не найдено — попробуй другой вид спорта/регион.");
}

main().catch(err => {
  console.error("Ошибка скана:", err.message);
  process.exit(1);
});

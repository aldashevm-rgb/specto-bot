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
  if (sb.ai) {
    console.log(`   ИИ: нужнее победа — ${sb.ai.needsWin}; вероятный исход — ${sb.ai.likelyOutcome} ` +
      `(П1 ${Math.round(sb.ai.probs.home * 100)}% / Х ${Math.round(sb.ai.probs.draw * 100)}% / ` +
      `П2 ${Math.round(sb.ai.probs.away * 100)}%), уверенность ${sb.ai.confidence}%`);
    if (sb.ai.reasoning) console.log(`       ${sb.ai.reasoning}`);
    const top = sb.ai.edges?.[0];
    if (top && top.edgePct > 0) {
      console.log(`       value: ${top.name} @ ${top.odds} — перевес +${top.edgePct}%`);
    }
  }
}

async function main() {
  if (!haveOddsApi()) {
    console.error("Нужен ODDS_API_KEY (см. .env.example). Ключ The Odds API: https://the-odds-api.com");
    process.exit(1);
  }
  const sport = process.argv[2] || "upcoming";
  console.log(`Скан вилок: ${sport} · рынки [${config.markets.join(", ")}] ...`);
  const { scanned, found, notified, logged, surebets } = await scan({ sport });
  console.log(`Проверено линий: ${scanned}. Найдено вилок: ${found}. ` +
    `Уведомлено: ${notified}. Записано в БД: ${logged}.`);
  surebets.forEach(printSurebet);
  if (!found) console.log("Прибыльных вилок не найдено — попробуй другой вид спорта/регион.");
}

main().catch(err => {
  console.error("Ошибка скана:", err.message);
  process.exit(1);
});

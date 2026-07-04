// CLI value-ставок: показывает, где лучший коэффициент выгоднее честной
// вероятности рынка (плюсовое ожидание), даже когда чистых вилок нет.
// Пример: node src/value.js soccer_epl   |   npm run value upcoming
//
// По умолчанию прогноз строится на консенсусе рынка (мгновенно, без доп.
// запросов). Флаг --ai добавляет модель Пуассона и LLM-разбор (нужны ключи
// API_FOOTBALL_KEY / ANTHROPIC_API_KEY и больше времени/квоты).

import { scanValue } from "./core/scanner.js";
import { haveOddsApi, config } from "./config.js";

function printValue(v, i) {
  const kickoff = v.commence ? new Date(v.commence).toLocaleString("ru-RU") : "?";
  const lineTag = v.line ? `  {${v.line}}` : "";
  const b = v.valueBet;
  console.log(`\n${i + 1}. ${v.home} — ${v.away}  [${v.sport} · ${v.market}]${lineTag}  ${kickoff}`);
  console.log(`   ➤ ${b.name} @ ${b.odds} (${b.bookmaker})  —  перевес +${b.edgePct}% ` +
    `(модель ${b.modelProb}% против цены)`);
  const pred = v.prediction;
  if (pred) {
    const probs = Object.entries(pred.probs).map(([k, val]) => `${k} ${Math.round(val * 100)}%`).join(" / ");
    const agree = pred.agreement != null ? `, согласие ${Math.round(pred.agreement * 100)}%` : "";
    console.log(`     прогноз [${pred.sources.join("+")}]: ${probs}${agree}`);
  }
}

async function main() {
  if (!haveOddsApi()) {
    console.error("Нужен ODDS_API_KEY (см. .env.example). Ключ: https://the-odds-api.com");
    process.exit(1);
  }
  const args = process.argv.slice(2).filter(a => a !== "--ai");
  const enrichAi = process.argv.includes("--ai");
  const sport = args[0] || "upcoming";

  console.log(`Скан value: ${sport} · рынки [${config.markets.join(", ")}] · ` +
    `порог +${config.minEdgePct}%${enrichAi ? " · +Пуассон/LLM" : " · только консенсус"} ...`);
  const { scanned, found, values } = await scanValue({ sport, enrichAi });
  console.log(`Проверено линий: ${scanned}. Value-ставок (перевес ≥ ${config.minEdgePct}%): ${found}.`);
  values.forEach(printValue);
  if (!found) {
    console.log("\nНичего выше порога. Снизь порог: в .env поставь ARB_MIN_EDGE=1, " +
      "или расширь охват: npm run value upcoming");
  }
}

main().catch(err => {
  console.error("Ошибка скана value:", err.message);
  process.exit(1);
});

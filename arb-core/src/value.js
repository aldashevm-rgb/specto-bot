// CLI value-ставок: показывает, где лучший коэффициент выгоднее честной
// вероятности рынка (плюсовое ожидание), даже когда чистых вилок нет.
// Пример: node src/value.js soccer_epl   |   npm run value upcoming
//
// Флаги (после `--` при запуске через npm):
//   --ai     добавить модель Пуассона и LLM-разбор (нужны ключи, дольше)
//   --sharp  только value у резких контор (Pinnacle/Betfair/…) — их не режут
//
// Порог перевеса зависит от резкости конторы: у софт-контор (щедрые, но
// лимитируют) требуется больший перевес, у резких — обычный.

import { scanValue } from "./core/scanner.js";
import { haveOddsApi, config } from "./config.js";

function printValue(v, i) {
  const kickoff = v.commence ? new Date(v.commence).toLocaleString("ru-RU") : "?";
  const lineTag = v.line ? `  {${v.line}}` : "";
  const b = v.valueBet;
  const tier = b.tier === "sharp" ? "РЕЗКАЯ" : "софт";
  console.log(`\n${i + 1}. ${v.home} — ${v.away}  [${v.sport} · ${v.market}]${lineTag}  ${kickoff}`);
  console.log(`   ➤ ${b.name} @ ${b.odds} (${b.bookmaker} · ${tier})  —  перевес +${b.edgePct}% ` +
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
  const flags = process.argv.slice(2).filter(a => a.startsWith("--"));
  const args = process.argv.slice(2).filter(a => !a.startsWith("--"));
  const enrichAi = flags.includes("--ai");
  const sharpOnly = flags.includes("--sharp");
  const hoursFlag = flags.find(f => f.startsWith("--hours="));
  const maxHours = hoursFlag ? Number(hoursFlag.split("=")[1]) : config.maxHours;
  const sport = args[0] || "upcoming";

  const win = maxHours > 0 ? `окно ${maxHours}ч` : "без окна";
  const mode = [enrichAi ? "+Пуассон/LLM" : "только консенсус", sharpOnly ? "только резкие конторы" : null]
    .filter(Boolean).join(" · ");
  console.log(`Скан value: ${sport} · рынки [${config.markets.join(", ")}] · ${win} · ` +
    `порог резкие +${config.minEdgePct}% / софт +${config.minEdgeSoftPct}% · ${mode} ...`);
  const { scanned, found, values } = await scanValue({ sport, enrichAi, sharpOnly, maxHours });
  console.log(`В окне линий: ${scanned}. Value-ставок: ${found}.`);
  values.forEach(printValue);
  if (!found) {
    console.log("\nНичего выше порога. Снизь планку (в .env ARB_MIN_EDGE / ARB_MIN_EDGE_SOFT) " +
      "или расширь охват: npm run value upcoming");
  }
}

main().catch(err => {
  console.error("Ошибка скана value:", err.message);
  process.exit(1);
});

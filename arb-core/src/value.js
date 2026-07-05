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
import { kellyStake } from "./core/kelly.js";
import { haveOddsApi, config } from "./config.js";

function printValue(v, i, bankroll) {
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
    // Размер ставки по дробному Кельли от точной вероятности модели.
    const p = pred.probs[b.name];
    if (p != null) {
      const k = kellyStake(p, b.odds, {
        bankroll, fraction: config.kellyFraction, maxFraction: config.kellyMaxFraction, minStake: config.minStake, maxStake: config.maxStake
      });
      const capped = k.fullKelly * config.kellyFraction > config.kellyMaxFraction ? " (потолок)" : "";
      console.log(`     ставка: ${k.stake} — ${(k.fractionOfBank * 100).toFixed(1)}% банка ` +
        `(${config.kellyFraction}·Kelly${capped})`);
    }
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
  const bankFlag = flags.find(f => f.startsWith("--bank="));
  const bankroll = bankFlag ? Number(bankFlag.split("=")[1]) : config.bankroll;
  const sport = args[0] || "upcoming";

  const win = maxHours > 0 ? `окно ${maxHours}ч` : "без окна";
  const mode = [enrichAi ? "+Пуассон/LLM" : "только консенсус", sharpOnly ? "только резкие конторы" : null]
    .filter(Boolean).join(" · ");
  console.log(`Скан value: ${sport} · рынки [${config.markets.join(", ")}] · ${win} · банк ${bankroll} · ` +
    `порог резкие +${config.minEdgePct}% / софт +${config.minEdgeSoftPct}% · ${mode} ...`);
  const { scanned, found, values, logged } = await scanValue({
    sport, enrichAi, sharpOnly, maxHours, logFile: config.logFile
  });
  console.log(`В окне линий: ${scanned}. Value-ставок: ${found}.` +
    (logged ? ` Прогнозов в лог: +${logged.added} новых / ${logged.total} всего.` : ""));
  values.forEach((v, i) => printValue(v, i, bankroll));
  if (!found) {
    console.log("\nНичего выше порога. Снизь планку (в .env ARB_MIN_EDGE / ARB_MIN_EDGE_SOFT) " +
      "или расширь охват: npm run value upcoming");
  }
}

main().catch(err => {
  console.error("Ошибка скана value:", err.message);
  process.exit(1);
});

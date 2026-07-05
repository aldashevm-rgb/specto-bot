// CLI чистого арбитража: ищет только ВИЛКИ (surebet) — ставки на все исходы у
// разных контор, где прибыль гарантирована при любом результате. Ноль азарта.
// Показывает точную раскладку под твой банк (ARB_STAKE).
//
// Запуск: npm run arb [sport]   (upcoming | tennis | soccer | ...)

import { scan } from "./core/scanner.js";
import { haveOddsApi, config } from "./config.js";
import { outcomeLabel, sportLabel } from "./notify/labels.js";

async function main() {
  if (!haveOddsApi()) { console.error("Нужен ODDS_API_KEY (см. .env.example)."); process.exit(1); }
  const sport = process.argv.slice(2).find(a => !a.startsWith("--")) || "upcoming";
  const books = config.myBooks.length ? config.myBooks.join(", ") : "все";

  console.log(`ВИЛКИ (гарантированный доход): ${sport} · рынки [${config.markets.join(", ")}] · ` +
    `банк ${config.totalStake} · конторы ${books} ...\n`);

  const { scanned, found, surebets } = await scan({
    sport, enrichAi: false, notify: false, store: false
  });

  console.log(`Проверено линий: ${scanned}. Вилок найдено: ${found}.`);

  for (const sb of surebets) {
    console.log(`\n🎯 ${sb.home} — ${sb.away}  [${sportLabel(sb.sport)}${sb.line ? " · " + sb.line : ""}]`);
    console.log(`   Гарантированная маржа: +${sb.arb.marginPct}% (ROI ${sb.arb.roi}%)`);
    for (const l of sb.arb.legs) {
      const pick = outcomeLabel({ name: l.name, market: sb.market, home: sb.home, away: sb.away, point: sb.point });
      console.log(`   • поставь ${l.stake} на «${pick}» @ ${l.odds} у ${l.bookmaker}`);
    }
    console.log(`   Итог: банк ${sb.arb.invested} → ${sb.arb.guaranteedPayout} (прибыль +${sb.arb.profit} при ЛЮБОМ исходе)`);
  }

  if (!found) {
    console.log("\nВилок сейчас нет — это нормально. С 1–2 конторами они редки, но реальны.");
    console.log("Лучше всего искать в 2-исходных видах (теннис, тоталы): npm run arb tennis");
    console.log("Держи вотчер запущенным (ARB_ONLY=1) — он поймает вилку, как только появится.");
  }
}

main().catch(err => { console.error("Ошибка поиска вилок:", err.message); process.exit(1); });

// Демо-режим: гоняет весь конвейер (нормализация → вилки → ансамблевый прогноз)
// на встроенных реалистичных данных, БЕЗ сети и без ключей. Нужен, чтобы сразу
// увидеть, что и как выдаёт ядро. Запуск: npm run demo
//
// Прогноз здесь строится только на консенсусе рынка (де-виг коэффициентов) —
// Пуассон и LLM подключаются на реальном запуске при наличии API-ключей.

import { scan } from "./core/scanner.js";

// Две выдуманные, но правдоподобные игры с линиями трёх БК. У каждой заложена
// вилка: лучший коэффициент по исходам собран у разных букмекеров.
const SAMPLE = [
  {
    id: "demo-elclasico", sport_key: "soccer_spain_la_liga",
    commence_time: "2026-07-11T19:00:00Z",
    home_team: "Real Madrid", away_team: "Barcelona",
    bookmakers: [
      { key: "a", title: "AlphaBet", markets: [{ key: "h2h", outcomes: [
        { name: "Real Madrid", price: 2.75 }, { name: "Draw", price: 3.4 }, { name: "Barcelona", price: 2.5 } ] }] },
      { key: "b", title: "BetOnero", markets: [{ key: "h2h", outcomes: [
        { name: "Real Madrid", price: 2.5 }, { name: "Draw", price: 3.9 }, { name: "Barcelona", price: 2.8 } ] }] },
      { key: "c", title: "CoralPro", markets: [{ key: "h2h", outcomes: [
        { name: "Real Madrid", price: 2.6 }, { name: "Draw", price: 3.5 }, { name: "Barcelona", price: 3.5 } ] }] }
    ]
  },
  {
    id: "demo-derby", sport_key: "soccer_germany_bundesliga",
    commence_time: "2026-07-12T16:30:00Z",
    home_team: "Bayern", away_team: "Dortmund",
    bookmakers: [
      { key: "a", title: "AlphaBet", markets: [{ key: "totals", outcomes: [
        { name: "Over", price: 2.10, point: 3.5 }, { name: "Under", price: 1.80, point: 3.5 } ] }] },
      { key: "b", title: "BetOnero", markets: [{ key: "totals", outcomes: [
        { name: "Over", price: 2.15, point: 3.5 }, { name: "Under", price: 1.75, point: 3.5 } ] }] },
      { key: "c", title: "CoralPro", markets: [{ key: "totals", outcomes: [
        { name: "Over", price: 1.95, point: 3.5 }, { name: "Under", price: 2.05, point: 3.5 } ] }] }
    ]
  }
];

function printSurebet(sb, i) {
  const kickoff = new Date(sb.commence).toISOString().replace("T", " ").slice(0, 16);
  const lineTag = sb.line ? `  {${sb.line}}` : "";
  console.log(`\n${i + 1}. ${sb.home} — ${sb.away}  [${sb.sport} · ${sb.market}]${lineTag}  ${kickoff} UTC`);
  console.log(`   Вилка: маржа ${sb.arb.marginPct}%, ROI ${sb.arb.roi}%, ` +
    `банк ${sb.arb.invested} → гаранта ${sb.arb.guaranteedPayout} (профит ${sb.arb.profit})`);
  for (const l of sb.arb.legs) {
    console.log(`     • ${l.name} @ ${l.odds} (${l.bookmaker}) → ставка ${l.stake}, выплата ${l.payout}`);
  }
  const p = sb.prediction;
  if (p) {
    const probs = Object.entries(p.probs).map(([k, v]) => `${k} ${Math.round(v * 100)}%`).join(" / ");
    console.log(`   Прогноз [${p.sources.join("+")}]: ${probs}`);
    if (p.top && p.top.edgePct > 0) {
      console.log(`     value: ${p.top.name} @ ${p.top.odds} — перевес +${p.top.edgePct}%`);
    }
  }
}

async function main() {
  console.log("ДЕМО arb-core (встроенные данные, без сети).");
  console.log("Прогноз строится на консенсусе рынка; Пуассон+LLM — на реальном запуске с ключами.\n");
  const { scanned, found, surebets } = await scan({
    markets: ["h2h", "totals"],
    notify: false,   // без Telegram
    store: false,    // без Supabase
    fetchOddsFn: async () => SAMPLE
  });
  console.log(`Проверено линий: ${scanned}. Найдено вилок: ${found}.`);
  surebets.forEach(printSurebet);
  console.log("\nНа реальных данных: cp .env.example .env → вписать ODDS_API_KEY → npm run scan soccer_epl");
}

main().catch(err => { console.error("Ошибка демо:", err.message); process.exit(1); });

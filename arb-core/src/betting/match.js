// Сопоставление нашего исхода с «раннером» рынка Betfair (чистые функции).
// Betfair отдаёт список runners с названиями (команды) + The Draw для ничьей.

// Нормализация имени для сравнения: нижний регистр, только буквы/цифры.
export function norm(s) {
  return String(s ?? "").toLowerCase().replace(/[^a-zа-я0-9]+/gi, "");
}

// Найти selectionId для нашего исхода среди runners рынка MATCH_ODDS (h2h).
//   runners — [{ selectionId, runnerName }]
//   outcomeName — имя нашего исхода (команда или "Draw")
//   home, away — команды события (для сопоставления имён)
// Возвращает selectionId или null.
export function matchSelectionId(runners = [], { outcomeName, home, away } = {}) {
  const target = String(outcomeName ?? "");
  const isDraw = target.toLowerCase() === "draw";
  const want = isDraw ? "thedraw" : norm(target);

  let best = null;
  let bestScore = 0;
  for (const r of runners) {
    const rn = norm(r.runnerName);
    if (!rn) continue;
    let score = 0;
    if (isDraw && (rn === "thedraw" || rn.includes("draw"))) score = 1;
    else if (rn === want) score = 1;
    else if (rn.includes(want) || want.includes(rn)) score = 0.6;
    if (score > bestScore) { bestScore = score; best = r.selectionId; }
  }
  return bestScore >= 0.6 ? best : null;
}

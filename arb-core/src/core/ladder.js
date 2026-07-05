// «Лесенка» (ladder): цепочка ставок, где весь банк катится на следующую, пока
// не наберётся целевой множитель (напр. ×3). Проходит, ТОЛЬКО если выигрывают
// все шаги подряд — поэтому считаем и показываем реальную вероятность успеха.
// Чистые функции.

function round2(x) { return Math.round((Number(x) + Number.EPSILON) * 100) / 100; }
function round3(x) { return Math.round(Number(x) * 1000) / 1000; }

// Построить лесенку из пиков (безопасные первыми) до целевого множителя.
// picks: [{ home, away, name, odds, prob, sport, commence, ... }]
// opts: targetMult (×), maxSteps, startStake.
// Возвращает шаги с нарастающим множителем/суммой и вероятность пройти всё.
export function buildLadder(picks = [], { targetMult = 3, maxSteps = 10, startStake = 1000 } = {}) {
  const steps = [];
  let mult = 1;
  let prob = 1;
  for (const p of picks) {
    if (steps.length >= maxSteps || mult >= targetMult) break;
    const odds = Number(p.odds);
    const pr = Number(p.prob);
    if (!(odds > 1) || !(pr > 0)) continue;
    const stakeIn = round2(startStake * mult); // весь текущий банк идёт в шаг
    mult = round2(mult * odds);
    prob *= pr;
    steps.push({
      n: steps.length + 1,
      home: p.home, away: p.away, name: p.name, odds,
      prob: round3(pr), bookmaker: p.bookmaker, sport: p.sport,
      commence: p.commence, market: p.market, point: p.point ?? null,
      stakeIn,
      willBe: round2(startStake * mult),  // станет столько, если шаг зашёл
      runMult: mult                        // нарастающий множитель
    });
  }
  return {
    steps,
    reached: mult >= targetMult,           // хватило ли пиков до цели
    finalMult: round2(mult),               // итоговый множитель цепочки
    successProb: round3(prob),             // вероятность пройти ВСЮ лесенку
    startStake,
    finalAmount: round2(startStake * mult)
  };
}

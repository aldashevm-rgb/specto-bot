// Ядро арбитража (surebet). Чистая математика — без сети, полностью тестируется.
//
// Идея: если для события взять ЛУЧШИЙ коэффициент по каждому исходу (у разных
// букмекеров) и сумма обратных коэффициентов < 1, то, распределив ставку по
// исходам, мы получаем гарантированную прибыль независимо от результата.
//
//   implied_i = 1 / odds_i        (вероятность, заложенная в коэффициент)
//   sum       = Σ implied_i
//   sum < 1   → вилка (surebet). Гарантированная маржа = (1 - sum).

// Обратный коэффициент = вероятность, заложенная букмекером.
export function impliedProbability(odds) {
  const n = Number(odds);
  if (!Number.isFinite(n) || n <= 1) return null; // коэф. всегда > 1
  return 1 / n;
}

// Округление денег до копеек без плавающих хвостов.
export function round2(x) {
  return Math.round((Number(x) + Number.EPSILON) * 100) / 100;
}

// Оценка вилки по набору лучших исходов.
// outcomes: [{ name, odds, bookmaker? }] — по одному лучшему коэф. на исход.
// Возвращает { valid, sum, isArb, marginPct, roi } или { valid:false } при мусоре.
export function computeArbitrage(outcomes = []) {
  if (!Array.isArray(outcomes) || outcomes.length < 2) {
    return { valid: false, reason: "нужно ≥2 исхода" };
  }
  const inv = [];
  for (const o of outcomes) {
    const p = impliedProbability(o && o.odds);
    if (p === null) return { valid: false, reason: `плохой коэф.: ${o && o.odds}` };
    inv.push(p);
  }
  const sum = inv.reduce((a, b) => a + b, 0);
  const isArb = sum < 1;
  // Маржа = гарантированный процент прибыли к обороту при идеальном распределении.
  const marginPct = round2((1 - sum) * 100);
  // ROI на вложенный банк = margin / sum (доход относительно суммы всех ставок).
  const roi = round2(((1 - sum) / sum) * 100);
  return { valid: true, sum: round2(sum), isArb, marginPct, roi };
}

// Распределение банка по исходам так, чтобы выплата была одинаковой при любом
// результате. Возвращает исходы с полями stake и payout + сводку.
// totalStake — суммарный банк на событие.
export function stakeDistribution(outcomes = [], totalStake = 100) {
  const arb = computeArbitrage(outcomes);
  if (!arb.valid) return { valid: false, reason: arb.reason };

  const inv = outcomes.map(o => 1 / Number(o.odds));
  const sum = inv.reduce((a, b) => a + b, 0);

  const legs = outcomes.map((o, i) => {
    const stake = round2(totalStake * (inv[i] / sum));
    return { ...o, stake, payout: round2(stake * Number(o.odds)) };
  });

  // Выплата одинакова для всех исходов (с точностью до округления) — берём min,
  // чтобы гарантированная прибыль была не завышена.
  const guaranteedPayout = Math.min(...legs.map(l => l.payout));
  const invested = round2(legs.reduce((a, l) => a + l.stake, 0));
  const profit = round2(guaranteedPayout - invested);

  return {
    valid: true,
    isArb: arb.isArb,
    marginPct: arb.marginPct,
    roi: arb.roi,
    invested,
    guaranteedPayout: round2(guaranteedPayout),
    profit,
    legs
  };
}

// Отбор только прибыльных вилок с фильтром по минимальной марже (в %).
// events: [{ ..., bestOutcomes: [{name, odds, bookmaker}] }]
// Возвращает те же события + поле arb, отсортированные по убыванию маржи.
export function findSurebets(events = [], { minMarginPct = 0, totalStake = 100 } = {}) {
  const out = [];
  for (const ev of events) {
    const legs = ev && ev.bestOutcomes;
    if (!Array.isArray(legs) || legs.length < 2) continue;
    const dist = stakeDistribution(legs, totalStake);
    if (!dist.valid || !dist.isArb) continue;
    if (dist.marginPct < minMarginPct) continue;
    out.push({ ...ev, arb: dist });
  }
  out.sort((a, b) => b.arb.marginPct - a.arb.marginPct);
  return out;
}

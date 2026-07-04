// Статистическая модель матча на основе распределения Пуассона.
// Из ожидаемого числа голов каждой команды (λ) считаем вероятности 1X2 и
// тоталов — независимый от рынка и от LLM предиктор. Чистые функции.

function factorial(n) {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

// P(X = k) для Пуассона с параметром lambda.
export function poissonPmf(k, lambda) {
  if (!(lambda >= 0) || k < 0) return 0;
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k);
}

// Ожидаемые голы с поправкой на силу СОПЕРНИКА относительно среднего по лиге:
// λ = атака команды × (оборона соперника / средний уровень) [× преимущество поля].
// Так сильная оборона соперника давит слабую атаку, а не просто усредняется —
// это стандартная attack×defense модель, а не наивное среднее.
// ВНИМАНИЕ: на форме из 5 матчей и особенно на межлиговых матчах оценка грубая;
// поэтому модель идёт в ансамбль с малым весом и гейтом по числу игр (см. scanner).
export function lambdasFromAverages({
  homeScoredAvg, homeConcededAvg, awayScoredAvg, awayConcededAvg,
  homeAdvantage = 1.1, leagueAvg = 1.4
} = {}) {
  const hs = Number(homeScoredAvg), hc = Number(homeConcededAvg);
  const as = Number(awayScoredAvg), ac = Number(awayConcededAvg);
  if ([hs, hc, as, ac].some(v => !Number.isFinite(v)) || !(leagueAvg > 0)) return null;
  const clamp = x => Math.max(0.05, Math.min(5, x));
  const lh = clamp(hs * (ac / leagueAvg) * homeAdvantage);
  const la = clamp(as * (hc / leagueAvg));
  return { lh, la };
}

// Вероятности исходов 1X2 из λ хозяев/гостей (перебор сетки счётов).
export function outcomeProbs(lh, la, maxGoals = 10) {
  let home = 0, draw = 0, away = 0;
  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      const p = poissonPmf(i, lh) * poissonPmf(j, la);
      if (i > j) home += p;
      else if (i === j) draw += p;
      else away += p;
    }
  }
  const s = home + draw + away || 1;
  return { home: home / s, draw: draw / s, away: away / s };
}

// Вероятности тотала Over/Under для линии line (напр. 2.5). Для целых линий
// точное совпадение суммы — «возврат» (push), исключаем из обеих сторон.
export function totalsProbs(lh, la, line, maxGoals = 10) {
  let over = 0, under = 0;
  for (let i = 0; i <= maxGoals; i++) {
    for (let j = 0; j <= maxGoals; j++) {
      const p = poissonPmf(i, lh) * poissonPmf(j, la);
      const tot = i + j;
      if (tot > line) over += p;
      else if (tot < line) under += p;
      // tot === line → push, не учитываем
    }
  }
  const s = over + under || 1;
  return { over: over / s, under: under / s };
}

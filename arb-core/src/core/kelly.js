// Размер ставки от банка по критерию Кельли. Чистые функции.
//
// Кельли максимизирует долгосрочный рост банка: f* = (p·odds − 1)/(odds − 1),
// где p — вероятность выигрыша, odds — десятичный коэффициент. Полный Кельли
// очень волатилен, поэтому на практике берут ДОЛЮ (четверть-Кельли) и ставят
// потолок в % банка — это резко снижает риск просадки при почти той же доходности.

function round2(x) {
  return Math.round((Number(x) + Number.EPSILON) * 100) / 100;
}

// Доля банка по полному Кельли. Нет эджа/плохие входы → 0 (ставить не нужно).
export function kellyFraction(p, odds) {
  const P = Number(p);
  const b = Number(odds) - 1; // чистый коэффициент
  if (!(b > 0) || !(P >= 0 && P <= 1)) return 0;
  const f = (P * Number(odds) - 1) / b;
  return f > 0 ? f : 0;
}

// Рекомендуемая ставка: дробный Кельли от банка с потолком.
//   bankroll     — размер банка
//   fraction     — доля Кельли (0.25 = четверть-Кельли)
//   maxFraction  — потолок доли банка на одну ставку (защита от переставки)
// Возвращает { fullKelly, fractionOfBank, stake }.
export function kellyStake(p, odds, {
  bankroll = 1000, fraction = 0.25, maxFraction = 0.05, minStake = 0, maxStake = 0
} = {}) {
  const full = kellyFraction(p, odds);
  const frac = Math.min(full * fraction, maxFraction);
  let stake = round2(bankroll * frac);
  if (full > 0) {
    // Прямые лимиты суммы в деньгах (напр. ставить 5000–10000 тенге).
    if (maxStake > 0 && stake > maxStake) stake = maxStake;
    if (minStake > 0 && stake < minStake) stake = minStake;
  } else {
    stake = 0; // нет эджа — не ставим (минимум не форсим)
  }
  const fob = bankroll > 0 ? Math.round((stake / bankroll) * 1000) / 1000 : 0;
  return {
    fullKelly: Math.round(full * 1000) / 1000,
    fractionOfBank: fob,
    stake
  };
}

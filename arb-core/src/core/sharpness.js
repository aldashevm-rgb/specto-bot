// Классификация букмекеров по «резкости» (sharp vs soft).
//
// Резкие конторы (Pinnacle, биржи Betfair/Smarkets/Matchbook) держат
// эффективную линию с низкой маржой — их цена ближе к истинной вероятности.
// Поэтому: (1) в консенсусе им даём больший вес — «честная» вероятность точнее;
// (2) value именно у них надёжнее — их почти не режут, тогда как софт-конторы
// раздают щедрые коэффициенты на аутсайдеров, но лимитируют/банят выигрывающих.

const SHARP = ["pinnacle", "betfair", "smarkets", "matchbook"];

// Резкость конторы по названию: "sharp" | "soft".
export function bookTier(title = "") {
  const t = String(title).toLowerCase();
  return SHARP.some(s => t.includes(s)) ? "sharp" : "soft";
}

// Вес конторы в консенсусе: резкие весомее.
export function bookWeight(title = "") {
  return bookTier(title) === "sharp" ? 3 : 1;
}

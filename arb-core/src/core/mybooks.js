// Фильтр «мои конторы»: показывать/рекомендовать только те БК, где ты реально
// можешь поставить (напр. в Казахстане). Чистые функции.
//
// Важно: «честная» вероятность рынка считается по ВСЕМ конторам (точнее), а
// лучший коэф. и рекомендация — только среди твоих. Так value остаётся верным:
// «моя контора даёт цену выше честной линии всего рынка».

// "1xBet, Melbet, Parimatch" → ["1xbet","melbet","parimatch"]
export function parseBooks(raw) {
  return String(raw || "")
    .split(",")
    .map(s => s.trim().toLowerCase().replace(/[^a-z0-9]/g, ""))
    .filter(Boolean);
}

// Разрешена ли контора (пустой список = все разрешены).
export function bookAllowed(title, myBooks) {
  if (!myBooks || !myBooks.length) return true;
  const t = String(title).toLowerCase().replace(/[^a-z0-9]/g, "");
  return myBooks.some(b => t.includes(b) || b.includes(t));
}

// Оставить в исходе только мои конторы; лучший коэф. = максимум среди моих.
// null, если ни одной моей конторы нет (ставить негде).
export function restrictOutcome(outcome, myBooks) {
  if (!myBooks || !myBooks.length) return outcome;
  const books = (outcome.books || []).filter(x => bookAllowed(x.bookmaker, myBooks));
  if (!books.length) return null;
  return { ...outcome, odds: books[0].odds, bookmaker: books[0].bookmaker, books };
}

// Применить фильтр ко всем исходам линии (исходы без моих контор выпадают).
export function restrictBestOutcomes(bestOutcomes = [], myBooks) {
  if (!myBooks || !myBooks.length) return bestOutcomes;
  const out = [];
  for (const o of bestOutcomes) {
    const r = restrictOutcome(o, myBooks);
    if (r) out.push(r);
  }
  return out;
}

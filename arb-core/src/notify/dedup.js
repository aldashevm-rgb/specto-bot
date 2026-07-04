// Дедуп возможностей для вотчера: одну и ту же линию не шлём повторно.
// Ключ включает конкретную ставку/контору — если появится лучшая цена у другой
// конторы, это уже новая возможность. Чистые функции.

export function surebetKey(sb) {
  return `SURE:${sb.id}:${sb.market}:${sb.line ?? "-"}:${sb.arb.marginPct}`;
}

export function valueKey(v) {
  const b = v.valueBet || {};
  return `VAL:${v.id}:${v.market}:${v.line ?? "-"}:${b.name}:${b.bookmaker}`;
}

// Из items оставить только те, чей ключ ещё не в seen; новые ключи добавить в seen.
export function pickNew(items = [], seen, keyFn) {
  const fresh = [];
  for (const it of items) {
    const k = keyFn(it);
    if (!seen.has(k)) { seen.add(k); fresh.push(it); }
  }
  return fresh;
}

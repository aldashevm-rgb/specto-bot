// Хранилище ожидающих подтверждения ставок (в памяти). Каждой ставке — короткий
// id (в кнопке Telegram) и срок годности: устаревшее подтверждение не сработает,
// потому что коэффициент к тому моменту уже уходит. Чистые функции.

// Короткий id для callback_data кнопки (детерминированно из счётчика/зерна).
export function shortId(seed) {
  return "b" + String(seed).replace(/\D/g, "").slice(-9);
}

// Добавить ставку в ожидание. store — Map. Возвращает id.
export function addPending(store, id, bet, nowMs, ttlMs) {
  store.set(id, { bet, expires: nowMs + ttlMs });
  return id;
}

// Забрать ставку по id (одноразово). null, если нет или просрочена.
export function takePending(store, id, nowMs) {
  const entry = store.get(id);
  if (!entry) return null;
  store.delete(id);
  if (entry.expires < nowMs) return null; // просрочено
  return entry.bet;
}

// Подчистить просроченные (чтобы Map не рос). Возвращает число удалённых.
export function sweepExpired(store, nowMs) {
  let n = 0;
  for (const [id, entry] of store) {
    if (entry.expires < nowMs) { store.delete(id); n += 1; }
  }
  return n;
}

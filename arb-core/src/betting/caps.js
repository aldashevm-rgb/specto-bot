// Тормоза автоставки (чистые функции). Проверяют размер ставки против лимитов,
// прежде чем что-либо ставить реальными деньгами.

// Проверить ставку против лимитов.
//   stake       — размер ставки
//   maxStake    — потолок на одну ставку
//   dailyCap    — дневной лимит суммарно
//   spentToday  — уже поставлено сегодня
// Возвращает { ok, reason }.
export function validateBet({ stake, maxStake, dailyCap, spentToday = 0 } = {}) {
  const s = Number(stake);
  if (!(s > 0)) return { ok: false, reason: "нулевая/некорректная ставка" };
  if (maxStake && s > maxStake) {
    return { ok: false, reason: `ставка ${s} выше лимита на ставку (${maxStake})` };
  }
  if (dailyCap && spentToday + s > dailyCap) {
    return { ok: false, reason: `превышен дневной лимит (${dailyCap}, уже ${spentToday})` };
  }
  return { ok: true };
}

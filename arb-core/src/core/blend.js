// Ансамбль вероятностей из нескольких независимых источников (консенсус рынка,
// модель Пуассона, LLM) + метрики калибровки (Brier, log-loss).
// Смешение независимых сигналов даёт более точный и устойчивый прогноз, чем
// любой источник по отдельности. Чистые функции.

// Взвешенное усреднение вероятностей по именам исходов.
// sources: [{ probs: { name: p }, weight }]. Возвращает { name: p } (сумма = 1).
export function blendProbs(sources = []) {
  const used = sources.filter(s => s && s.probs && Number(s.weight) > 0);
  if (!used.length) return null;
  const acc = {};
  for (const s of used) {
    for (const k of Object.keys(s.probs)) {
      const v = Number(s.probs[k]);
      if (!Number.isFinite(v)) continue;
      acc[k] = (acc[k] || 0) + Number(s.weight) * v;
    }
  }
  let sum = 0;
  for (const k of Object.keys(acc)) sum += acc[k];
  if (!(sum > 0)) return null;
  const out = {};
  for (const k of Object.keys(acc)) out[k] = acc[k] / sum;
  return out;
}

// Мера согласия источников: 1 − средняя L1-дистанция между источниками и
// ансамблем (0..1, выше — источники согласованнее → выше доверие прогнозу).
export function agreement(sources = [], blended = null) {
  const used = sources.filter(s => s && s.probs && Number(s.weight) > 0);
  if (used.length < 2 || !blended) return null;
  const keys = Object.keys(blended);
  let dist = 0;
  for (const s of used) {
    let d = 0;
    for (const k of keys) d += Math.abs((Number(s.probs[k]) || 0) - blended[k]);
    dist += d / 2; // L1/2 ∈ [0,1]
  }
  const avg = dist / used.length;
  return Math.max(0, Math.min(1, 1 - avg));
}

// Brier score (мультикласс): Σ (p_k − y_k)². 0 — идеально, 2 — худший.
export function brierScore(probs = {}, winnerKey) {
  const keys = new Set([...Object.keys(probs), winnerKey]);
  let s = 0;
  for (const k of keys) {
    const p = Number(probs[k]) || 0;
    const y = k === winnerKey ? 1 : 0;
    s += (p - y) ** 2;
  }
  return Math.round(s * 1e6) / 1e6;
}

// Log-loss для фактического исхода: −ln(p_winner). Меньше — точнее.
export function logLoss(probs = {}, winnerKey) {
  const p = Math.max(1e-12, Number(probs[winnerKey]) || 0);
  return Math.round(-Math.log(p) * 1e6) / 1e6;
}

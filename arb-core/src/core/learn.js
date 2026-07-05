// Самообучение: по факту сыгравших ставок оцениваем, какой источник прогноза
// (консенсус / Пуассон / LLM) точнее калибрует вероятности, и пересчитываем веса
// ансамбля — точнее источник получает больший вес. Чистая функция.
//
// ВАЖНО: это учит бота, какая из его моделей точнее, а НЕ «как обыграть рынок».
// Работает только на большой выборке (иначе подстройка под шум) — отсюда порог
// minSamples: пока сыгравших мало, возвращаем null и остаёмся на базовых весах.

import { brierScore } from "./blend.js";

function round3(x) { return Math.round(Number(x) * 1000) / 1000; }

// graded: записи лога с { source_probs: {label: {name:p}}, winner: name }.
// Возвращает { weights, brier, samples } или null (данных мало).
export function learnWeights(graded = [], { minSamples = 20 } = {}) {
  const acc = {}; // label → { sum, n }
  for (const r of graded) {
    const sp = r.source_probs;
    const w = r.winner;
    if (!sp || !w) continue;
    for (const [label, probs] of Object.entries(sp)) {
      if (!probs || probs[w] == null) continue;
      acc[label] = acc[label] || { sum: 0, n: 0 };
      acc[label].sum += brierScore(probs, w);
      acc[label].n += 1;
    }
  }
  const labels = Object.keys(acc).filter(l => acc[l].n >= minSamples);
  if (labels.length < 2) return null; // учиться рано

  const inv = {};
  let sum = 0;
  for (const l of labels) {
    const avgBrier = acc[l].sum / acc[l].n;
    const w = avgBrier > 0 ? 1 / avgBrier : 0; // ниже Brier → выше вес
    inv[l] = w;
    sum += w;
  }
  if (!(sum > 0)) return null;

  const weights = {}, brier = {}, samples = {};
  for (const l of labels) {
    weights[l] = round3(inv[l] / sum);
    brier[l] = round3(acc[l].sum / acc[l].n);
    samples[l] = acc[l].n;
  }
  return { weights, brier, samples };
}

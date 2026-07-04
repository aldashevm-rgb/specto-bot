// Движок прогноза: сводит независимые источники в финальную вероятность и
// считает value-перевес против лучших коэффициентов. Чистые функции.

import { blendProbs, agreement } from "./blend.js";

// Веса источников по умолчанию: рынок (консенсус) — сильнейший, затем модель,
// затем LLM. Переопределяются через config.
export const DEFAULT_WEIGHTS = { consensus: 0.5, model: 0.3, ai: 0.2 };

// probs с ключами исходов → value-перевес по каждому исходу против его коэф.
// probsByName: { name: p }; bestOutcomes: [{name, odds, bookmaker}].
// edge = p·odds − 1 (>0 — ставка выгодна по модели). Сортировка по убыванию.
export function computeEdges(probsByName = {}, bestOutcomes = []) {
  const edges = [];
  for (const o of bestOutcomes) {
    const p = probsByName[o.name];
    if (p == null) continue;
    const edge = p * o.odds - 1;
    edges.push({
      name: o.name,
      odds: o.odds,
      bookmaker: o.bookmaker,
      modelProb: Math.round(p * 1000) / 10, // %
      edgePct: Math.round(edge * 1000) / 10
    });
  }
  edges.sort((a, b) => b.edgePct - a.edgePct);
  return edges;
}

// Собрать прогноз из именованных источников.
// sources: [{ label, probs: {name:p}, weight }]; bestOutcomes для расчёта edge.
// Возвращает { probs, edges, top, agreement, sources } или null.
export function buildPrediction({ sources = [], bestOutcomes = [] } = {}) {
  const probs = blendProbs(sources);
  if (!probs) return null;
  const edges = computeEdges(probs, bestOutcomes);
  return {
    probs,
    edges,
    top: edges[0] || null,
    agreement: agreement(sources, probs),
    sources: sources.filter(s => s && s.probs && Number(s.weight) > 0).map(s => s.label)
  };
}

// Хелперы приведения {home,draw,away}/{over,under} к именам исходов рынка.
export function hdaToNamed({ home, draw, away }, homeName, awayName, drawName = "Draw") {
  const m = {};
  if (home != null) m[homeName] = home;
  if (draw != null) m[drawName] = draw;
  if (away != null) m[awayName] = away;
  return m;
}

export function ouToNamed({ over, under }) {
  const m = {};
  if (over != null) m.Over = over;
  if (under != null) m.Under = under;
  return m;
}

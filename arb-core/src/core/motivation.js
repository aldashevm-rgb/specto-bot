// ИИ-анализ матча: «кому нужнее победа» и «какой исход вероятнее».
// Это слой поверх математики вилок — он не ищет арбитраж, а объясняет и
// приоритизирует события: где реальная вероятность заметно расходится с линией
// букмекера. Форсируем структурированный ответ через tool-call (как в qualify.js).

import { config } from "../config.js";
import { withRetry } from "../util/http.js";

const SYSTEM_PROMPT =
  `Ты — спортивный аналитик. Тебе дают контекст матча: команды, форму, ` +
  `положение в таблице. Оцени, КОМУ нужнее победа (турнирная мотивация) и ` +
  `какой исход вероятнее. Опирайся ТОЛЬКО на переданные факты, не выдумывай ` +
  `состав и травмы, если их нет. Вероятности трёх исходов (П1/Х/П2) должны в ` +
  `сумме давать ~100. Отвечай строго вызовом инструмента record_match_read.`;

// Инструмент со схемой — модель обязана вернуть валидный JSON.
export const MATCH_TOOL = {
  name: "record_match_read",
  description: "Записать разбор матча: мотивация сторон и вероятный исход.",
  input_schema: {
    type: "object",
    properties: {
      needs_win: {
        type: "string",
        description: "Кому нужнее победа: home | away | both | neither (+ короткое почему)."
      },
      likely_outcome: {
        type: "string",
        description: "Наиболее вероятный исход: home | draw | away."
      },
      prob_home: { type: "integer", description: "Вероятность победы хозяев, %." },
      prob_draw: { type: "integer", description: "Вероятность ничьей, %." },
      prob_away: { type: "integer", description: "Вероятность победы гостей, %." },
      confidence: {
        type: "integer",
        description: "Уверенность модели в разборе 0–100 (мало данных → ниже)."
      },
      reasoning: { type: "string", description: "1–2 предложения обоснования." }
    },
    required: ["needs_win", "likely_outcome", "prob_home", "prob_draw", "prob_away", "confidence"]
  }
};

// Нормализуем проценты исходов к сумме 100 и вернём вероятности как доли [0..1].
export function normalizeProbs({ prob_home, prob_draw, prob_away }) {
  const h = Math.max(0, Number(prob_home) || 0);
  const d = Math.max(0, Number(prob_draw) || 0);
  const a = Math.max(0, Number(prob_away) || 0);
  const sum = h + d + a;
  if (sum <= 0) return null;
  return { home: h / sum, draw: d / sum, away: a / sum };
}

// tool_use.input → чистый объект разбора или null.
export function parseMatchRead(input) {
  if (!input || typeof input !== "object") return null;
  const probs = normalizeProbs(input);
  if (!probs) return null;
  const clampC = Math.max(0, Math.min(100, Math.round(Number(input.confidence) || 0)));
  return {
    needsWin: String(input.needs_win || "neither"),
    likelyOutcome: String(input.likely_outcome || "draw"),
    probs, // { home, draw, away } как доли
    confidence: clampC,
    reasoning: input.reasoning ? String(input.reasoning) : ""
  };
}

// Запрос к Claude. context — строка сводки (см. apiFootball.summarizeContext).
// Возвращает разбор матча или null при ошибке/отсутствии ключа.
export async function readMatch({ home, away, context = "" } = {}) {
  if (!config.anthropicKey) {
    console.error("ANTHROPIC_API_KEY не задан — ИИ-разбор пропущен");
    return null;
  }
  const userMsg =
    `Матч: ${home} (хозяева) vs ${away} (гости).\n\n` +
    `Контекст:\n${context || "данных мало — оцени осторожно"}`;

  try {
    const data = await withRetry(
      async () => {
        const res = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": config.anthropicKey,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: config.claudeModel,
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            tools: [MATCH_TOOL],
            tool_choice: { type: "tool", name: "record_match_read" },
            messages: [{ role: "user", content: userMsg }]
          })
        });
        if (!res.ok) {
          const body = await res.text();
          const err = new Error(`Claude ${res.status}: ${body}`);
          err.status = res.status;
          throw err;
        }
        return res.json();
      },
      {
        retries: 2,
        baseMs: 800,
        label: "Claude match-read",
        retryOn: (err) => !err.status || err.status >= 500 || err.status === 429
      }
    );

    const toolUse = Array.isArray(data?.content)
      ? data.content.find(b => b.type === "tool_use" && b.name === "record_match_read")
      : null;
    return parseMatchRead(toolUse?.input);
  } catch (err) {
    console.error("Ошибка ИИ-разбора матча:", err.message);
    return null;
  }
}

// Сравнение вероятности модели с линией букмекера → value (перевес).
// modelProbs: { home, draw, away } (доли); bestOutcomes: [{name, odds}].
// Возвращает по каждому исходу edge = p_model * odds - 1 (>0 — ставка выгодна).
// Мостик между ИИ-прогнозом и коэффициентами: даже без чистой вилки видно, где
// линия недооценивает вероятный исход.
export function valueEdges({ home, away }, modelProbs, bestOutcomes = []) {
  if (!modelProbs) return [];
  const pByName = new Map();
  for (const oc of bestOutcomes) {
    const nm = String(oc.name);
    if (nm === home) pByName.set(nm, { p: modelProbs.home, ...oc });
    else if (nm === away) pByName.set(nm, { p: modelProbs.away, ...oc });
    else pByName.set(nm, { p: modelProbs.draw, ...oc }); // Draw / ничья
  }
  const edges = [];
  for (const [name, o] of pByName) {
    const edge = o.p * o.odds - 1;
    edges.push({
      name,
      odds: o.odds,
      bookmaker: o.bookmaker,
      modelProb: Math.round(o.p * 100),
      edgePct: Math.round(edge * 1000) / 10 // % с одним знаком
    });
  }
  edges.sort((a, b) => b.edgePct - a.edgePct);
  return edges;
}

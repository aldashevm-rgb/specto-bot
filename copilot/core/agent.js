// Агентный цикл кодинг-ассистента. Модель думает, вызывает инструменты,
// видит результаты и продолжает, пока не завершит ход (end_turn).

import fs from "node:fs";
import path from "node:path";
import { streamTurn, mainProvider } from "./providers.js";
import { TOOL_DEFS, runTool } from "./tools.js";
import { loadMemory } from "./memory.js";

export const SYSTEM_PROMPT = `Ты — кодинг-ассистент (аналог Copilot/Codex), работающий прямо в репозитории пользователя.

Твои возможности через инструменты: читать и искать по файлам, писать и править код, запускать команды (сборка, тесты, git).

Как вести многошаговые задачи:
- Разбей задачу на шаги и выполняй по одному: сначала изучи код (прочитай файлы, найди связанные места), потом меняй.
- Делай минимальные точечные изменения в стиле окружающего кода. Не переписывай лишнего.
- После правок проверь себя: запусти тесты или линтер, при ошибке — исправь и повтори.
- Доводи задачу до конца. Не останавливайся на середине; сообщай о завершении, только когда всё готово.
- Отвечай кратко. Веди пользователя: скажи, что делаешь и что получилось. По-русски, если пользователь пишет по-русски.

Долговременная память: инструмент remember сохраняет факты между сессиями. Сохраняй в неё важное на будущее — предпочтения пользователя, соглашения проекта, принятые решения — и опирайся на уже сохранённые заметки (они ниже, если есть). Не дублируй уже известное.`;

// Файлы с инструкциями проекта (как AGENTS.md у Codex / CLAUDE.md). Если есть в
// корне — их содержимое добавляется к системному промпту, и ассистент следует
// правилам проекта.
const INSTRUCTION_FILES = ["AGENTS.md", "COPILOT.md", ".copilot.md", "CLAUDE.md"];

function loadSystemPrompt(root) {
  let sys = SYSTEM_PROMPT;
  // Инструкции проекта (AGENTS.md и т.п.).
  for (const name of INSTRUCTION_FILES) {
    try {
      const txt = fs.readFileSync(path.join(root, name), "utf8");
      if (txt.trim()) {
        sys += `\n\n# Инструкции проекта (${name}) — соблюдай их\n${txt.slice(0, 6000)}`;
        break;
      }
    } catch {
      /* нет файла — пропускаем */
    }
  }
  // Долговременная память из прошлых сессий.
  const mem = loadMemory(root);
  if (mem) sys += `\n\n# Твоя память (заметки из прошлых сессий)\n${mem.slice(0, 6000)}`;
  return sys;
}

// Управление контекстом: перед отправкой сворачиваем старые результаты
// инструментов, оставляя последние keepRecent в полном виде. Так длинная
// многошаговая задача не упирается в лимит токенов (важно для бесплатных
// тарифов). Полная история хранится локально — режется только копия для запроса.
function trimForRequest(history, keepRecent = 4, capChars = 6000) {
  const total = history.reduce(
    (n, m) => n + (Array.isArray(m.content) ? m.content.filter((b) => b.type === "tool_result").length : 0),
    0
  );
  let idx = 0;
  return history.map((m) => {
    if (!Array.isArray(m.content)) return m;
    return {
      ...m,
      content: m.content.map((b) => {
        if (b.type !== "tool_result") return b;
        const myIdx = idx++;
        const s = typeof b.content === "string" ? b.content : JSON.stringify(b.content);
        if (myIdx < total - keepRecent && s.length > 200) {
          return { ...b, content: `[результат инструмента свёрнут для экономии контекста — ${s.length} симв.]` };
        }
        if (s.length > capChars) {
          return { ...b, content: s.slice(0, capChars) + "\n…[обрезано]" };
        }
        return b;
      }),
    };
  });
}

// Прогоняет один пользовательский запрос через агентный цикл.
// history — массив сообщений [{role, content}] (мутируется: дописываются ходы).
// onEvent получает события из client + {type:'tool_result', name, ok, preview}
//   и {type:'turn_end'} по завершении.
// Инструмент авто-эскалации: бесплатная модель сама зовёт его, когда задача
// слишком сложная, и решение продолжает умная модель.
const ESCALATE_TOOL = {
  name: "escalate",
  description:
    "Передать текущую задачу более умной модели, если она слишком сложная для тебя (крупный рефакторинг, хитрый баг, нетривиальная логика или архитектура). Используй ЭКОНОМНО — только когда реально буксуешь; простое решай сам.",
  input_schema: {
    type: "object",
    properties: { reason: { type: "string", description: "Почему нужна умная модель" } },
  },
};

// provider — с чего начинаем (по умолчанию основной, бесплатный).
// escalateTo — сильная модель для авто-эскалации (или null, если недоступна).
export async function runAgent({ history, root, provider, escalateTo, maxSteps = 60, onEvent = () => {} }) {
  const ctx = { root };
  let cfg = provider || mainProvider();
  const system = loadSystemPrompt(root);
  const canEscalate =
    escalateTo && (escalateTo.kind !== cfg.kind || escalateTo.model !== cfg.model);
  let escalated = false;
  let steps = 0;

  for (;;) {
    if (steps++ >= maxSteps) {
      onEvent({ type: "text", text: "\n[достигнут лимит шагов]\n" });
      break;
    }

    const tools = canEscalate && !escalated ? [...TOOL_DEFS, ESCALATE_TOOL] : TOOL_DEFS;
    const res = await streamTurn(cfg, { system, messages: trimForRequest(history), tools }, onEvent);

    history.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") break;

    const toolUses = res.content.filter((b) => b.type === "tool_use");
    const results = [];
    for (const tu of toolUses) {
      // Эскалация: переключаемся на умную модель до конца задачи.
      if (tu.name === "escalate" && canEscalate) {
        escalated = true;
        cfg = escalateTo;
        onEvent({ type: "text", text: `\n⬆️ Задача сложная — переключаюсь на умную модель (${escalateTo.label}).\n` });
        onEvent({ type: "tool_result", name: "escalate", input: tu.input, ok: true, preview: "→ " + escalateTo.label });
        results.push({
          type: "tool_result",
          tool_use_id: tu.id,
          content: "Теперь ты — более умная модель. Продолжай и доведи задачу до конца.",
          is_error: false,
        });
        continue;
      }

      let ok = true;
      let output;
      try {
        output = await runTool(tu.name, tu.input, ctx);
      } catch (e) {
        ok = false;
        output = "Ошибка: " + e.message;
      }
      onEvent({
        type: "tool_result",
        name: tu.name,
        input: tu.input,
        ok,
        preview: String(output).slice(0, 300),
      });
      results.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: String(output),
        is_error: !ok,
      });
    }
    history.push({ role: "user", content: results });
  }

  onEvent({ type: "turn_end" });
  return history;
}

// Агентный цикл кодинг-ассистента. Модель думает, вызывает инструменты,
// видит результаты и продолжает, пока не завершит ход (end_turn).

import { streamTurn, mainProvider } from "./providers.js";
import { TOOL_DEFS, runTool } from "./tools.js";

export const SYSTEM_PROMPT = `Ты — кодинг-ассистент (аналог Copilot/Codex), работающий прямо в репозитории пользователя.

Твои возможности через инструменты: читать и искать по файлам, писать и править код, запускать команды (сборка, тесты, git).

Принципы:
- Прежде чем менять код — изучи существующий: прочитай нужные файлы, найди связанные места.
- Делай минимальные точечные изменения в стиле окружающего кода. Не переписывай лишнего.
- После правок по возможности проверь себя: запусти тесты или линтер.
- Отвечай кратко и по делу. Веди пользователя: скажи, что делаешь, и что получилось.
- Пиши на русском, если пользователь пишет на русском.`;

// Прогоняет один пользовательский запрос через агентный цикл.
// history — массив сообщений [{role, content}] (мутируется: дописываются ходы).
// onEvent получает события из client + {type:'tool_result', name, ok, preview}
//   и {type:'turn_end'} по завершении.
export async function runAgent({ history, root, provider, maxSteps = 40, onEvent = () => {} }) {
  const ctx = { root };
  const cfg = provider || mainProvider();
  let steps = 0;

  for (;;) {
    if (steps++ >= maxSteps) {
      onEvent({ type: "text", text: "\n[достигнут лимит шагов]\n" });
      break;
    }

    const res = await streamTurn(
      cfg,
      {
        system: SYSTEM_PROMPT,
        messages: history,
        tools: TOOL_DEFS,
      },
      onEvent
    );

    history.push({ role: "assistant", content: res.content });

    if (res.stop_reason !== "tool_use") break;

    // Выполняем все запрошенные инструменты, результаты — одним user-сообщением.
    const toolUses = res.content.filter((b) => b.type === "tool_use");
    const results = [];
    for (const tu of toolUses) {
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

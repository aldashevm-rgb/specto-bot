// Клиент Claude Messages API (raw fetch, в стиле handlers/aiChat.js).
// Поддерживает стриминг и корректно собирает content-блоки (включая thinking
// с подписью), чтобы их можно было вернуть модели на следующем ходу.

const API_URL = "https://api.anthropic.com/v1/messages";
const API_KEY = process.env.ANTHROPIC_API_KEY;

// Модель кодинг-ассистента. По умолчанию — самая способная для агентной работы.
export const MODEL = process.env.COPILOT_MODEL || "claude-opus-5";
// Уровень усилий: low | medium | high | xhigh | max. Для кодинга — high.
export const EFFORT = process.env.COPILOT_EFFORT || "high";

export class ApiError extends Error {
  constructor(status, body) {
    super(`Claude API ${status}: ${body}`);
    this.status = status;
    this.body = body;
  }
}

// Стримит один ход модели. Возвращает финальное сообщение
// { content, stop_reason, usage, model }.
// onEvent получает события: {type:'text', text}, {type:'thinking'},
// {type:'tool_use', name, id}, {type:'usage', usage}.
export async function streamMessage(
  { system, messages, tools, model = MODEL, maxTokens = 16000, effort = EFFORT },
  onEvent = () => {}
) {
  if (!API_KEY) throw new Error("ANTHROPIC_API_KEY не задан");

  const body = {
    model,
    max_tokens: maxTokens,
    stream: true,
    thinking: { type: "adaptive", display: "summarized" },
    output_config: { effort },
    messages,
  };
  if (system) body.system = system;
  if (tools && tools.length) body.tools = tools;

  const res = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => "");
    throw new ApiError(res.status, errText);
  }

  const blocks = [];
  let stopReason = null;
  let usage = null;
  let respModel = model;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });

    // SSE-кадры разделены двойным переводом строки.
    let idx;
    while ((idx = buf.indexOf("\n\n")) !== -1) {
      const frame = buf.slice(0, idx);
      buf = buf.slice(idx + 2);
      const line = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;
      let evt;
      try {
        evt = JSON.parse(data);
      } catch {
        continue;
      }
      handleEvent(evt);
    }
  }

  function handleEvent(evt) {
    switch (evt.type) {
      case "message_start":
        respModel = evt.message?.model || respModel;
        if (evt.message?.usage) usage = evt.message.usage;
        break;
      case "content_block_start": {
        const b = evt.content_block;
        const block = { ...b };
        if (b.type === "text") block.text = b.text || "";
        if (b.type === "thinking") {
          block.thinking = b.thinking || "";
          block.signature = b.signature || "";
        }
        if (b.type === "tool_use") {
          block.input = {};
          block._partial = "";
          onEvent({ type: "tool_use", name: b.name, id: b.id });
        }
        blocks[evt.index] = block;
        break;
      }
      case "content_block_delta": {
        const block = blocks[evt.index];
        if (!block) break;
        const d = evt.delta;
        if (d.type === "text_delta") {
          block.text += d.text;
          onEvent({ type: "text", text: d.text });
        } else if (d.type === "thinking_delta") {
          block.thinking += d.thinking;
          onEvent({ type: "thinking", text: d.thinking });
        } else if (d.type === "signature_delta") {
          block.signature += d.signature;
        } else if (d.type === "input_json_delta") {
          block._partial += d.partial_json;
        }
        break;
      }
      case "content_block_stop": {
        const block = blocks[evt.index];
        if (block && block.type === "tool_use") {
          try {
            block.input = block._partial ? JSON.parse(block._partial) : {};
          } catch {
            block.input = {};
          }
          delete block._partial;
        }
        break;
      }
      case "message_delta":
        if (evt.delta?.stop_reason) stopReason = evt.delta.stop_reason;
        if (evt.usage) usage = { ...(usage || {}), ...evt.usage };
        break;
      case "message_stop":
        if (usage) onEvent({ type: "usage", usage });
        break;
      default:
        break;
    }
  }

  // Убираем внутренние поля из блоков перед возвратом модели.
  const content = blocks
    .filter(Boolean)
    .map((b) => {
      const { _partial, ...rest } = b;
      return rest;
    });

  return { content, stop_reason: stopReason, usage, model: respModel };
}

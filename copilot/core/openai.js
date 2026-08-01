// OpenAI-совместимый провайдер. Работает с локальной Ollama (бесплатно),
// а также с дешёвыми API (DeepSeek, Groq, OpenRouter, Gemini через openai-совм.).
// Внутри переводит историю из формата Anthropic-блоков в формат OpenAI и обратно,
// чтобы агентный цикл (agent.js) не зависел от провайдера.

// Anthropic-история → OpenAI messages.
function toOpenAIMessages(system, history) {
  const out = [];
  if (system) out.push({ role: "system", content: system });
  for (const m of history) {
    if (m.role === "user") {
      if (typeof m.content === "string") {
        out.push({ role: "user", content: m.content });
      } else {
        // Массив: tool_result-блоки → отдельные tool-сообщения.
        for (const b of m.content) {
          if (b.type === "tool_result") {
            out.push({
              role: "tool",
              tool_call_id: b.tool_use_id,
              content: typeof b.content === "string" ? b.content : JSON.stringify(b.content),
            });
          } else if (b.type === "text") {
            out.push({ role: "user", content: b.text });
          }
        }
      }
    } else if (m.role === "assistant") {
      if (typeof m.content === "string") {
        out.push({ role: "assistant", content: m.content });
        continue;
      }
      let text = "";
      const toolCalls = [];
      for (const b of m.content) {
        if (b.type === "text") text += b.text;
        else if (b.type === "tool_use") {
          toolCalls.push({
            id: b.id,
            type: "function",
            function: { name: b.name, arguments: JSON.stringify(b.input || {}) },
          });
        }
        // thinking-блоки пропускаем — OpenAI-формат их не принимает.
      }
      const msg = { role: "assistant", content: text || null };
      if (toolCalls.length) msg.tool_calls = toolCalls;
      out.push(msg);
    }
  }
  return out;
}

function toOpenAITools(tools) {
  return (tools || []).map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.input_schema },
  }));
}

let idCounter = 0;

// Резерв ответа. У бесплатных тарифов (Groq) лимит токенов/минуту считает и
// max_tokens — большой резерв быстро упирается в лимит. Держим умеренно.
const MAX_TOKENS = Number(process.env.COPILOT_MAX_TOKENS) || 4096;

// POST с авто-повтором при 429 (rate limit): ждём секунды из тела ответа и
// пробуем снова — так бесплатный тариф не роняет запрос, а просто притормаживает.
async function postWithRetry(url, opts, onEvent, maxRetries = 5) {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, opts);
    if (res.status !== 429 || attempt >= maxRetries) return res;
    const body = await res.text().catch(() => "");
    const m = body.match(/try again in ([\d.]+)\s*s/i);
    const waitS = m ? Math.min(Math.ceil(parseFloat(m[1])) + 1, 60) : 8;
    onEvent({ type: "text", text: `\n⏳ Лимит бесплатного тарифа — жду ${waitS}с и продолжаю...\n` });
    await new Promise((r) => setTimeout(r, waitS * 1000));
  }
}

// Стримит один ход через OpenAI-совместимый эндпоинт.
// cfg: { baseUrl, apiKey, model }
export async function streamOpenAI(
  cfg,
  { system, messages, tools, maxTokens = MAX_TOKENS },
  onEvent = () => {}
) {
  const body = {
    model: cfg.model,
    max_tokens: maxTokens,
    stream: true,
    messages: toOpenAIMessages(system, messages),
  };
  if (tools && tools.length) {
    body.tools = toOpenAITools(tools);
    body.tool_choice = "auto";
  }

  const res = await postWithRetry(
    cfg.baseUrl.replace(/\/$/, "") + "/chat/completions",
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(cfg.apiKey ? { authorization: "Bearer " + cfg.apiKey } : {}),
      },
      body: JSON.stringify(body),
    },
    onEvent
  );

  if (!res.ok || !res.body) {
    const t = await res.text().catch(() => "");
    throw new Error(`OpenAI-провайдер ${res.status}: ${t}`);
  }

  let text = "";
  const toolCalls = []; // index → {id, name, args}
  let finish = null;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
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
      const choice = evt.choices?.[0];
      if (!choice) continue;
      const d = choice.delta || {};
      if (d.content) {
        text += d.content;
        onEvent({ type: "text", text: d.content });
      }
      if (d.tool_calls) {
        for (const tc of d.tool_calls) {
          const i = tc.index ?? 0;
          if (!toolCalls[i]) {
            toolCalls[i] = { id: tc.id || `call_${++idCounter}`, name: "", args: "" };
            if (tc.function?.name) onEvent({ type: "tool_use", name: tc.function.name, id: toolCalls[i].id });
          }
          if (tc.id) toolCalls[i].id = tc.id;
          if (tc.function?.name) toolCalls[i].name += tc.function.name;
          if (tc.function?.arguments) toolCalls[i].args += tc.function.arguments;
        }
      }
      if (choice.finish_reason) finish = choice.finish_reason;
    }
  }

  // Собираем ответ в формате Anthropic-блоков.
  const content = [];
  if (text) content.push({ type: "text", text });
  for (const tc of toolCalls.filter(Boolean)) {
    let input = {};
    try {
      input = tc.args ? JSON.parse(tc.args) : {};
    } catch {
      input = {};
    }
    content.push({ type: "tool_use", id: tc.id, name: tc.name, input });
  }

  const stop_reason =
    finish === "tool_calls" || toolCalls.filter(Boolean).length ? "tool_use" : "end_turn";

  return { content, stop_reason, model: cfg.model };
}

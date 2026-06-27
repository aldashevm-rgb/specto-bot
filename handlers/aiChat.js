const SYSTEM_PROMPT = `Ты — Алина, менеджер по продажам компании SPECTO.
Ты общаешься с потенциальным клиентом в мессенджере.

О SPECTO:
- Система роста продаж под ключ
- Берём весь цикл: маркетинг + контент + отдел продаж
- Оплата ТОЛЬКО 10% с фактических продаж. Без фиксов. Без окладов.
- Клиент не рискует деньгами — платит только когда зарабатывает
- Работаем с бизнесами: мебель, строительство, недвижимость, производство, медицина, авто, B2B, франшизы
- Кейсы: STALFED +278% выручки за 6 мес, Monaco Detailing +189% выручки, корпусная мебель +173%

ТВОЯ ЦЕЛЬ: Закрыть клиента на встречу или звонок с руководителем SPECTO.

ПРАВИЛА:
- Пиши коротко — максимум 3-4 предложения
- Говори как живой человек, не как робот
- Сначала выясни какой бизнес и какая главная проблема
- Потом презентуй SPECTO под его конкретную боль
- Если говорит дорого — объясни что 10% только с продаж, риска нет
- Если говорит подумаю — спроси что именно смущает
- Если говорит уже пробовали — спроси что именно не сработало
- Закрывай фразой типа Когда вам удобно созвониться на 20 минут?
- Если клиент говорит не нужно или передумал — вежливо попрощайся`;

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const API_KEY = process.env.ANTHROPIC_API_KEY;

// Anthropic требует, чтобы messages начинались с роли user и роли чередовались.
// Нормализуем: убираем ведущие assistant-сообщения и склеиваем подряд идущие
// сообщения одной роли (бывает, если предыдущий ответ Claude не сохранился).
export function normalizeMessages(history) {
  const out = [];
  for (const m of history) {
    if (!m || !m.content) continue;
    const role = m.role === "assistant" ? "assistant" : "user";
    if (out.length === 0 && role !== "user") continue; // первый — только user
    const last = out[out.length - 1];
    if (last && last.role === role) {
      last.content += "\n" + m.content;
    } else {
      out.push({ role, content: m.content });
    }
  }
  return out;
}

// Возвращает текст ответа или null, если запрос не удался.
export async function askClaude(history = []) {
  if (!API_KEY) {
    console.error("ANTHROPIC_API_KEY не задан");
    return null;
  }

  const messages = normalizeMessages(history);
  if (messages.length === 0) return null;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Claude API error:", res.status, errText);
      return null;
    }

    const data = await res.json();
    const text = data?.content?.[0]?.text?.trim();
    return text || null;
  } catch (err) {
    console.error("Ошибка запроса к Claude:", err);
    return null;
  }
}
const SYSTEM_PROMPT = `Ты — лина, менеджер по продажам компании SPECTO.
Ты общаешься с потенциальным клиентом в мессенджере.

 SPECTO:
- Система роста продаж под ключ
- ерём весь цикл: маркетинг + контент + отдел продаж
- плата ТЬ 10% с фактических продаж. ез фиксов. ез окладов.
- лиент не рискует деньгами — платит только когда зарабатывает
- аботаем с бизнесами: мебель, строительство, недвижимость, производство, медицина, авто, B2B, франшизы
- ейсы: STALFED +278% выручки за 6 мес, Monaco Detailing +189% выручки, корпусная мебель +173%

ТЯ Ь: акрыть клиента на встречу или звонок с руководителем SPECTO.

:
- иши коротко — максимум 3-4 предложения
- овори как живой человек, не как робот
- Сначала выясни какой бизнес и какая главная проблема
- отом презентуй SPECTO под его конкретную боль
- сли говорит дорого — объясни что 10% только с продаж, риска нет
- сли говорит подумаю — спроси что именно смущает
- сли говорит уже пробовали — спроси что именно не сработало
- акрывай фразой типа огда вам удобно созвониться на 20 минут?
- сли клиент говорит не нужно или передумал — вежливо попрощайся`;

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const API_KEY = process.env.ANTHROPIC_API_KEY;

export function normalizeMessages(history) {
  const out = [];
  for (const m of history) {
    if (!m || !m.content) continue;
    const role = m.role === "assistant" ? "assistant" : "user";
    if (out.length === 0 && role !== "user") continue;
    const last = out[out.length - 1];
    if (last && last.role === role) {
      last.content += "\n" + m.content;
    } else {
      out.push({ role, content: m.content });
    }
  }
  return out;
}

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
    console.error("шибка запроса к Claude:", err);
    return null;
  }
}
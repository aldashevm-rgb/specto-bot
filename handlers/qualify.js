import {
  getRecentWaChats,
  getLeadForPhone,
  getConversation,
  saveQualification,
  isDbReady
} from "../db.js";

// ИИ-квалификация лидов по переписке в WhatsApp.
//
// Поток: берём чаты из whatsapp_messages → находим лид (по последним 10 цифрам
// номера = leads.phone_norm в рамках project_id) → отправляем переписку в Claude →
// получаем оценку 0–100 и структурный профиль → пишем в leads.ai_qual_*.

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT =
  `Ты — аналитик отдела продаж компании SPECTO. Тебе дают переписку менеджера ` +
  `с потенциальным клиентом в WhatsApp. Оцени лида: насколько он близок к покупке ` +
  `и что мы о нём знаем. Опирайся ТОЛЬКО на факты из переписки — не выдумывай. ` +
  `Если данных по полю нет, пиши "неизвестно". Отвечай строго вызовом инструмента ` +
  `record_qualification, без текста.`;

// Инструмент с input_schema — заставляет модель вернуть структурированный JSON
// (tool_choice ниже форсирует именно его), это надёжнее парсинга текста.
export const QUAL_TOOL = {
  name: "record_qualification",
  description: "Записать оценку квалификации лида по переписке в WhatsApp.",
  input_schema: {
    type: "object",
    properties: {
      score: {
        type: "integer",
        description:
          "Готовность к покупке от 0 до 100. 0 — холодный/отказ, " +
          "50 — интересуется, но сомневается, 100 — готов покупать сейчас."
      },
      budget: {
        type: "string",
        description:
          "Оценка бюджета клиента: неизвестно | низкий | средний | высокий. " +
          "Если в переписке есть конкретные суммы — добавь их."
      },
      urgency: {
        type: "string",
        description: "Срочность потребности: низкая | средняя | высокая."
      },
      niche: {
        type: "string",
        description:
          "Ниша/сфера бизнеса клиента или направление, которым он интересуется."
      },
      readiness: {
        type: "string",
        description: "Готовность к покупке одним словом: холодный | тёплый | горячий."
      },
      summary: {
        type: "string",
        description: "1–2 предложения: ключевой вывод о лиде и следующий шаг."
      },
      signals: {
        type: "array",
        items: { type: "string" },
        description: "Короткие факты-сигналы из переписки, повлиявшие на оценку."
      }
    },
    required: ["score", "budget", "urgency", "niche", "readiness", "summary"]
  }
};

// --- Чистые функции (тестируются без сети) ---

// Последние 10 цифр номера из chat_id ("77012424492@c.us" → "7012424492").
// Это и есть формат leads.phone_norm. null, если цифр < 10.
export function phoneLast10(chatId) {
  if (!chatId) return null;
  const digits = String(chatId).split("@")[0].replace(/\D/g, "");
  if (digits.length < 10) return null;
  return digits.slice(-10);
}

// Переписка → текст для модели. in = клиент, out = менеджер.
export function buildTranscript(messages = []) {
  const lines = [];
  for (const m of messages) {
    const text = (m && m.text ? String(m.text) : "").trim();
    if (!text) continue;
    const who = m.direction === "in" ? "Клиент" : "Менеджер";
    lines.push(`${who}: ${text}`);
  }
  return lines.join("\n");
}

// Достаточно ли в переписке сигнала, чтобы оценивать (есть реплики клиента).
export function hasEnoughSignal(messages = []) {
  const inbound = messages.filter(m => m && m.direction === "in" && m.text && m.text.trim());
  return inbound.length >= 1;
}

export function clampScore(value) {
  const n = Math.round(Number(value));
  if (Number.isNaN(n)) return null;
  return Math.max(0, Math.min(100, n));
}

// tool_use.input → { score, profile } или null, если score не распарсился.
export function parseQualification(input) {
  if (!input || typeof input !== "object") return null;
  const score = clampScore(input.score);
  if (score === null) return null;
  const profile = {
    budget: input.budget ?? "неизвестно",
    urgency: input.urgency ?? "неизвестно",
    niche: input.niche ?? "неизвестно",
    readiness: input.readiness ?? "неизвестно",
    summary: input.summary ?? "",
    signals: Array.isArray(input.signals) ? input.signals : []
  };
  return { score, profile };
}

// --- Вызов Claude ---

// Возвращает { score, profile } или null при ошибке/пустой переписке.
export async function qualifyConversation(messages) {
  if (!API_KEY) {
    console.error("ANTHROPIC_API_KEY не задан — квалификация пропущена");
    return null;
  }
  if (!hasEnoughSignal(messages)) return null;

  const transcript = buildTranscript(messages);
  if (!transcript) return null;

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
        tools: [QUAL_TOOL],
        tool_choice: { type: "tool", name: "record_qualification" },
        messages: [{ role: "user", content: `Переписка с клиентом:\n\n${transcript}` }]
      })
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Claude qualify error:", res.status, errText);
      return null;
    }

    const data = await res.json();
    const toolUse = Array.isArray(data?.content)
      ? data.content.find(b => b.type === "tool_use" && b.name === "record_qualification")
      : null;
    return parseQualification(toolUse?.input);
  } catch (err) {
    console.error("Ошибка запроса к Claude (qualify):", err);
    return null;
  }
}

// --- Оркестратор ---

// Проходит по чатам, квалифицирует подходящие лиды и (если не dryRun) пишет в БД.
// opts:
//   sinceIso   — окно по времени для отбора чатов (null = все, для бэкфилла)
//   limit      — максимум лидов на один прогон (по умолчанию без ограничения)
//   dryRun     — не писать в БД, только вернуть результат
//   restale    — переоценивать даже уже квалифицированные лиды
//   onlyChats  — массив chat_id: обработать только их (для теста на 1–2 лидах)
//   log        — функция логирования (по умолчанию console.log)
// Возвращает массив { chat_id, lead_id, status, score, profile }.
// status: qualified | dry_run | no_lead | already | no_signal | ai_failed
export async function processQualifications(opts = {}) {
  const {
    sinceIso = null,
    limit = Infinity,
    dryRun = false,
    restale = false,
    onlyChats = null,
    log = console.log
  } = opts;

  if (!isDbReady()) {
    log("Квалификация: БД не настроена — пропуск.");
    return [];
  }

  let chats = await getRecentWaChats({ sinceIso });
  if (onlyChats && onlyChats.length) {
    const want = new Set(onlyChats);
    chats = chats.filter(c => want.has(c.chat_id));
  }

  const results = [];
  let done = 0;

  for (const chat of chats) {
    if (done >= limit) break;

    const phoneNorm = phoneLast10(chat.chat_id);
    if (!phoneNorm) continue;

    const lead = await getLeadForPhone(phoneNorm, chat.project_id);
    if (!lead) {
      results.push({ chat_id: chat.chat_id, status: "no_lead" });
      continue;
    }

    if (lead.ai_qual_at && !restale) {
      results.push({ chat_id: chat.chat_id, lead_id: lead.id, status: "already" });
      continue;
    }

    const conversation = await getConversation(chat.chat_id);
    if (!hasEnoughSignal(conversation)) {
      results.push({ chat_id: chat.chat_id, lead_id: lead.id, status: "no_signal" });
      continue;
    }

    const qual = await qualifyConversation(conversation);
    if (!qual) {
      results.push({ chat_id: chat.chat_id, lead_id: lead.id, status: "ai_failed" });
      continue;
    }

    done += 1;

    if (dryRun) {
      results.push({
        chat_id: chat.chat_id,
        lead_id: lead.id,
        lead_name: lead.name,
        status: "dry_run",
        score: qual.score,
        profile: qual.profile
      });
      log(`[dry-run] ${lead.name || lead.id}: score=${qual.score} (${qual.profile.readiness})`);
      continue;
    }

    const ok = await saveQualification(lead.id, qual.score, qual.profile);
    results.push({
      chat_id: chat.chat_id,
      lead_id: lead.id,
      lead_name: lead.name,
      status: ok ? "qualified" : "ai_failed",
      score: qual.score,
      profile: qual.profile
    });
    if (ok) log(`✓ ${lead.name || lead.id}: score=${qual.score} (${qual.profile.readiness})`);
  }

  return results;
}

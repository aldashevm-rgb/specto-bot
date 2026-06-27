import {
  getRecentWaChats,
  getLeadForPhone,
  getConversation,
  getLastMessageAt,
  saveQualification,
  isDbReady,
  withRetry
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
  `Если данных по полю нет, пиши "неизвестно".\n\n` +
  `Шкала score (готовность к покупке):\n` +
  `0–20 — холодный/отказ/нецелевой (партнёрское предложение, спам, явный отказ);\n` +
  `21–40 — слабый интерес, запрос без конкретики (нет товара/объёма/города);\n` +
  `41–60 — интересуется, есть часть деталей, но не определился или сравнивает цены;\n` +
  `61–80 — тёплый: назвал конкретный товар, объём и/или город, оставил контакт, ждёт расчёт;\n` +
  `81–100 — горячий: жёсткая срочность, крупный объём, дал реквизиты/оплатил, готов покупать.\n\n` +
  `Отвечай строго вызовом инструмента record_qualification, без текста.`;

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
          "Готовность к покупке 0–100 по шкале из system-промпта: " +
          "0–20 холодный/отказ, 21–40 слабый интерес, 41–60 интересуется, " +
          "61–80 тёплый, 81–100 горячий."
      },
      budget: {
        type: "string",
        description:
          "Оценка бюджета клиента: неизвестно | низкий | средний | высокий. " +
          "Если в переписке есть конкретные суммы или объёмы — добавь их."
      },
      urgency: {
        type: "string",
        description: "Срочность потребности: низкая | средняя | высокая (+ срок, если назван)."
      },
      niche: {
        type: "string",
        description:
          "Ниша/сфера бизнеса клиента или направление, которым он интересуется (+ город/регион)."
      },
      category: {
        type: "string",
        description:
          "Категория товара одним словом из списка: ЖБИ | металлопрокат | кабель | " +
          "сэндвич-панели | опоры освещения | трубы | другое | не определено."
      },
      readiness: {
        type: "string",
        description: "Готовность к покупке одним словом: холодный | тёплый | горячий."
      },
      summary: {
        type: "string",
        description: "1–2 предложения: ключевой вывод о лиде."
      },
      next_step: {
        type: "string",
        description: "Рекомендуемый следующий шаг менеджера одной фразой (что сделать сейчас)."
      },
      signals: {
        type: "array",
        items: { type: "string" },
        description: "Короткие факты-сигналы из переписки, повлиявшие на оценку."
      }
    },
    required: ["score", "budget", "urgency", "niche", "category", "readiness", "summary", "next_step"]
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
    category: input.category ?? "не определено",
    readiness: input.readiness ?? "неизвестно",
    summary: input.summary ?? "",
    next_step: input.next_step ?? "",
    signals: Array.isArray(input.signals) ? input.signals : []
  };
  return { score, profile };
}

// Эвристика «сомнительной» оценки — для самопроверки качества сторожем.
// lead: { ai_qual_score, ai_qual_profile }. true → стоит переоценить.
export function isSuspicious(lead) {
  if (!lead) return false;
  const score = lead.ai_qual_score;
  const p = lead.ai_qual_profile || {};
  if (score === null || score === undefined) return true;
  const readiness = String(p.readiness || "").toLowerCase();
  // Противоречие: «горячий», но низкий балл — или «холодный», но высокий.
  if (readiness.includes("горяч") && score < 40) return true;
  if (readiness.includes("холод") && score > 60) return true;
  // Пустое резюме — оценка без обоснования.
  if (!p.summary || !String(p.summary).trim()) return true;
  // Высокий балл при неизвестной нише — подозрительно.
  if (String(p.niche || "").toLowerCase().includes("неизвестно") && score >= 65) return true;
  return false;
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
    // Ретраим временные сбои Claude (429/5xx/сеть) — меньше ложных ai_failed.
    const data = await withRetry(
      async () => {
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
          const err = new Error(`Claude ${res.status}: ${errText}`);
          err.status = res.status;
          throw err;
        }
        return res.json();
      },
      {
        retries: 2,
        baseMs: 800,
        label: "Claude qualify",
        retryOn: (err) => !err.status || err.status >= 500 || err.status === 429
      }
    );

    const toolUse = Array.isArray(data?.content)
      ? data.content.find(b => b.type === "tool_use" && b.name === "record_qualification")
      : null;
    return parseQualification(toolUse?.input);
  } catch (err) {
    console.error("Ошибка запроса к Claude (qualify):", err.message);
    return null;
  }
}

// --- Оркестратор ---

// Проходит по чатам, квалифицирует подходящие лиды и (если не dryRun) пишет в БД.
// opts:
//   sinceIso   — окно по времени для отбора чатов (null = все, для бэкфилла)
//   limit      — максимум лидов на один прогон (по умолчанию без ограничения)
//   dryRun     — не писать в БД, только вернуть результат
//   restale        — принудительно переоценивать ВСЕ уже квалифицированные лиды
//   restaleIfNewer — переоценивать лид, если в чате появились сообщения позже ai_qual_at
//   qcSuspicious   — переоценивать лид, если оценка выглядит сомнительной (isSuspicious)
//   onlyChats      — массив chat_id: обработать только их (для теста на 1–2 лидах)
//   log            — функция логирования (по умолчанию console.log)
// Возвращает массив { chat_id, lead_id, status, reason, score, profile }.
// status: qualified | dry_run | no_lead | already | no_signal | ai_failed
// reason: missing | restale | stale | qc (почему лид был переоценён)
export async function processQualifications(opts = {}) {
  const {
    sinceIso = null,
    limit = Infinity,
    dryRun = false,
    restale = false,
    restaleIfNewer = false,
    qcSuspicious = false,
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

    // Решаем, нужно ли (пере)оценивать этот лид и почему.
    let reason = null;
    if (!lead.ai_qual_at) reason = "missing";
    else if (restale) reason = "restale";
    else if (qcSuspicious && isSuspicious(lead)) reason = "qc";
    else if (restaleIfNewer) {
      const lastAt = await getLastMessageAt(chat.chat_id);
      if (lastAt && new Date(lastAt) > new Date(lead.ai_qual_at)) reason = "stale";
    }

    if (!reason) {
      results.push({ chat_id: chat.chat_id, lead_id: lead.id, status: "already" });
      continue;
    }

    const conversation = await getConversation(chat.chat_id);
    if (!hasEnoughSignal(conversation)) {
      results.push({ chat_id: chat.chat_id, lead_id: lead.id, status: "no_signal", reason });
      continue;
    }

    const qual = await qualifyConversation(conversation);
    if (!qual) {
      results.push({ chat_id: chat.chat_id, lead_id: lead.id, status: "ai_failed", reason });
      continue;
    }

    done += 1;

    if (dryRun) {
      results.push({
        chat_id: chat.chat_id,
        lead_id: lead.id,
        lead_name: lead.name,
        status: "dry_run",
        reason,
        score: qual.score,
        profile: qual.profile
      });
      log(`[dry-run] ${lead.name || lead.id}: score=${qual.score} (${qual.profile.readiness}) [${reason}]`);
      continue;
    }

    const ok = await saveQualification(lead.id, qual.score, qual.profile);
    results.push({
      chat_id: chat.chat_id,
      lead_id: lead.id,
      lead_name: lead.name,
      status: ok ? "qualified" : "ai_failed",
      reason,
      score: qual.score,
      profile: qual.profile
    });
    if (ok) log(`✓ ${lead.name || lead.id}: score=${qual.score} (${qual.profile.readiness}) [${reason}]`);
  }

  return results;
}

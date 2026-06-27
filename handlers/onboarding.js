import { saveNicheProfile, isDbReady, withRetry } from "../db.js";

// ИИ-классификатор ниши для онбординга проекта.
//
// Поток: на входе текст-описание бизнеса (+ опц. название, город, ОКЭД) →
// отправляем в Claude → получаем структурный профиль ниши → пишем в projects
// (niche_profile + дублируем industry→niche, geo→city для старого UI).
// Профиль нужен системе, чтобы подобрать инструменты продаж/маркетинга под нишу.

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT =
  `Ты — аналитик Specto, платформы роста продаж. По описанию бизнеса собери ` +
  `структурный профиль ниши, чтобы система подобрала инструменты продаж и ` +
  `маркетинга под него. Опирайся только на факты из текста; чего нет — ` +
  `"неизвестно" или пустой массив. Отвечай строго вызовом record_niche_profile.`;

// Инструмент с input_schema — заставляет модель вернуть структурированный JSON
// (tool_choice ниже форсирует именно его), это надёжнее парсинга текста.
export const NICHE_TOOL = {
  name: "record_niche_profile",
  description: "Записать структурный профиль ниши бизнеса по его описанию.",
  input_schema: {
    type: "object",
    properties: {
      industry: {
        type: "string",
        description: "Отрасль бизнеса (например: строительство, общепит, медицина, e-commerce)."
      },
      sub_niche: {
        type: "string",
        description: "Под-ниша/специализация внутри отрасли (конкретнее, чем industry)."
      },
      products: {
        type: "array",
        items: { type: "string" },
        description: "Что продаёт бизнес — товары или услуги."
      },
      model: {
        type: "string",
        description: "Модель продаж: B2B | B2C | B2B2C."
      },
      geo: {
        type: "string",
        description: "География работы: город / регион / страна."
      },
      deal_band: {
        type: "string",
        description: "Средний размер сделки: низкий | средний | высокий."
      },
      sales_cycle: {
        type: "string",
        description: "Длина цикла сделки: короткий | средний | длинный."
      },
      channels: {
        type: "array",
        items: { type: "string" },
        description: "Каналы привлечения/общения: whatsapp | instagram | 2gis | звонки | сайт."
      },
      audience: {
        type: "string",
        description: "Кто покупает — целевая аудитория бизнеса."
      },
      pains: {
        type: "array",
        items: { type: "string" },
        description: "Боли/задачи бизнеса, которые мешают росту продаж."
      },
      summary: {
        type: "string",
        description: "1–2 предложения: ключевой вывод о нише."
      },
      confidence: {
        type: "number",
        description: "Уверенность в профиле от 0 до 1 (насколько хватило фактов в тексте)."
      }
    },
    required: ["industry", "model", "summary", "confidence"]
  }
};

// --- Чистые функции (тестируются без сети) ---

export function clampConfidence(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

// tool_use.input → нормализованный профиль: массивы гарантированы, confidence
// зажат в 0..1, пропущенные поля заполнены дефолтами ("неизвестно" / []).
export function parseNicheProfile(input) {
  const i = input && typeof input === "object" ? input : {};
  return {
    industry: i.industry ?? "неизвестно",
    sub_niche: i.sub_niche ?? "неизвестно",
    products: Array.isArray(i.products) ? i.products : [],
    model: i.model ?? "неизвестно",
    geo: i.geo ?? "неизвестно",
    deal_band: i.deal_band ?? "неизвестно",
    sales_cycle: i.sales_cycle ?? "неизвестно",
    channels: Array.isArray(i.channels) ? i.channels : [],
    audience: i.audience ?? "неизвестно",
    pains: Array.isArray(i.pains) ? i.pains : [],
    summary: i.summary ?? "",
    confidence: clampConfidence(i.confidence)
  };
}

// Склейка входа в user-сообщение для модели. Пустые/неизвестные поля опускаем,
// чтобы не вводить модель в заблуждение.
export function buildNichePrompt({ description, companyName, city, oked } = {}) {
  const lines = [];
  if (companyName && String(companyName).trim()) lines.push(`Компания: ${String(companyName).trim()}`);
  if (city && String(city).trim()) lines.push(`Город: ${String(city).trim()}`);
  if (oked && String(oked).trim()) lines.push(`ОКЭД: ${String(oked).trim()}`);
  if (description && String(description).trim()) lines.push(`Описание бизнеса:\n${String(description).trim()}`);
  return lines.join("\n");
}

// --- Вызов Claude ---

// Возвращает { profile } или null при ошибке/пустом входе.
export async function classifyNiche({ description, companyName, city, oked } = {}) {
  if (!API_KEY) {
    console.error("ANTHROPIC_API_KEY не задан — классификация ниши пропущена");
    return null;
  }

  const prompt = buildNichePrompt({ description, companyName, city, oked });
  if (!prompt) return null;

  try {
    // Ретраим временные сбои Claude (429/5xx/сеть).
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
            tools: [NICHE_TOOL],
            tool_choice: { type: "tool", name: "record_niche_profile" },
            messages: [{ role: "user", content: prompt }]
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
        label: "Claude onboarding",
        retryOn: (err) => !err.status || err.status >= 500 || err.status === 429
      }
    );

    const toolUse = Array.isArray(data?.content)
      ? data.content.find(b => b.type === "tool_use" && b.name === "record_niche_profile")
      : null;
    if (!toolUse) return null;
    return { profile: parseNicheProfile(toolUse.input) };
  } catch (err) {
    console.error("Ошибка запроса к Claude (onboarding):", err.message);
    return null;
  }
}

// --- Оркестратор ---

// Классифицирует нишу проекта по тексту и (если не dryRun) пишет в projects.
// opts: { projectId, description, companyName, city, oked, dryRun, log }.
// Возвращает { profile, saved } или null.
export async function classifyAndSaveNiche(opts = {}) {
  const {
    projectId,
    description,
    companyName,
    city,
    oked,
    dryRun = false,
    log = console.log
  } = opts;

  const result = await classifyNiche({ description, companyName, city, oked });
  if (!result) {
    log("Онбординг: не удалось классифицировать нишу.");
    return null;
  }

  if (dryRun) {
    log(`[dry-run] ниша: ${result.profile.industry} (conf ${result.profile.confidence})`);
    return { profile: result.profile, saved: false };
  }

  if (!isDbReady()) {
    log("Онбординг: БД не настроена — профиль не сохранён.");
    return { profile: result.profile, saved: false };
  }

  const ok = await saveNicheProfile(projectId, result.profile, description);
  if (ok) log(`✓ ниша проекта ${projectId}: ${result.profile.industry} (conf ${result.profile.confidence})`);
  return { profile: result.profile, saved: ok };
}

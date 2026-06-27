import { savePlaybook, setAutomationActive, isDbReady, withRetry } from "../db.js";

// Движок плейбуков: по профилю ниши проекта (см. handlers/onboarding.js) подбирает
// скелет «играбука» — набор автоматизаций, стадий воронки, фоллоапов и тем
// маркетинга — и (осознанно) включает базовые автоматизации в automation_rules.
//
// Скелеты лежат в niche_playbooks. Каждый: { key, title, match:{model, industry_any:[...]},
// automations:[{code, tier:"base"|"suggested", ...}], stages, followups, marketing }.

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const API_KEY = process.env.ANTHROPIC_API_KEY;

// --- Чистые функции (тестируются без сети/БД) ---

// «Стог сена» из профиля для поиска совпадений по отрасли (lowercase).
function nicheHaystack(profile = {}) {
  const products = Array.isArray(profile.products) ? profile.products.join(" ") : "";
  return [profile.industry, products, profile.summary]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

// Подбирает плейбук под профиль:
//   1) точное совпадение — та же model И хотя бы одно слово из match.industry_any
//      встречается (substring, lowercase) в industry+products+summary;
//   2) иначе — первый плейбук с той же model (дефолт по модели);
//   3) иначе — null.
export function matchPlaybook(profile, playbooks = []) {
  if (!profile || !Array.isArray(playbooks) || !playbooks.length) return null;
  const model = profile.model;
  const haystack = nicheHaystack(profile);

  // 1) точное совпадение по модели + отрасли.
  for (const pb of playbooks) {
    const m = pb && pb.match;
    if (!m || m.model !== model) continue;
    const words = Array.isArray(m.industry_any) ? m.industry_any : [];
    if (words.some(w => w && haystack.includes(String(w).toLowerCase()))) {
      return pb;
    }
  }

  // 2) дефолт: первый с той же моделью.
  const byModel = playbooks.find(pb => pb && pb.match && pb.match.model === model);
  return byModel || null;
}

// Собирает рекомендацию из подходящего плейбука. null, если ничего не подошло.
export function recommendPlaybook(profile, playbooks = []) {
  const pb = matchPlaybook(profile, playbooks);
  if (!pb) return null;
  return {
    source: "skeleton:" + pb.key,
    title: pb.title ?? "",
    automations: Array.isArray(pb.automations) ? pb.automations : [],
    stages: Array.isArray(pb.stages) ? pb.stages : [],
    followups: Array.isArray(pb.followups) ? pb.followups : [],
    marketing: Array.isArray(pb.marketing) ? pb.marketing : []
  };
}

// Коды автоматизаций нужного «яруса» (base / suggested).
function codesByTier(automations = [], tier) {
  return automations
    .filter(a => a && a.tier === tier && a.code)
    .map(a => a.code);
}

// --- Применение плейбука ---

// Сохраняет плейбук в проект и включает автоматизации:
//   - tier==="base"      — всегда;
//   - tier==="suggested" — только если applySuggested.
// dryRun=true (по умолчанию в CLI) — ничего не пишет, лишь возвращает план.
// Возвращает { applied: [codes], suggested: [codes] }.
export async function applyPlaybook({
  projectId,
  organizationId,
  recommendation,
  applySuggested = false,
  dryRun = false,
  log = console.log
} = {}) {
  const result = { applied: [], suggested: [] };
  if (!recommendation) {
    log("Плейбук: нечего применять (recommendation пуст).");
    return result;
  }

  const base = codesByTier(recommendation.automations, "base");
  const suggested = codesByTier(recommendation.automations, "suggested");
  result.suggested = suggested;

  // Какие коды включаем в этом запуске.
  const toApply = applySuggested ? base.concat(suggested) : base.slice();

  if (dryRun) {
    log(`[dry-run] Плейбук ${recommendation.source}: включил бы ${toApply.length} автоматизаций` +
      (toApply.length ? ` (${toApply.join(", ")})` : "") +
      (suggested.length ? `; suggested: ${suggested.join(", ")}` : ""));
    result.applied = toApply;
    return result;
  }

  if (!isDbReady()) {
    log("Плейбук: БД не настроена — не применяю.");
    return result;
  }

  await savePlaybook(projectId, recommendation);

  for (const code of toApply) {
    const ok = await setAutomationActive(organizationId, code, true);
    if (ok) {
      result.applied.push(code);
      log(`✓ автоматизация включена: ${code}`);
    } else {
      log(`✗ не удалось включить: ${code}`);
    }
  }

  return result;
}

// --- Гибрид: докрутка под бизнес через Claude (опционально) ---

const SYSTEM_PROMPT =
  `Ты — методолог отдела продаж Specto. Тебе дают профиль ниши бизнеса и скелет ` +
  `плейбука (стадии воронки и темы маркетинга). Докрути названия стадий и темы ` +
  `маркетинга под конкретный бизнес: говори на языке его клиентов, опирайся на ` +
  `факты профиля. Не добавляй и не удаляй автоматизации. Отвечай строго вызовом ` +
  `record_playbook_tweaks.`;

export const PLAYBOOK_TOOL = {
  name: "record_playbook_tweaks",
  description: "Уточнённые под бизнес стадии воронки и темы маркетинга.",
  input_schema: {
    type: "object",
    properties: {
      stages: {
        type: "array",
        items: { type: "string" },
        description: "Названия стадий воронки под этот бизнес (тот же порядок и число, что в скелете)."
      },
      marketing: {
        type: "array",
        items: { type: "string" },
        description: "Темы маркетинговых касаний под этот бизнес."
      }
    },
    required: ["stages", "marketing"]
  }
};

// Докручивает стадии и маркетинг рекомендации под конкретный профиль через Claude.
// При отсутствии ключа/ошибке/пустом ответе — возвращает recommendation как есть.
export async function customizePlaybook(profile, recommendation) {
  if (!recommendation) return recommendation;
  if (!API_KEY) return recommendation;

  const userMsg =
    `Профиль ниши (JSON):\n${JSON.stringify(profile)}\n\n` +
    `Скелет плейбука "${recommendation.title}".\n` +
    `Стадии: ${JSON.stringify(recommendation.stages)}\n` +
    `Маркетинг: ${JSON.stringify(recommendation.marketing)}`;

  try {
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
            tools: [PLAYBOOK_TOOL],
            tool_choice: { type: "tool", name: "record_playbook_tweaks" },
            messages: [{ role: "user", content: userMsg }]
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
        label: "Claude playbook",
        retryOn: (err) => !err.status || err.status >= 500 || err.status === 429
      }
    );

    const toolUse = Array.isArray(data?.content)
      ? data.content.find(b => b.type === "tool_use" && b.name === "record_playbook_tweaks")
      : null;
    if (!toolUse || !toolUse.input) return recommendation;

    const input = toolUse.input;
    return {
      ...recommendation,
      stages: Array.isArray(input.stages) && input.stages.length ? input.stages : recommendation.stages,
      marketing: Array.isArray(input.marketing) && input.marketing.length ? input.marketing : recommendation.marketing
    };
  } catch (err) {
    console.error("Ошибка запроса к Claude (playbook):", err.message);
    return recommendation;
  }
}

import { getAllQualified } from "../db.js";

// Ежедневная сводка по квалифицированным лидам. Шлётся раз в день через тот же
// механизм alert(), что и у сторожа (watchdog.js, шаг 7, при DIGEST_ENABLED=1).
//
// Все параметры переопределяются переменными окружения:
//   DIGEST_HOT_SCORE — порог «горячего» лида (по умолчанию 70)
//   DIGEST_HOUR      — локальный час отправки (по умолчанию 9)
//   DIGEST_TZ_OFFSET — смещение часового пояса от UTC (Алматы = +5)
//   DIGEST_TOP       — сколько лидов показать в топе (по умолчанию 10)

const HOT_SCORE = Number(process.env.DIGEST_HOT_SCORE) || 70;
const SEND_HOUR = Number(process.env.DIGEST_HOUR ?? 9);
const TZ_OFFSET = Number(process.env.DIGEST_TZ_OFFSET ?? 5);
const TOP_N = Number(process.env.DIGEST_TOP) || 10;

// В памяти: день последней отправки ("YYYY-MM-DD"). Защита от повторов в течение
// дня. При рестарте процесса сбрасывается — в худшем случае сводка уйдёт
// повторно один раз, это некритично.
let lastSentDay = null;

// Локальные «день» и «час» с учётом смещения часового пояса.
function localParts(now) {
  const d = new Date(now + TZ_OFFSET * 60 * 60 * 1000);
  return { day: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
}

// Чистая сборка текста сводки из списка квалифицированных лидов.
// Возвращает строку либо null, если показывать нечего.
export function buildDigest(leads = [], { hotScore = HOT_SCORE, topN = TOP_N, day, tzOffset = TZ_OFFSET } = {}) {
  if (!Array.isArray(leads) || leads.length === 0) return null;

  const isToday = (iso) => {
    if (!iso || !day) return false;
    const d = new Date(new Date(iso).getTime() + tzOffset * 60 * 60 * 1000);
    return d.toISOString().slice(0, 10) === day;
  };

  const total = leads.length;
  const newToday = leads.filter(l => isToday(l.ai_qual_at)).length;
  const hot = leads.filter(l => (l.ai_qual_score ?? 0) >= hotScore);
  const unassigned = leads.filter(l => !l.assignee || l.assignee === "director").length;

  const top = [...leads]
    .sort((a, b) => (b.ai_qual_score ?? 0) - (a.ai_qual_score ?? 0))
    .slice(0, topN)
    .map(l => {
      const who = l.assignee && l.assignee !== "director" ? l.assignee : "без менеджера";
      return `• ${l.name || "—"} (${l.ai_qual_score ?? 0}) — ${who}`;
    });

  return [
    `📊 Ежедневная сводка SPECTO${day ? ` — ${day}` : ""}`,
    `Квалифицировано всего: ${total}`,
    `За сегодня: ${newToday}`,
    `🔥 Горячих (≥${hotScore}): ${hot.length}`,
    `Без менеджера: ${unassigned}`,
    "",
    "Топ лидов по баллу:",
    ...top
  ].join("\n");
}

// Шлёт сводку максимум раз в день и не раньше часа SEND_HOUR (локального).
// alert(text) — функция доставки (тот же механизм, что у сторожа).
// Возвращает true, если сводка отправлена именно в этот вызов.
export async function maybeSendDailyDigest({ alert = console.log, log = console.log, now = Date.now() } = {}) {
  const { day, hour } = localParts(now);

  if (lastSentDay === day) return false;   // уже отправляли сегодня
  if (hour < SEND_HOUR) return false;      // ещё рано

  const leads = await getAllQualified();
  const text = buildDigest(leads, { day });

  lastSentDay = day; // помечаем день даже при пустой сводке — чтобы не долбить повторно

  if (!text) {
    log("Дайджест: квалифицированных лидов нет — пропуск.");
    return false;
  }

  await alert(text);
  log("Дайджест отправлен.");
  return true;
}

// Для тестов: сброс внутреннего состояния «день последней отправки».
export function __resetDigestState() {
  lastSentDay = null;
}

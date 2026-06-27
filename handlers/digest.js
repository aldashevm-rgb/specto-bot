import { getAllQualified } from "../db.js";

// Ежедневная сводка по квалифицированным лидам: сколько всего, сколько горячих,
// сколько новых за сутки, разбивка по рубрикам и топ-5. Чистые функции
// buildDigest/formatDigest тестируются без БД; maybeSendDailyDigest шлёт её
// раз в день через сторож.

const DAY_MS = 24 * 60 * 60 * 1000;
const HOT_SCORE = 60;

// Чистая функция: сводит лиды в отчёт. now — момент отсчёта (мс).
// lead: { name, ai_qual_score, ai_qual_at, ai_qual_profile, assignee }.
export function buildDigest(leads = [], now = Date.now()) {
  const total = leads.length;
  let hot = 0;
  let new24h = 0;
  const catCounts = {};

  for (const l of leads) {
    const score = l.ai_qual_score ?? 0;
    if (score >= HOT_SCORE) hot += 1;

    const at = l.ai_qual_at ? new Date(l.ai_qual_at).getTime() : NaN;
    if (!Number.isNaN(at) && at >= now - DAY_MS) new24h += 1;

    const category = l.ai_qual_profile?.category || "не определено";
    catCounts[category] = (catCounts[category] || 0) + 1;
  }

  const byCategory = Object.entries(catCounts)
    .map(([category, n]) => ({ category, n }))
    .sort((a, b) => b.n - a.n);

  const top = [...leads]
    .sort((a, b) => (b.ai_qual_score ?? 0) - (a.ai_qual_score ?? 0))
    .slice(0, 5)
    .map(l => ({
      name: l.name || "—",
      score: l.ai_qual_score ?? 0,
      category: l.ai_qual_profile?.category || "не определено",
      assignee: l.assignee || "—"
    }));

  return { total, hot, new24h, byCategory, top };
}

// Чистая функция: рендерит сводку в текст для алерта.
export function formatDigest(d) {
  const lines = [
    "📊 Ежедневная сводка по лидам",
    `Всего квалифицировано: ${d.total} · горячих (≥${HOT_SCORE}): ${d.hot} · новых за 24ч: ${d.new24h}`
  ];

  if (d.byCategory.length) {
    lines.push("");
    lines.push("По рубрикам:");
    for (const c of d.byCategory) lines.push(`• ${c.category}: ${c.n}`);
  }

  if (d.top.length) {
    lines.push("");
    lines.push("Топ-5:");
    for (const t of d.top) {
      lines.push(`• ${t.name} (${t.score}) — ${t.category} → ${t.assignee}`);
    }
  }

  return lines.join("\n");
}

// Защита от дублей: день (UTC), за который сводка уже отправлена.
let lastDigestDay = null;

// Для тестов: сбросить состояние «последнего отправленного дня».
export function resetDigestState() {
  lastDigestDay = null;
}

function utcDay(now) {
  return new Date(now).toISOString().slice(0, 10); // YYYY-MM-DD
}

// Шлёт сводку раз в день: только если UTC-час >= DIGEST_HOUR (по умолчанию 6)
// и за этот день ещё не слали. Возвращает true, если сводка отправлена.
export async function maybeSendDailyDigest({
  hour = Number(process.env.DIGEST_HOUR) || 6,
  now = Date.now(),
  alert,
  log = console.log
} = {}) {
  const d = new Date(now);
  if (d.getUTCHours() < hour) return false;

  const day = utcDay(now);
  if (lastDigestDay === day) return false;

  const leads = await getAllQualified();
  const digest = buildDigest(leads, now);
  if (alert) await alert(formatDigest(digest));

  lastDigestDay = day;
  log(`Сводка: отправлена за ${day} (всего=${digest.total}, горячих=${digest.hot}, новых=${digest.new24h}).`);
  return true;
}

import { processQualifications, phoneLast10 } from "./qualify.js";
import { autoAssignHotLeads } from "./assign.js";
import { isDbReady, healthPing, getRecentWaChats, getLastMessage, getLeadForPhone } from "../db.js";

function envEnabled(name) {
  const v = String(process.env[name] || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

// Агент-сторож: следит за здоровьем системы квалификации и сам «ремонтирует» её.
// За один прогон он:
//   1. проверяет живость БД и наличие ключа Claude (мониторинг);
//   2. доквалифицирует пропущенных лидов (heal gaps) — те, кого поллер не успел
//      или по кому был временный сбой ai_failed;
//   3. переоценивает лиды с новой перепиской (stale) и сомнительные оценки (qc);
//   4. при проблемах шлёт алерт (вебхук или лог).
//
// Поллер не трогает старые/сомнительные записи — это делает именно сторож.

// Шлёт алерт в вебхук (WATCHDOG_ALERT_WEBHOOK, формат {text}) и в лог.
// Подходит для Slack/Telegram-бриджей и т.п. Если вебхук не задан — только лог.
export async function sendAlert(text) {
  console.warn("[watchdog-alert]", text);
  const url = process.env.WATCHDOG_ALERT_WEBHOOK;
  if (!url) return;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text })
    });
  } catch (err) {
    console.error("sendAlert error:", err.message);
  }
}

// Чистая проверка «застрял ли лид»: последнее слово за клиентом (in),
// сообщение старше minHours, и лид достаточно горячий (score >= minScore).
export function isStuck(lastMessage, lead, { minHours, minScore, now }) {
  if (!lastMessage || lastMessage.direction !== "in") return false;
  if (!lead || (lead.ai_qual_score ?? 0) < minScore) return false;
  const ts = new Date(lastMessage.created_at).getTime();
  if (Number.isNaN(ts)) return false;
  return ts <= now - minHours * 60 * 60 * 1000;
}

// Находит горячие лиды, у которых клиент написал последним и менеджер не ответил
// дольше minHours. Возвращает массив { lead_id, name, score, chat_id, last_in }.
export async function findStuckLeads({ minHours = 4, minScore = 60, now = Date.now() } = {}) {
  const chats = await getRecentWaChats({ sinceIso: null });
  const stuck = [];
  for (const chat of chats) {
    const last = await getLastMessage(chat.chat_id);
    if (!last || last.direction !== "in") continue; // дешёвый отсев до запроса лида
    const phoneNorm = phoneLast10(chat.chat_id);
    if (!phoneNorm) continue;
    const lead = await getLeadForPhone(phoneNorm, chat.project_id);
    if (!isStuck(last, lead, { minHours, minScore, now })) continue;
    stuck.push({
      lead_id: lead.id,
      name: lead.name,
      score: lead.ai_qual_score,
      chat_id: chat.chat_id,
      last_in: last.created_at
    });
  }
  stuck.sort((a, b) => b.score - a.score);
  return stuck;
}

// Сводит результаты прогона квалификации в отчёт по причинам/статусам.
export function summarize(results = []) {
  const report = {
    healed: 0,   // успешно (пере)оценено
    failed: 0,   // ai_failed
    missing: 0,  // были без оценки
    stale: 0,    // переоценено из-за новой переписки
    qc: 0,       // переоценено из-за сомнительной оценки
    noLead: 0,
    noSignal: 0
  };
  for (const r of results) {
    if (r.status === "qualified") {
      report.healed += 1;
      if (r.reason && report[r.reason] !== undefined) report[r.reason] += 1;
    } else if (r.status === "ai_failed") {
      report.failed += 1;
    } else if (r.status === "no_lead") {
      report.noLead += 1;
    } else if (r.status === "no_signal") {
      report.noSignal += 1;
    }
  }
  return report;
}

// Один прогон сторожа. opts:
//   limit        — максимум (пере)оценок за прогон (бюджет на Claude), по умолчанию 20
//   sinceIso     — окно отбора чатов (null = вся история, для полного ремонта)
//   alert        — функция алерта (для тестов можно подменить)
//   log          — функция логирования
// Возвращает отчёт { dbOk, apiKey, ...summarize() }.
export async function runWatchdog(opts = {}) {
  const {
    limit = Number(process.env.WATCHDOG_BATCH) || 20,
    sinceIso = null,
    stuckHours = Number(process.env.WATCHDOG_STUCK_HOURS) || 4,
    stuckMinScore = Number(process.env.WATCHDOG_STUCK_MIN_SCORE) || 60,
    alert = sendAlert,
    log = console.log
  } = opts;

  const report = { ts: new Date().toISOString(), dbOk: false, apiKey: Boolean(process.env.ANTHROPIC_API_KEY) };

  if (!isDbReady()) {
    log("Сторож: БД не настроена — пропуск.");
    return report;
  }

  // 1. Мониторинг здоровья.
  report.dbOk = await healthPing();
  if (!report.dbOk) {
    await alert("⚠️ Сторож: Supabase недоступен — квалификация не работает.");
    return report;
  }
  if (!report.apiKey) {
    await alert("⚠️ Сторож: ANTHROPIC_API_KEY не задан — квалификация невозможна.");
    return report;
  }

  // 2–3. Ремонт: пропущенные + устаревшие + сомнительные за один проход.
  const results = await processQualifications({
    sinceIso,
    limit,
    restaleIfNewer: true,
    qcSuspicious: true,
    log
  });

  Object.assign(report, summarize(results));

  // 4. Алерт при сбоях квалификации.
  if (report.failed > 0) {
    await alert(`⚠️ Сторож: ${report.failed} лид(ов) не удалось квалифицировать (ai_failed). Проверьте Claude/лимиты.`);
  }

  // 5. «Застрявшие» горячие лиды: клиент написал последним, менеджер молчит.
  const stuck = await findStuckLeads({ minHours: stuckHours, minScore: stuckMinScore });
  report.stuck = stuck.length;
  if (stuck.length) {
    const lines = stuck.slice(0, 15).map(s => `• ${s.name || s.lead_id} (score ${s.score})`);
    const extra = stuck.length > 15 ? `\n…и ещё ${stuck.length - 15}` : "";
    await alert(
      `⏰ Сторож: ${stuck.length} горяч. лид(ов) ждут ответа дольше ${stuckHours}ч:\n` +
      lines.join("\n") + extra
    );
  }

  // 6. Авто-назначение горячих ничьих лидов (по умолчанию ВЫКЛ — AUTOASSIGN_ENABLED=1).
  if (envEnabled("AUTOASSIGN_ENABLED")) {
    const assigned = await autoAssignHotLeads({ log });
    report.assigned = assigned.length;
    if (assigned.length) {
      const lines = assigned.slice(0, 10).map(a => `• ${a.name || a.lead_id} (${a.score}) → ${a.assignee}`);
      await alert(`👤 Сторож: назначено ${assigned.length} горяч. лид(ов):\n` + lines.join("\n"));
    }
  }

  log(
    `Сторож: вылечено=${report.healed} (missing=${report.missing}, stale=${report.stale}, qc=${report.qc}), ` +
    `сбоев=${report.failed}, застряло=${report.stuck}, назначено=${report.assigned || 0}.`
  );
  return report;
}

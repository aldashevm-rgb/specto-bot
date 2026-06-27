import { processQualifications } from "./qualify.js";
import { isDbReady, healthPing } from "../db.js";

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

  log(
    `Сторож: вылечено=${report.healed} (missing=${report.missing}, stale=${report.stale}, qc=${report.qc}), ` +
    `сбоев=${report.failed}.`
  );
  return report;
}

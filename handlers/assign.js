import {
  getUnassignedHotLeads,
  getActiveManagers,
  countLeadsByAssignee,
  setAssignee,
  isDbReady
} from "../db.js";

// Авто-назначение менеджера горячим лидам, которые попали в корзину «director»
// (ничьи). Стратегия — «наименее загруженному»: лид уходит активному менеджеру
// проекта, у которого сейчас меньше всего лидов. Уже назначенные лиды не трогаем.

// Чистая функция: имя с наименьшей загрузкой. loads = { имя: число }.
// При равенстве берёт первого по порядку. null, если список пуст.
export function pickLeastLoaded(loads) {
  let best = null;
  let min = Infinity;
  for (const [name, n] of Object.entries(loads)) {
    if (n < min) { min = n; best = name; }
  }
  return best;
}

// Назначает горячих ничьих лидов. opts:
//   minScore — порог «горячести» (по умолчанию AUTOASSIGN_MIN_SCORE или 60)
//   dryRun   — не писать в БД, только вернуть план
//   log      — логгер
// Возвращает массив { lead_id, name, score, project, assignee }.
export async function autoAssignHotLeads(opts = {}) {
  const {
    minScore = Number(process.env.AUTOASSIGN_MIN_SCORE) || 60,
    dryRun = false,
    log = console.log
  } = opts;

  if (!isDbReady()) return [];

  const leads = await getUnassignedHotLeads(minScore);
  if (!leads.length) return [];

  // Группируем по проекту — менеджеры и загрузка считаются в рамках проекта.
  const byProject = {};
  for (const l of leads) (byProject[l.project_id] ||= []).push(l);

  const assignments = [];
  for (const [project, plist] of Object.entries(byProject)) {
    const managers = await getActiveManagers(project);
    if (!managers.length) {
      log(`Авто-назначение: в проекте ${project} нет активных менеджеров — пропуск ${plist.length} лид(ов).`);
      continue;
    }
    // Стартовая загрузка по каждому менеджеру.
    const loads = {};
    for (const m of managers) loads[m] = await countLeadsByAssignee(project, m);

    for (const lead of plist) {
      const who = pickLeastLoaded(loads);
      if (!dryRun) {
        const ok = await setAssignee(lead.id, who);
        if (!ok) continue;
      }
      loads[who] += 1; // учитываем в загрузке для следующего лида
      assignments.push({ lead_id: lead.id, name: lead.name, score: lead.ai_qual_score, project, assignee: who });
      log(`Авто-назначение: ${lead.name || lead.id} (${lead.ai_qual_score}) → ${who}`);
    }
  }
  return assignments;
}

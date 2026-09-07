import { getUserMessages, getStates, upsertState } from "../db.js";
import { isStopRequest } from "./optout.js";
import { STOPPED } from "./followup.js";

// Разовый ремонт истории: до фикса «липкого стопа» диалог возвращался в
// рассылку после любого следующего сообщения клиента. Поэтому в
// specto_bot_state остались чаты со status=active, хотя человек когда-то
// просил больше не писать. Скрипт проходит по истории, находит такие чаты и
// проставляет им stopped.
//
// Логика та же, что в бою (handlers/optout.js): если клиент хоть раз попросил
// не писать — стоп навсегда, снимается только вручную.

// Чаты, где клиент когда-либо просил не писать. messages — сообщения role=user
// в хронологическом порядке. Возвращает первое совпадение по каждому чату:
// { chat_id, platform, text, at }.
export function findStopChats(messages = []) {
  const found = new Map();
  for (const m of messages) {
    if (!m || !m.chat_id || found.has(m.chat_id)) continue;
    if (!isStopRequest(m.content)) continue;
    found.set(m.chat_id, {
      chat_id: m.chat_id,
      platform: m.platform || "whatsapp",
      text: String(m.content ?? "").trim(),
      at: m.created_at || null
    });
  }
  return [...found.values()];
}

// План работ. states — строки specto_bot_state.
//   toStop         — кому проставить stopped (hadState: была ли строка состояния)
//   alreadyStopped — уже остановлены, трогать не нужно
export function buildBackfillPlan(messages = [], states = []) {
  const byChat = new Map(states.filter(s => s && s.chat_id).map(s => [s.chat_id, s]));
  const plan = { toStop: [], alreadyStopped: [] };

  for (const hit of findStopChats(messages)) {
    const state = byChat.get(hit.chat_id);
    if (state && state.status === STOPPED) plan.alreadyStopped.push(hit);
    else plan.toStop.push({ ...hit, hadState: Boolean(state) });
  }
  return plan;
}

// Прогон. По умолчанию dryRun — только показывает план, ничего не пишет.
// deps — точки подмены для тестов.
export async function backfillStops({
  dryRun = true,
  sinceIso = null,
  limit = Infinity,
  deps = {}
} = {}) {
  const {
    readMessages = getUserMessages,
    readStates = getStates,
    upsert = upsertState,
    now = () => new Date(),
    log = console.log
  } = deps;

  const messages = await readMessages({ sinceIso });
  const states = await readStates();
  const plan = buildBackfillPlan(messages, states);

  log(
    `Просмотрено сообщений: ${messages.length}, чатов с отказом: ` +
    `${plan.toStop.length + plan.alreadyStopped.length} ` +
    `(уже остановлено: ${plan.alreadyStopped.length}).`
  );

  const targets = plan.toStop.slice(0, limit === Infinity ? undefined : limit);
  const applied = [];

  if (dryRun) {
    log(`Пробный прогон: к остановке ${targets.length} чат(ов), в БД ничего не пишу.`);
    return { plan, targets, applied, dryRun: true };
  }

  for (const t of targets) {
    const nowIso = now().toISOString();
    await upsert(t.chat_id, {
      platform: t.platform,
      status: STOPPED,
      next_followup_at: null,
      updated_at: nowIso
    });
    applied.push(t.chat_id);
  }

  log(`Проставлен стоп: ${applied.length} чат(ов).`);
  return { plan, targets, applied, dryRun: false };
}

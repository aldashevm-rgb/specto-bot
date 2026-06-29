import { isDbReady, upsertState, updateState, getDueFollowups } from "../db.js";
import { getActiveProfile } from "../config/businessProfiles.js";

// Цепочка догоняющих сообщений берётся из активного бизнес-профиля (BOT_PROFILE).
// delay у каждого — смещение от последнего сообщения клиента.
export const FOLLOWUP_MESSAGES = getActiveProfile().followups;

// Время следующего фоллоапа для шага step (от момента lastUserAt). null — цепочка закончилась.
export function computeNextFollowupAt(step, lastUserAt) {
  const msg = FOLLOWUP_MESSAGES[step];
  if (!msg) return null;
  return new Date(new Date(lastUserAt).getTime() + msg.delay).toISOString();
}

// Клиент написал — сбрасываем цепочку и планируем первый фоллоап заново.
export async function scheduleFollowups(chatId, platform) {
  const now = new Date().toISOString();
  await upsertState(chatId, {
    platform,
    status: "active",
    followup_step: 0,
    last_user_at: now,
    next_followup_at: computeNextFollowupAt(0, now),
    updated_at: now
  });
}

// Клиент отказался — больше не пишем.
export async function stopFollowups(chatId, platform) {
  await upsertState(chatId, {
    platform,
    status: "stopped",
    next_followup_at: null,
    updated_at: new Date().toISOString()
  });
}

// Вызывается поллером: отправляет все назревшие фоллоапы. send(chatId, text, platform).
export async function processDueFollowups(send) {
  if (!isDbReady()) return;
  const due = await getDueFollowups(new Date().toISOString());

  for (const row of due) {
    const step = row.followup_step;
    const msg = FOLLOWUP_MESSAGES[step];

    // Сдвигаем шаг ДО отправки — чтобы не отправить дважды при гонке/перезапуске.
    const nextStep = step + 1;
    await updateState(row.chat_id, {
      followup_step: nextStep,
      next_followup_at: computeNextFollowupAt(nextStep, row.last_user_at),
      updated_at: new Date().toISOString()
    });

    if (!msg) continue; // шаг вне диапазона — просто закрыли цепочку

    try {
      await send(row.chat_id, msg.text, row.platform);
    } catch (err) {
      console.error("Ошибка отправки фоллоапа:", err);
    }
  }
}
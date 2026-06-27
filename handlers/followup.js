import { isDbReady, upsertState, updateState, getDueFollowups } from "../db.js";

// Цепочка догоняющих сообщений. delay — смещение от последнего сообщения клиента.
export const FOLLOWUP_MESSAGES = [
  {
    delay: 30 * 60 * 1000,
    text: "Добрый день! 👋 Я Алина из SPECTO. Вы недавно интересовались нашей системой роста продаж. Хотела уточнить — остались вопросы?"
  },
  {
    delay: 3 * 60 * 60 * 1000,
    text: "Кстати, хочу поделиться — наш клиент в вашей нише за 6 месяцев вырос на 278% по выручке. И главное — он не платил ни копейки фиксом, только 10% с продаж. Интересно узнать подробнее? 🚀"
  },
  {
    delay: 24 * 60 * 60 * 1000,
    text: "Понимаю — день бывает очень насыщенным 😊 Просто хочу чтобы вы не упустили возможность. Мы сейчас берём только 2-3 новых клиента в месяц. Уделите 20 минут — покажу как это работает конкретно в вашей нише."
  },
  {
    delay: 3 * 24 * 60 * 60 * 1000,
    text: "Добрый день! Последний раз пишу 🙂 У нас освободилось место для нового партнёра в этом месяце. Если актуально — напишите да и я расскажу детали. Если нет — всё понимаю, не буду беспокоить."
  },
  {
    delay: 7 * 24 * 60 * 60 * 1000,
    text: "Добрый день! Прошла неделя. Я не пишу чтобы давить — просто хочу оставить вам наш контакт. Когда будете готовы масштабировать бизнес — SPECTO к вашим услугам. Работаем только на результат: 10% с продаж, без фиксов. Хорошего дня! 🤝"
  }
];

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
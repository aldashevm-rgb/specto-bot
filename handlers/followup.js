import { isDbReady, upsertState, updateState, getDueFollowups } from "../db.js";

export const FOLLOWUP_MESSAGES = [
  {
    delay: 30 * 60 * 1000,
    text: "обрый день! 👋 Я лина из SPECTO. ы недавно интересовались нашей системой роста продаж. Хотела уточнить — остались вопросы?"
  },
  {
    delay: 3 * 60 * 60 * 1000,
    text: "стати, хочу поделиться — наш клиент в вашей нише за 6 месяцев вырос на 278% по выручке.  главное — он не платил ни копейки фиксом, только 10% с продаж. нтересно узнать подробнее? 🚀"
  },
  {
    delay: 24 * 60 * 60 * 1000,
    text: "онимаю — день бывает очень насыщенным 😊 росто хочу чтобы вы не упустили возможность. ы сейчас берём только 2-3 новых клиента в месяц. делите 20 минут — покажу как это работает конкретно в вашей нише."
  },
  {
    delay: 3 * 24 * 60 * 60 * 1000,
    text: "обрый день! оследний раз пишу 🙂  нас освободилось место для нового партнёра в этом месяце. сли актуально — напишите да и я расскажу детали. сли нет — всё понимаю, не буду беспокоить."
  },
  {
    delay: 7 * 24 * 60 * 60 * 1000,
    text: "обрый день! рошла неделя. Я не пишу чтобы давить — просто хочу оставить вам наш контакт. огда будете готовы масштабировать бизнес — SPECTO к вашим услугам. аботаем только на результат: 10% с продаж, без фиксов. Хорошего дня! 🤝"
  }
];

export function computeNextFollowupAt(step, lastUserAt) {
  const msg = FOLLOWUP_MESSAGES[step];
  if (!msg) return null;
  return new Date(new Date(lastUserAt).getTime() + msg.delay).toISOString();
}

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

export async function stopFollowups(chatId, platform) {
  await upsertState(chatId, {
    platform,
    status: "stopped",
    next_followup_at: null,
    updated_at: new Date().toISOString()
  });
}

export async function processDueFollowups(send) {
  if (!isDbReady()) return;
  const due = await getDueFollowups(new Date().toISOString());

  for (const row of due) {
    const step = row.followup_step;
    const msg = FOLLOWUP_MESSAGES[step];

    const nextStep = step + 1;
    await updateState(row.chat_id, {
      followup_step: nextStep,
      next_followup_at: computeNextFollowupAt(nextStep, row.last_user_at),
      updated_at: new Date().toISOString()
    });

    if (!msg) continue;

    try {
      await send(row.chat_id, msg.text, row.platform);
    } catch (err) {
      console.error("шибка отправки фоллоапа:", err);
    }
  }
}
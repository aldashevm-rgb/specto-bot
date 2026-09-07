import { isDbReady, upsertState, updateState, getDueFollowups, getState } from "../db.js";
import { isBlocked, followupsEnabled } from "./optout.js";

// Статусы диалога в specto_bot_state.
export const ACTIVE = "active";
export const STOPPED = "stopped";

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
// ВАЖНО: «стоп» липкий. Если диалог уже остановлен (клиент просил не писать)
// или номер в стоп-листе — цепочка НЕ возобновляется, что бы клиент ни написал
// дальше. Раньше любое следующее сообщение возвращало status=active и бот
// снова начинал догонять того, кто просил его не беспокоить.
// Снять стоп можно только вручную (status=active в specto_bot_state).
export async function scheduleFollowups(chatId, platform, deps = {}) {
  const {
    getState: readState = getState,
    upsertState: upsert = upsertState,
    updateState: update = updateState,
    now = () => new Date()
  } = deps;

  const nowIso = now().toISOString();

  // Глобальный рубильник и стоп-лист — проактивных сообщений не будет вообще.
  if (!followupsEnabled()) return { scheduled: false, reason: "disabled" };
  if (isBlocked(chatId)) return { scheduled: false, reason: "blocklist" };

  const state = await readState(chatId);
  if (state && state.status === STOPPED) {
    // Отметку последнего сообщения обновляем (для отчётов), но цепочку не будим.
    await update(chatId, {
      next_followup_at: null,
      last_user_at: nowIso,
      updated_at: nowIso
    });
    return { scheduled: false, reason: "stopped" };
  }

  await upsert(chatId, {
    platform,
    status: ACTIVE,
    followup_step: 0,
    last_user_at: nowIso,
    next_followup_at: computeNextFollowupAt(0, nowIso),
    updated_at: nowIso
  });
  return { scheduled: true };
}

// Клиент отказался — больше не пишем. Возвращает { alreadyStopped }, чтобы
// не отправлять прощание повторно на каждое «отстаньте».
export async function stopFollowups(chatId, platform, deps = {}) {
  const {
    getState: readState = getState,
    upsertState: upsert = upsertState,
    now = () => new Date()
  } = deps;

  const state = await readState(chatId);
  const nowIso = now().toISOString();

  await upsert(chatId, {
    platform,
    status: STOPPED,
    next_followup_at: null,
    updated_at: nowIso
  });

  return { alreadyStopped: Boolean(state && state.status === STOPPED) };
}

// Вызывается поллером: отправляет все назревшие фоллоапы. send(chatId, text, platform).
// Возвращает список отправленных { chat_id, step }.
export async function processDueFollowups(send, deps = {}) {
  const {
    dbReady = isDbReady,
    getDue = getDueFollowups,
    getState: readState = getState,
    updateState: update = updateState,
    now = () => new Date(),
    log = console.log
  } = deps;

  if (!dbReady()) return [];
  if (!followupsEnabled()) {
    log("Фоллоапы выключены глобально (FOLLOWUPS_ENABLED=0) — ничего не отправляю.");
    return [];
  }

  const due = await getDue(now().toISOString());
  const sent = [];

  for (const row of due) {
    const nowIso = now().toISOString();

    // Стоп-лист: номер вообще не наш адресат — гасим цепочку насовсем.
    if (isBlocked(row.chat_id)) {
      await update(row.chat_id, { status: STOPPED, next_followup_at: null, updated_at: nowIso });
      continue;
    }

    // Свежая проверка статуса ПЕРЕД отправкой: клиент мог сказать «стоп» уже
    // после того, как строка попала в выборку (или её сняли вручную).
    // Не смогли прочитать состояние — не пишем (безопасный отказ), вернёмся
    // к этой строке на следующем тике.
    const state = await readState(row.chat_id);
    if (!state || state.status !== ACTIVE) continue;

    const step = row.followup_step;
    const msg = FOLLOWUP_MESSAGES[step];

    // Сдвигаем шаг ДО отправки — чтобы не отправить дважды при гонке/перезапуске.
    const nextStep = step + 1;
    await update(row.chat_id, {
      followup_step: nextStep,
      next_followup_at: computeNextFollowupAt(nextStep, row.last_user_at),
      updated_at: nowIso
    });

    if (!msg) continue; // шаг вне диапазона — просто закрыли цепочку

    try {
      await send(row.chat_id, msg.text, row.platform);
      sent.push({ chat_id: row.chat_id, step });
    } catch (err) {
      console.error("Ошибка отправки фоллоапа:", err);
    }
  }

  return sent;
}

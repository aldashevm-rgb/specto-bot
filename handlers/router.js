import { askClaude } from "./aiChat.js";
import { sendMessage } from "../whatsapp.js";
import { scheduleFollowups, stopFollowups } from "./followup.js";
import { isStopRequest, isBlocked } from "./optout.js";
import { saveLead, saveMessage, getHistory, countMessages } from "../db.js";

const STOP_REPLY =
  "Понял вас! Спасибо за честность 🤝 Если в будущем понадобится система роста продаж — всегда рады помочь. Удачи в бизнесе!";

const FALLBACK_REPLY =
  "Секунду, уточню детали и сразу вернусь к вам 🙏";

// Обработка входящего сообщения. deps — точки подмены для тестов.
export async function handleMessage(chatId, text, platform = "whatsapp", deps = {}) {
  const {
    send = sendMessage,
    ask = askClaude,
    save = saveMessage,
    lead = saveLead,
    history: readHistory = getHistory,
    count = countMessages,
    schedule = scheduleFollowups,
    stop = stopFollowups
  } = deps;

  // Стоп-лист (поставщики, партнёры, сотрудники, свои номера): переписку
  // сохраняем для истории, но бот не отвечает и не заводит лида.
  if (isBlocked(chatId)) {
    await save(chatId, platform, "user", text);
    return { action: "blocked" };
  }

  const isStop = isStopRequest(text);

  // Первый контакт (в БД ещё нет сообщений от этого chat_id) → создаём лид.
  const priorCount = await count(chatId);

  await save(chatId, platform, "user", text);

  if (isStop) {
    // Стоп ставим всегда — он липкий, цепочку больше не разбудить.
    const { alreadyStopped } = await stop(chatId, platform);
    // Прощаемся один раз: если человек уже просил не писать, второе
    // «удачи в бизнесе» — ровно то, на что он жаловался.
    if (!alreadyStopped) {
      await save(chatId, platform, "assistant", STOP_REPLY);
      await send(chatId, STOP_REPLY, platform);
    }
    return { action: "stopped", replied: !alreadyStopped };
  }

  if (priorCount === 0) {
    await lead({ phone: chatId, name: "Новый лид", details: text, platform });
  }

  const messages = await readHistory(chatId, 30);
  const reply = await ask(messages);

  if (!reply) {
    await send(chatId, FALLBACK_REPLY, platform);
    // schedule сам проверит стоп: у остановленного диалога цепочка
    // не возобновляется — отвечаем только на входящие.
    await schedule(chatId, platform);
    return { action: "fallback" };
  }

  await save(chatId, platform, "assistant", reply);
  await send(chatId, reply, platform);
  await schedule(chatId, platform);
  return { action: "replied" };
}

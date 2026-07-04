import { askClaude } from "./aiChat.js";
import { sendMessage } from "../whatsapp.js";
import { scheduleFollowups, stopFollowups } from "./followup.js";
import { saveLead, saveMessage, getHistory, countMessages } from "../db.js";

const STOP_WORDS = [
  "не нужно", "не надо", "передумал", "передумала",
  "спасибо не нужно", "не интересно", "откажусь", "не актуально"
];

// Явный отказ ли это? Раньше был тупой includes(), из-за которого живой лид
// с вопросом «а мне не надо будет платить фикс?» получал прощание и терял
// цепочку догоняющих навсегда. Асимметрия рисков: ложный стоп = потерянный
// лид (дорого), пропущенный стоп = ИИ вежливо ответит сам (почти бесплатно).
// Поэтому стопим только на однозначном коротком отказе, а сомнительное отдаём ИИ.
export function isStopMessage(text) {
  const lower = String(text || "").toLowerCase().trim();
  if (!lower) return false;
  // Вопрос — это не отказ, даже если внутри есть «не нужно»/«не надо».
  if (lower.endsWith("?")) return false;
  if (!STOP_WORDS.some(word => lower.includes(word))) return false;
  // В длинном сообщении стоп-слово обычно часть уточнения, а не отказ.
  // Короткая фраза («не нужно», «спасибо, не надо») — настоящий отказ.
  const words = lower.split(/\s+/).filter(Boolean);
  return words.length <= 6;
}

const STOP_REPLY =
  "Понял вас! Спасибо за честность 🤝 Если в будущем понадобится система роста продаж — всегда рады помочь. Удачи в бизнесе!";

const FALLBACK_REPLY =
  "Секунду, уточню детали и сразу вернусь к вам 🙏";

export async function handleMessage(chatId, text, platform = "whatsapp") {
  const isStop = isStopMessage(text);

  // Первый контакт (в БД ещё нет сообщений от этого chat_id) → создаём лид.
  const priorCount = await countMessages(chatId);

  await saveMessage(chatId, platform, "user", text);

  if (priorCount === 0) {
    await saveLead({ phone: chatId, name: "Новый лид", details: text, platform });
  }

  if (isStop) {
    await stopFollowups(chatId, platform);
    await saveMessage(chatId, platform, "assistant", STOP_REPLY);
    await sendMessage(chatId, STOP_REPLY, platform);
    return;
  }

  const history = await getHistory(chatId, 30);
  const reply = await askClaude(history);

  if (!reply) {
    await sendMessage(chatId, FALLBACK_REPLY, platform);
    await scheduleFollowups(chatId, platform);
    return;
  }

  await saveMessage(chatId, platform, "assistant", reply);
  await sendMessage(chatId, reply, platform);
  await scheduleFollowups(chatId, platform);
}
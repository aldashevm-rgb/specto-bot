import { askClaude } from "./aiChat.js";
import { sendMessage } from "../whatsapp.js";
import { scheduleFollowups, stopFollowups } from "./followup.js";
import { saveLead, saveMessage, getHistory, countMessages } from "../db.js";
import { getActiveProfile } from "../config/businessProfiles.js";

const STOP_WORDS = [
  "не нужно", "не надо", "передумал", "передумала",
  "спасибо не нужно", "не интересно", "откажусь", "не актуально"
];

// Ответы зависят от активного бизнес-профиля (BOT_PROFILE).
const STOP_REPLY = getActiveProfile().stopReply;
const FALLBACK_REPLY = getActiveProfile().fallbackReply;

export async function handleMessage(chatId, text, platform = "whatsapp") {
  const lower = text.toLowerCase();
  const isStop = STOP_WORDS.some(word => lower.includes(word));

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
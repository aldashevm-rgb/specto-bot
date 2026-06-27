import { askClaude } from "./aiChat.js";
import { sendMessage } from "../whatsapp.js";
import { scheduleFollowups, stopFollowups } from "./followup.js";
import { saveLead, saveMessage, getHistory, countMessages } from "../db.js";

const STOP_WORDS = [
  "не нужно", "не надо", "передумал", "передумала",
  "спасибо не нужно", "не интересно", "откажусь", "не актуально"
];

const STOP_REPLY =
  "онял вас! Спасибо за честность 🤝 сли в будущем понадобится система роста продаж — всегда рады помочь. дачи в бизнесе!";

const FALLBACK_REPLY =
  "Секунду, уточню детали и сразу вернусь к вам 🙏";

export async function handleMessage(chatId, text, platform = "telegram") {
  const lower = text.toLowerCase();
  const isStop = STOP_WORDS.some(word => lower.includes(word));

  const priorCount = await countMessages(chatId);

  await saveMessage(chatId, platform, "user", text);

  if (priorCount === 0) {
    await saveLead({ phone: chatId, name: "овый лид", details: text, platform });
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
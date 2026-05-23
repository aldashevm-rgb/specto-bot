import { askClaude } from "./aiChat.js";
import { sendMessage } from "../whatsapp.js";
import { startFollowUp, cancelFollowUp } from "./followup.js";
import { saveOrder } from "../db.js";

const userHistory = {};
const userStatus = {};

const STOP_WORDS = [
  "не нужно", "не надо", "передумал", "передумала",
  "спасибо не нужно", "не интересно", "откажусь", "не актуально"
];

export async function handleMessage(chatId, text, platform = "telegram") {
  const lower = text.toLowerCase();

  if (!userHistory[chatId]) userHistory[chatId] = [];
  if (!userStatus[chatId]) userStatus[chatId] = "active";

  cancelFollowUp(chatId);

  const isStop = STOP_WORDS.some(word => lower.includes(word));
  if (isStop) {
    userStatus[chatId] = "stopped";
    await sendMessage(chatId,
      "Понял вас! Спасибо за честность 🤝 Если в будущем понадобится система роста продаж — всегда рады помочь. Удачи в бизнесе!",
      platform
    );
    return;
  }

  if (userStatus[chatId] === "stopped") {
    userStatus[chatId] = "active";
  }

  userHistory[chatId].push({ role: "user", content: text });

  const reply = await askClaude(text, userHistory[chatId].slice(0, -1));

  userHistory[chatId].push({ role: "assistant", content: reply });

  if (userHistory[chatId].length > 20) {
    userHistory[chatId] = userHistory[chatId].slice(-20);
  }

  await sendMessage(chatId, reply, platform);

  if (userHistory[chatId].length <= 2) {
    saveOrder({
      phone: chatId,
      name: "Новый лид",
      details: text,
      date: new Date().toLocaleString("ru-RU"),
      platform
    });
  }

  startFollowUp(chatId, (id, msg) => sendMessage(id, msg, platform));
}

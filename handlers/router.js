import { askClaude } from "./aiChat.js";
import { sendMessage } from "../whatsapp.js";
import { startFollowUp, cancelFollowUp } from "./followup.js";
import { saveOrder } from "../db.js";
import { getHistory, addMessage } from "./history.js";

const userStatus = {};

const STOP_WORDS = [
  "не нужно", "не надо", "передумал", "передумала",
  "спасибо не нужно", "не интересно", "откажусь", "не актуально"
];

export async function handleMessage(chatId, text, platform = "telegram") {
  const lower = text.toLowerCase();

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

  const history = await getHistory(chatId);
  const isFirstMessage = history.length === 0;

  await addMessage(chatId, platform, "user", text);

  const reply = await askClaude(text, history);

  await addMessage(chatId, platform, "assistant", reply);

  await sendMessage(chatId, reply, platform);

  // Создаём лид при первом входящем сообщении от клиента
  if (isFirstMessage) {
    await saveOrder({
      phone: chatId,
      name: "Новый лид",
      details: text,
      platform
    });
  }

  startFollowUp(chatId, (id, msg) => sendMessage(id, msg, platform));
}

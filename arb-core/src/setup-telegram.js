// Автонастройка Telegram: по токену вытаскивает chat_id из getUpdates, прописывает
// TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в arb-core/.env и шлёт тестовое сообщение.
//
// Использование (локально):
//   1) напиши своему боту любое сообщение в Telegram (нажми Start / «привет»);
//   2) npm run tg-setup <ТОКЕН>
//
// Токен можно и не передавать, если TELEGRAM_BOT_TOKEN уже задан в окружении.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { getJson } from "./util/http.js";
import { upsertEnv } from "./util/loadEnv.js";

const token = process.argv[2] || process.env.TELEGRAM_BOT_TOKEN;
const envPath = fileURLToPath(new URL("../.env", import.meta.url));

// Достать самый свежий chat_id из ответа getUpdates (message/channel_post/…).
function latestChatId(updates = []) {
  for (let i = updates.length - 1; i >= 0; i--) {
    const u = updates[i];
    const chat = u.message?.chat || u.edited_message?.chat ||
      u.channel_post?.chat || u.my_chat_member?.chat;
    if (chat && chat.id != null) return chat.id;
  }
  return null;
}

async function main() {
  if (!token) {
    console.error("Укажи токен: npm run tg-setup <ТОКЕН>  (получить у @BotFather).");
    process.exit(1);
  }

  console.log("Ищу chat_id (getUpdates)…");
  const data = await getJson(`https://api.telegram.org/bot${token}/getUpdates`, { label: "tg/getUpdates" });
  if (!data.ok) {
    console.error("Telegram вернул ошибку — проверь токен.");
    process.exit(1);
  }
  const chatId = latestChatId(data.result || []);
  if (chatId == null) {
    console.error("Не нашёл сообщений. Сначала напиши своему боту в Telegram любое сообщение " +
      "(нажми Start), затем запусти команду снова.");
    process.exit(1);
  }
  console.log(`chat_id: ${chatId}`);

  // Обновляем .env (создаём, если его нет), сохраняя остальные строки.
  let cur = "";
  try { cur = readFileSync(envPath, "utf8"); } catch { /* .env ещё нет */ }
  const next = upsertEnv(cur, { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: String(chatId) });
  writeFileSync(envPath, next);
  console.log(`Записал TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID в ${envPath}`);

  // Тестовое сообщение.
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: "SPECTO ARB — Telegram подключён ✅" })
  });
  if (res.ok) console.log("Отправил тест в Telegram — проверь чат. Готово: npm run watch upcoming");
  else console.log(`Тест не отправился (${res.status}) — но .env записан. Проверь chat_id.`);
}

main().catch(err => { console.error("Ошибка настройки:", err.message); process.exit(1); });

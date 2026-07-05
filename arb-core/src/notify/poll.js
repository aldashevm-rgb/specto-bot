// Единый поллер нажатий кнопок в Telegram. Один потребитель getUpdates на весь
// бот (общий offset) — иначе разные опросчики «воровали» бы апдейты друг у друга.
// Работает всегда, когда подключён Telegram, — даже в режиме ТОЛЬКО ВИЛКИ, где
// автоставка Betfair выключена. Роутинг по callback_data:
//   "bet:<id>" → подтверждение ставки Betfair (autobet)
//   "ok"       → пометка «поставил»
//   "no"       → скрыть
//   иначе      → тихий ответ (кнопка уже отмечена)

import { getUpdates, answerCallback, editReplyMarkup, collapseToLinks } from "./telegram.js";
import { haveTelegram } from "../config.js";
import { handleBettingCallback, sweepBetting } from "../betting/autobet.js";

let offset = 0;

// Обработать «общие» кнопки алерта (поставил / скрыть). Правит то же сообщение.
async function handleAction(cb) {
  const m = cb.message;
  if (cb.data === "ok") {
    await answerCallback(cb.id, "Записал 👍 Удачи, брат!");
    if (m) await editReplyMarkup(m.chat.id, m.message_id,
      collapseToLinks(m.reply_markup, "✅ Ты отметил: поставил"));
  } else if (cb.data === "no") {
    await answerCallback(cb.id, "Скрыл. Ищу дальше.");
    if (m) await editReplyMarkup(m.chat.id, m.message_id,
      collapseToLinks(m.reply_markup, "⏭ Пропущено"));
  } else {
    await answerCallback(cb.id, "Уже отмечено.");
  }
}

// Опросить нажатия и обработать. Вотчер зовёт часто (независимо от интервала сканов).
export async function pollTelegram(nowMs = Date.now()) {
  if (!haveTelegram()) return;
  sweepBetting(nowMs);
  let res;
  try { res = await getUpdates(offset); } catch { return; }
  offset = res.nextOffset;
  for (const u of res.updates) {
    const cb = u.callback_query;
    if (!cb || !cb.data) continue;
    if (cb.data.startsWith("bet:")) {
      await handleBettingCallback(cb.data.slice(4), cb.id, nowMs);
      continue;
    }
    await handleAction(cb);
  }
}

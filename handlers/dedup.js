// Защита от повторной обработки одного и того же webhook.
// Telegram и WhatsApp иногда доставляют одно сообщение несколько раз
// (ретраи при таймауте ответа), из-за чего бот может ответить дважды
// и создать дубликат лида. Храним id последних сообщений в памяти.

const seen = new Set();
const order = [];
const MAX_IDS = 1000;

export function isDuplicate(id) {
  if (id == null) return false;

  if (seen.has(id)) return true;

  seen.add(id);
  order.push(id);

  // Ограничиваем размер, чтобы не течь по памяти
  if (order.length > MAX_IDS) {
    const oldest = order.shift();
    seen.delete(oldest);
  }

  return false;
}

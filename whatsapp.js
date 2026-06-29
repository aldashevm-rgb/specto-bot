// Транспорт WhatsApp. Поддерживает двух провайдеров — выбор через WA_PROVIDER:
//   meta  (по умолчанию) — WhatsApp Cloud API (graph.facebook.com)
//   green                — GREEN-API (api.green-api.com)
// Это позволяет одному коду обслуживать инстансы на разных провайдерах,
// не ломая существующие: профиль/инстанс задаёт свой WA_PROVIDER.

const PROVIDER = String(process.env.WA_PROVIDER || "meta").toLowerCase();

// --- Meta (WhatsApp Cloud API) ---
const WA_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;

// --- GREEN-API ---
const GREEN_URL = String(process.env.GREEN_API_URL || "https://api.green-api.com").replace(/\/+$/, "");
const GREEN_ID = process.env.GREEN_API_ID_INSTANCE;
const GREEN_TOKEN = process.env.GREEN_API_TOKEN_INSTANCE;

// GREEN-API ждёт chatId вида "77001234567@c.us". Приводим к нему: если уже с
// суффиксом — как есть; иначе берём цифры номера и добавляем @c.us.
function toGreenChatId(to) {
  const s = String(to);
  if (s.includes("@")) return s;
  return s.replace(/\D/g, "") + "@c.us";
}

export async function sendMessage(to, text, _platform = "whatsapp") {
  try {
    if (PROVIDER === "green") {
      if (!GREEN_ID || !GREEN_TOKEN) {
        console.error("GREEN-API не настроен: задайте GREEN_API_ID_INSTANCE и GREEN_API_TOKEN_INSTANCE");
        return;
      }
      const url = `${GREEN_URL}/waInstance${GREEN_ID}/sendMessage/${GREEN_TOKEN}`;
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: toGreenChatId(to), message: text })
      });
      if (!res.ok) {
        console.error("Ошибка GREEN-API send:", res.status, await res.text());
      }
      return;
    }

    // Meta (по умолчанию)
    await fetch("https://graph.facebook.com/v19.0/" + PHONE_ID + "/messages", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + WA_TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        text: { body: text }
      })
    });
  } catch (err) {
    console.error("Ошибка WhatsApp:", err);
  }
}

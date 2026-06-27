const WA_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_ID = process.env.PHONE_NUMBER_ID;

export async function sendMessage(to, text, _platform = "whatsapp") {
  try {
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
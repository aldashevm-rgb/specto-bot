import express from "express";
import { handleMessage } from "./handlers/router.js";
import { isDuplicate } from "./handlers/dedup.js";

const app = express();
app.use(express.json());

const TOKEN = process.env.TELEGRAM_TOKEN;

app.post("/telegram", async (req, res) => {
  try {
    const message = req.body.message;
    if (message && message.text && !isDuplicate("tg:" + req.body.update_id)) {
      const chatId = String(message.chat.id);
      const text = message.text;
      await handleMessage(chatId, text, "telegram");
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("Ошибка:", err);
    res.sendStatus(500);
  }
});

const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "my_bot_token_123";
app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === VERIFY_TOKEN) {
    res.send(req.query["hub.challenge"]);
  } else {
    res.sendStatus(403);
  }
});

app.post("/webhook", async (req, res) => {
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (message && !isDuplicate("wa:" + message.id)) {
      const from = message.from;
      const text = message.text?.body || "";
      await handleMessage(from, text, "whatsapp");
    }
    res.sendStatus(200);
  } catch (err) {
    res.sendStatus(500);
  }
});

app.get("/orders", async (req, res) => {
  const { getOrders } = await import("./db.js");
  res.json(await getOrders());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log("SPECTO бот запущен на порту " + PORT);
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (domain && TOKEN) {
    const url = "https://" + domain + "/telegram";
    await fetch("https://api.telegram.org/bot" + TOKEN + "/setWebhook?url=" + url);
    console.log("Webhook установлен: " + url);
  }
});

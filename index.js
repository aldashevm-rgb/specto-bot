import express from "express";
import crypto from "crypto";
import { handleMessage } from "./handlers/router.js";
import { sendMessage } from "./whatsapp.js";
import { processDueFollowups } from "./handlers/followup.js";
import { getOrders, isDbReady } from "./db.js";

const app = express();
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));

const TOKEN = process.env.TELEGRAM_TOKEN;
const TG_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;
const WA_APP_SECRET = process.env.WHATSAPP_APP_SECRET;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "my_bot_token_123";
const ORDERS_API_KEY = process.env.ORDERS_API_KEY;

app.post("/telegram", async (req, res) => {
  if (TG_WEBHOOK_SECRET &&
      req.get("x-telegram-bot-api-secret-token") !== TG_WEBHOOK_SECRET) {
    return res.sendStatus(403);
  }
  try {
    const message = req.body.message;
    if (message && message.text) {
      const chatId = String(message.chat.id);
      await handleMessage(chatId, message.text, "telegram");
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("шибка Telegram:", err);
    res.sendStatus(500);
  }
});

app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === VERIFY_TOKEN) {
    res.send(req.query["hub.challenge"]);
  } else {
    res.sendStatus(403);
  }
});

function isValidWhatsAppSignature(req) {
  if (!WA_APP_SECRET) return true;
  const signature = req.get("x-hub-signature-256");
  if (!signature || !req.rawBody) return false;
  const expected = "sha256=" +
    crypto.createHmac("sha256", WA_APP_SECRET).update(req.rawBody).digest("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

app.post("/webhook", async (req, res) => {
  if (!isValidWhatsAppSignature(req)) {
    return res.sendStatus(403);
  }
  try {
    const message = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (message) {
      const from = message.from;
      const text = message.text?.body || "";
      if (text) await handleMessage(from, text, "whatsapp");
    }
    res.sendStatus(200);
  } catch (err) {
    console.error("шибка WhatsApp:", err);
    res.sendStatus(500);
  }
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, db: isDbReady() });
});

app.get("/orders", async (req, res) => {
  if (ORDERS_API_KEY && req.get("authorization") !== `Bearer ${ORDERS_API_KEY}`) {
    return res.sendStatus(401);
  }
  res.json(await getOrders());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log("SPECTO бот запущен на порту " + PORT);

  if (!TG_WEBHOOK_SECRET) console.warn("TELEGRAM_WEBHOOK_SECRET не задан — вебхук Telegram не защищён.");
  if (!WA_APP_SECRET) console.warn("WHATSAPP_APP_SECRET не задан — подпись WhatsApp не проверяется.");

  const domain = process.env.RAILWAY_PUBLIC_DOMAIN;
  if (domain && TOKEN) {
    let url = "https://api.telegram.org/bot" + TOKEN +
      "/setWebhook?url=" + encodeURIComponent("https://" + domain + "/telegram");
    if (TG_WEBHOOK_SECRET) url += "&secret_token=" + encodeURIComponent(TG_WEBHOOK_SECRET);
    try {
      await fetch(url);
      console.log("Webhook Telegram установлен");
    } catch (err) {
      console.error("е удалось установить вебхук:", err);
    }
  }

  if (isDbReady()) {
    const tick = () => processDueFollowups(sendMessage).catch(err =>
      console.error("шибка поллера фоллоапов:", err));
    setInterval(tick, 60 * 1000);
    tick();
  }
});
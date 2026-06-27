import express from "express";
import crypto from "crypto";
import { handleMessage } from "./handlers/router.js";
import { sendMessage } from "./whatsapp.js";
import { processDueFollowups } from "./handlers/followup.js";
import { getOrders, isDbReady } from "./db.js";

const app = express();
// Сохраняем сырое тело — нужно для проверки HMAC-подписи WhatsApp.
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));

const WA_APP_SECRET = process.env.WHATSAPP_APP_SECRET;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "my_bot_token_123";
const ORDERS_API_KEY = process.env.ORDERS_API_KEY;

// --- WhatsApp: верификация вебхука (GET) ---
app.get("/webhook", (req, res) => {
  if (req.query["hub.verify_token"] === VERIFY_TOKEN) {
    res.send(req.query["hub.challenge"]);
  } else {
    res.sendStatus(403);
  }
});

// Проверка подписи Meta (X-Hub-Signature-256).
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

// --- WhatsApp: входящие сообщения (POST) ---
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
    console.error("Ошибка WhatsApp:", err);
    res.sendStatus(500);
  }
});

// --- Служебные эндпоинты ---
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
app.listen(PORT, () => {
  console.log("SPECTO бот запущен на порту " + PORT);

  if (!WA_APP_SECRET) console.warn("WHATSAPP_APP_SECRET не задан — подпись WhatsApp не проверяется.");

  // Поллер фоллоапов: раз в минуту отправляет назревшие сообщения (переживает рестарт).
  if (isDbReady()) {
    const tick = () => processDueFollowups(sendMessage).catch(err =>
      console.error("Ошибка поллера фоллоапов:", err));
    setInterval(tick, 60 * 1000);
    tick();
  }
});
import express from "express";
import crypto from "crypto";
import { handleMessage } from "./handlers/router.js";
import { sendMessage } from "./whatsapp.js";
import { processDueFollowups } from "./handlers/followup.js";
import { processQualifications } from "./handlers/qualify.js";
import { runWatchdog } from "./handlers/watchdog.js";
import { renderHotHtml } from "./handlers/dashboard.js";
import { getOrders, getHotLeads, isDbReady } from "./db.js";

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

// Разбирает входящий вебхук обоих провайдеров → { from, text } или null.
//   GREEN-API: { typeWebhook, senderData.chatId, messageData.{textMessageData|extendedTextMessageData} }
//   Meta:      { entry[].changes[].value.messages[] }
function parseInbound(body) {
  if (!body) return null;

  // GREEN-API
  if (body.typeWebhook) {
    if (body.typeWebhook !== "incomingMessageReceived") return null;
    const from = body.senderData?.chatId;
    const md = body.messageData || {};
    const text =
      md.textMessageData?.textMessage ||
      md.extendedTextMessageData?.text ||
      "";
    return from && text ? { from, text } : null;
  }

  // Meta (WhatsApp Cloud API)
  const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
  if (message) {
    const from = message.from;
    const text = message.text?.body || "";
    return from && text ? { from, text } : null;
  }
  return null;
}

// --- WhatsApp: входящие сообщения (POST) ---
app.post("/webhook", async (req, res) => {
  // Подпись X-Hub-Signature-256 есть только у Meta. У GREEN-API её нет —
  // его вебхук определяем по полю typeWebhook и проверку подписи пропускаем.
  const isGreen = Boolean(req.body && req.body.typeWebhook);
  if (!isGreen && !isValidWhatsAppSignature(req)) {
    return res.sendStatus(403);
  }
  try {
    const msg = parseInbound(req.body);
    if (msg) await handleMessage(msg.from, msg.text, "whatsapp");
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

// Дашборд горячих лидов. По умолчанию — HTML-таблица (открыть в браузере),
// ?format=json — данные. Защита тем же ORDERS_API_KEY (если задан): ключ можно
// передать заголовком Authorization: Bearer ... или ?key=...
app.get("/hot", async (req, res) => {
  if (ORDERS_API_KEY) {
    const authed = req.get("authorization") === `Bearer ${ORDERS_API_KEY}` || req.query.key === ORDERS_API_KEY;
    if (!authed) return res.sendStatus(401);
  }
  const minScore = Number(req.query.min) || 0;
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const leads = await getHotLeads({ minScore, limit });
  const wantsJson = req.query.format === "json" || (req.get("accept") || "").includes("application/json");
  if (wantsJson) return res.json(leads);
  res.set("Content-Type", "text/html; charset=utf-8").send(renderHotHtml(leads));
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

  // Поллер ИИ-квалификации лидов (по умолчанию ВЫКЛ — включается QUAL_ENABLED=1).
  // Берёт чаты whatsapp_messages за последнее окно, оценивает ещё не
  // квалифицированные лиды и пишет результат в leads.ai_qual_*.
  if (isDbReady() && process.env.ANTHROPIC_API_KEY && isQualEnabled()) {
    const intervalMs = Number(process.env.QUAL_INTERVAL_MS) || 5 * 60 * 1000;
    const lookbackMin = Number(process.env.QUAL_LOOKBACK_MIN) || 60;
    const perTick = Number(process.env.QUAL_BATCH) || 10;
    console.log(`ИИ-квалификация лидов ВКЛ: каждые ${intervalMs}мс, окно ${lookbackMin}мин, до ${perTick} лидов/прогон.`);
    const qualTick = () => {
      const sinceIso = new Date(Date.now() - lookbackMin * 60 * 1000).toISOString();
      return processQualifications({ sinceIso, limit: perTick }).catch(err =>
        console.error("Ошибка поллера квалификации:", err));
    };
    setInterval(qualTick, intervalMs);
    qualTick();
  } else if (isDbReady()) {
    console.log("ИИ-квалификация лидов ВЫКЛ (QUAL_ENABLED!=1 или нет ANTHROPIC_API_KEY).");
  }

  // Агент-сторож: реже, чем поллер; чинит пропуски, устаревшие и сомнительные
  // оценки, мониторит здоровье. По умолчанию ВЫКЛ (WATCHDOG_ENABLED=1).
  if (isDbReady() && process.env.ANTHROPIC_API_KEY && isEnabled("WATCHDOG_ENABLED")) {
    const wdInterval = Number(process.env.WATCHDOG_INTERVAL_MS) || 60 * 60 * 1000;
    console.log(`Агент-сторож ВКЛ: каждые ${wdInterval}мс.`);
    const wdTick = () => runWatchdog().catch(err =>
      console.error("Ошибка сторожа:", err));
    setInterval(wdTick, wdInterval);
    // Первый прогон — с небольшой задержкой, чтобы не конкурировать со стартовым
    // прогоном поллера квалификации.
    setTimeout(wdTick, 30 * 1000);
  }
});

function isEnabled(name) {
  const v = String(process.env[name] || "").toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function isQualEnabled() {
  return isEnabled("QUAL_ENABLED");
}
#!/usr/bin/env node
// Веб-панель кодинг-ассистента: HTTP-сервер + чат со стримингом (SSE).
// Запуск:  node copilot/server.js  →  http://localhost:4000
//
// Эндпоинты:
//   GET  /            — веб-интерфейс
//   POST /api/chat    — новый запрос в сессию (SSE-поток событий)
//   POST /api/reset   — сброс истории сессии

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { runAgent } from "./core/agent.js";
import { mainProvider, strongProvider } from "./core/providers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.env.COPILOT_ROOT || process.cwd());
const PORT = process.env.COPILOT_PORT || 4000;

// История по сессиям (в памяти). sessionId → messages[].
const sessions = new Map();

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => {
      try {
        resolve(JSON.parse(data || "{}"));
      } catch {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/") {
    const html = fs.readFileSync(path.join(__dirname, "web", "index.html"), "utf8");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    return res.end(html);
  }

  // Раздача сгенерированных картинок из <root>/generated/.
  if (req.method === "GET" && url.pathname.startsWith("/generated/")) {
    const name = path.basename(decodeURIComponent(url.pathname.slice("/generated/".length)));
    const file = path.join(ROOT, "generated", name);
    try {
      const data = fs.readFileSync(file);
      const ext = path.extname(name).toLowerCase();
      const type = ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg";
      res.writeHead(200, { "content-type": type, "cache-control": "no-cache" });
      return res.end(data);
    } catch {
      res.writeHead(404);
      return res.end("not found");
    }
  }

  if (req.method === "GET" && url.pathname === "/api/info") {
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(
      JSON.stringify({
        main: mainProvider().label,
        strong: strongProvider().label,
        root: ROOT,
      })
    );
  }

  if (req.method === "POST" && url.pathname === "/api/reset") {
    const { sessionId } = await readBody(req);
    if (sessionId) sessions.delete(sessionId);
    res.writeHead(200, { "content-type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    const { sessionId: sid, message, strong } = await readBody(req);
    const provider = strong ? strongProvider() : mainProvider();
    const sessionId = sid || crypto.randomUUID();
    if (!message) {
      res.writeHead(400);
      return res.end("нет message");
    }

    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
    });
    const send = (obj) => res.write(`data: ${JSON.stringify(obj)}\n\n`);
    send({ type: "session", sessionId });

    const history = sessions.get(sessionId) || [];
    sessions.set(sessionId, history);
    history.push({ role: "user", content: message });

    try {
      await runAgent({ history, root: ROOT, provider, onEvent: send });
    } catch (e) {
      send({ type: "error", message: e.message });
    }
    send({ type: "done" });
    return res.end();
  }

  res.writeHead(404);
  res.end("not found");
});

server.listen(PORT, () => {
  console.log(`Copilot веб-панель:  http://localhost:${PORT}`);
  console.log(`Модель: ${mainProvider().label}   Рабочая область: ${ROOT}`);
});

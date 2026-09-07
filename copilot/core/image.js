// Бесплатная генерация картинок. По умолчанию — сервис Pollinations
// (бесплатно, без ключа и подписки). Базовый URL настраивается COPILOT_IMAGE_BASE,
// так что при желании можно подключить любой другой сервис вида prompt-in-URL.
// Картинки сохраняются в <root>/generated/ и раздаются веб-панелью.

import fs from "node:fs/promises";
import path from "node:path";

const BASE = process.env.COPILOT_IMAGE_BASE || "https://image.pollinations.ai/prompt/";

function slug(s) {
  return (
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9а-яё]+/gi, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "img"
  );
}

// Генерирует картинку по промпту, сохраняет в generated/ и возвращает
// { name, rel } (rel — путь относительно корня для показа в панели).
export async function generateImage(root, prompt, { width = 1024, height = 1024 } = {}) {
  const p = String(prompt || "").trim();
  if (!p) throw new Error("пустой промпт");

  const dir = path.join(root, "generated");
  await fs.mkdir(dir, { recursive: true });

  const url =
    BASE + encodeURIComponent(p) + `?width=${width}&height=${height}&nologo=true`;
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 copilot" },
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`сервис картинок вернул ${res.status}`);

  const ct = res.headers.get("content-type") || "";
  const buf = Buffer.from(await res.arrayBuffer());
  if (!ct.includes("image") || buf.length < 1000) {
    throw new Error(`ответ не похож на картинку (${buf.length} байт, ${ct})`);
  }

  const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
  const existing = await fs.readdir(dir).catch(() => []);
  const n = existing.filter((f) => f.startsWith("img-")).length + 1;
  const name = `img-${n}-${slug(p)}.${ext}`;
  await fs.writeFile(path.join(dir, name), buf);
  return { name, rel: `generated/${name}` };
}

// Минимальный загрузчик .env без зависимостей. Читает KEY=VALUE из файла .env
// и кладёт в process.env, не перетирая уже заданные переменные (реальное
// окружение важнее файла). Разбор вынесен в чистую функцию для тестов.

import { readFileSync } from "node:fs";

// Текст .env → { KEY: VALUE }. Поддерживает комментарии (#), пустые строки,
// встроенные комментарии после значения ("  # ...") и кавычки вокруг значения.
export function parseEnv(text = "") {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    if (!key) continue;
    let val = line.slice(eq + 1);
    // срезаем встроенный комментарий: пробел/таб перед # (как в .env.example)
    const c = val.search(/\s#/);
    if (c !== -1) val = val.slice(0, c);
    val = val.trim().replace(/^["']|["']$/g, "");
    out[key] = val;
  }
  return out;
}

// Обновить/добавить переменные в тексте .env, сохранив прочие строки и
// комментарии. updates: { KEY: VALUE }. Возвращает новый текст. Чистая функция.
export function upsertEnv(text = "", updates = {}) {
  const keys = new Set(Object.keys(updates));
  const seen = new Set();
  const lines = String(text).split(/\r?\n/);
  const out = lines.map(line => {
    const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=/);
    if (m && keys.has(m[1])) { seen.add(m[1]); return `${m[1]}=${updates[m[1]]}`; }
    return line;
  });
  // убираем пустой хвост, добавляем недостающие ключи
  while (out.length && out[out.length - 1].trim() === "") out.pop();
  for (const k of keys) if (!seen.has(k)) out.push(`${k}=${updates[k]}`);
  return out.join("\n") + "\n";
}

// Загрузить .env по пути (URL или строка) в process.env. Файл не обязателен —
// при отсутствии молча выходит. Не перетирает уже заданные переменные.
export function loadEnv(fileUrl) {
  let text;
  try {
    text = readFileSync(fileUrl, "utf8");
  } catch {
    return false;
  }
  const parsed = parseEnv(text);
  for (const [k, v] of Object.entries(parsed)) {
    if (process.env[k] === undefined || process.env[k] === "") process.env[k] = v;
  }
  return true;
}

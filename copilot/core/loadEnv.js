// Загрузка настроек ассистента из файла .copilot.env в корне проекта, чтобы не
// вводить ключи в терминале каждый раз. Формат: KEY=value по строке, # — комментарий.
// Уже заданные переменные окружения имеют приоритет (файл их не перетирает).

import fs from "node:fs";
import path from "node:path";

export function loadEnv(dir = process.cwd()) {
  let txt;
  try {
    txt = fs.readFileSync(path.join(dir, ".copilot.env"), "utf8");
  } catch {
    return;
  }
  for (const line of txt.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key && !(key in process.env)) process.env[key] = val;
  }
}

// Долговременная память ассистента. Хранится в файле в корне проекта и
// переживает перезапуск. Ассистент сам сохраняет туда важное (предпочтения
// пользователя, соглашения проекта, принятые решения) инструментом `remember`,
// а в начале каждой сессии заметки подгружаются в системный промпт.

import fs from "node:fs";
import path from "node:path";

const MAX_NOTES = 200;

function memFile(root) {
  return path.join(root, ".copilot-memory.md");
}

// Текст памяти (или "" если пусто/нет файла).
export function loadMemory(root) {
  try {
    return fs.readFileSync(memFile(root), "utf8").trim();
  } catch {
    return "";
  }
}

function readNotes(file) {
  try {
    return fs.readFileSync(file, "utf8").split("\n").filter((l) => l.trim());
  } catch {
    return [];
  }
}

// Добавить заметку в память (с дедупликацией и ограничением объёма).
export function addMemory(root, note) {
  const clean = String(note || "").trim().replace(/\s+/g, " ");
  if (!clean) return "Пустая заметка — нечего запоминать.";
  const file = memFile(root);
  let lines = readNotes(file);
  if (lines.some((l) => l.replace(/^-\s*/, "").trim() === clean)) {
    return "Уже в памяти.";
  }
  lines.push("- " + clean);
  if (lines.length > MAX_NOTES) lines = lines.slice(lines.length - MAX_NOTES);
  fs.writeFileSync(file, lines.join("\n") + "\n", "utf8");
  return "Запомнил: " + clean;
}

// Удалить заметки, содержащие подстроку (для исправления/забывания).
export function forgetMemory(root, match) {
  const clean = String(match || "").trim();
  if (!clean) return "Укажи, что забыть.";
  const file = memFile(root);
  const lines = readNotes(file);
  const kept = lines.filter((l) => !l.toLowerCase().includes(clean.toLowerCase()));
  const removed = lines.length - kept.length;
  if (!removed) return "Совпадений в памяти не найдено.";
  fs.writeFileSync(file, kept.join("\n") + (kept.length ? "\n" : ""), "utf8");
  return `Забыл ${removed} заметк(и) про «${clean}».`;
}

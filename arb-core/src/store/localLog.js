// Локальный лог прогнозов в JSONL (без облака). Каждый скан дописывает сюда
// прогнозы; грейдинг потом сверяет их с фактическим результатом. Чтение/запись
// и слияние вынесены в чистые функции (парсинг/merge тестируются без диска).

import { readFileSync, writeFileSync } from "node:fs";

// Ключ записи — событие+рынок+линия. Одна запись на линию.
export function logKey(r) {
  return `${r.event_id}:${r.market}:${r.line ?? "-"}`;
}

// JSONL-текст → массив записей (битые строки пропускаем).
export function parseLog(text = "") {
  const out = [];
  for (const line of String(text).split(/\r?\n/)) {
    const s = line.trim();
    if (!s) continue;
    try { out.push(JSON.parse(s)); } catch { /* пропускаем битую строку */ }
  }
  return out;
}

export function serializeLog(records = []) {
  if (!records.length) return "";
  return records.map(r => JSON.stringify(r)).join("\n") + "\n";
}

// Слияние: новые записи добавляем; ещё НЕ заграженные обновляем свежим прогнозом;
// уже заграженные (graded_at) не трогаем. Возвращает { records, added, updated }.
export function mergePredictions(existing = [], incoming = []) {
  const byKey = new Map(existing.map(r => [logKey(r), r]));
  let added = 0, updated = 0;
  for (const r of incoming) {
    const k = logKey(r);
    const prev = byKey.get(k);
    if (!prev) { byKey.set(k, r); added += 1; }
    else if (!prev.graded_at) { byKey.set(k, { ...r }); updated += 1; }
  }
  return { records: [...byKey.values()], added, updated };
}

// --- Диск ---

export function readLog(filePath) {
  try { return parseLog(readFileSync(filePath, "utf8")); }
  catch { return []; }
}

export function writeLog(filePath, records) {
  writeFileSync(filePath, serializeLog(records));
}

// Дописать/обновить прогнозы в файле. Возвращает { added, updated, total }.
export function upsertPredictions(filePath, incoming = []) {
  if (!incoming.length) {
    const cur = readLog(filePath);
    return { added: 0, updated: 0, total: cur.length };
  }
  const { records, added, updated } = mergePredictions(readLog(filePath), incoming);
  writeLog(filePath, records);
  return { added, updated, total: records.length };
}

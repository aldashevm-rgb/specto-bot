import { test } from "node:test";
import assert from "node:assert/strict";
import { logKey, parseLog, serializeLog, mergePredictions } from "../src/store/localLog.js";

test("logKey: событие+рынок+линия", () => {
  assert.equal(logKey({ event_id: "e1", market: "h2h", line: null }), "e1:h2h:-");
  assert.equal(logKey({ event_id: "e1", market: "totals", line: "Тотал 2.5" }), "e1:totals:Тотал 2.5");
});

test("parseLog/serializeLog: round-trip, битые строки пропускаются", () => {
  const recs = [{ event_id: "a", market: "h2h", line: null, probs: { A: 0.5, B: 0.5 } }];
  const text = serializeLog(recs) + "битая строка\n{плохой json}\n";
  const parsed = parseLog(text);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].event_id, "a");
});

test("mergePredictions: новые добавляются", () => {
  const { records, added, updated } = mergePredictions(
    [{ event_id: "a", market: "h2h", line: null, probs: { A: 1 } }],
    [{ event_id: "b", market: "h2h", line: null, probs: { A: 1 } }]
  );
  assert.equal(added, 1);
  assert.equal(updated, 0);
  assert.equal(records.length, 2);
});

test("mergePredictions: незаграженный обновляется, заграженный сохраняется", () => {
  const existing = [
    { event_id: "a", market: "h2h", line: null, probs: { A: 0.5 } },                 // не оценён
    { event_id: "b", market: "h2h", line: null, probs: { A: 0.5 }, graded_at: "t" }  // оценён
  ];
  const incoming = [
    { event_id: "a", market: "h2h", line: null, probs: { A: 0.9 } }, // обновит прогноз
    { event_id: "b", market: "h2h", line: null, probs: { A: 0.9 } }  // НЕ должен затереть
  ];
  const { records, added, updated } = mergePredictions(existing, incoming);
  assert.equal(added, 0);
  assert.equal(updated, 1);
  const a = records.find(r => r.event_id === "a");
  const b = records.find(r => r.event_id === "b");
  assert.equal(a.probs.A, 0.9);   // обновился
  assert.equal(b.probs.A, 0.5);   // сохранён (уже оценён)
});

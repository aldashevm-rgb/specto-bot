import { test } from "node:test";
import assert from "node:assert/strict";

import { analyzeImpact, formatPlaybookReport } from "../handlers/playbookMetrics.js";

// Хелпер строки automation_impact.
const row = (model, automation, is_active, conversion, leads) =>
  ({ model, automation, is_active, conversion, leads });

test("analyzeImpact: положительный lift при объёме → promote", () => {
  const rows = [
    row("B2B", "kp_followup", true, 0.30, 500),
    row("B2B", "kp_followup", false, 0.20, 500)
  ];
  const res = analyzeImpact(rows);
  assert.equal(res.length, 1);
  assert.deepEqual(res[0], {
    model: "B2B",
    automation: "kp_followup",
    conv_on: 0.3,
    conv_off: 0.2,
    lift: 0.1,
    recommend: "promote"
  });
});

test("analyzeImpact: заметно отрицательный lift при объёме → demote", () => {
  const rows = [
    row("B2C", "sms_blast", true, 0.10, 400),
    row("B2C", "sms_blast", false, 0.18, 400)
  ];
  const res = analyzeImpact(rows);
  assert.equal(res[0].recommend, "demote");
  assert.equal(res[0].lift, -0.08);
});

test("analyzeImpact: положительный lift, но мало данных → hold", () => {
  const rows = [
    row("B2B", "thin", true, 0.40, 50),
    row("B2B", "thin", false, 0.20, 50)
  ];
  const res = analyzeImpact(rows); // minLeads=200 по умолчанию
  assert.equal(res[0].recommend, "hold");
});

test("analyzeImpact: маленький отрицательный lift → hold (не demote)", () => {
  const rows = [
    row("B2B", "tiny_neg", true, 0.199, 500),
    row("B2B", "tiny_neg", false, 0.20, 500)
  ];
  const res = analyzeImpact(rows);
  assert.equal(res[0].recommend, "hold"); // lift -0.001 > DEMOTE_LIFT
});

test("analyzeImpact: пара без второй ветки → пропуск", () => {
  const rows = [row("B2B", "only_on", true, 0.30, 500)];
  assert.deepEqual(analyzeImpact(rows), []);
});

test("analyzeImpact: ветка с нулевым объёмом → пропуск пары", () => {
  const rows = [
    row("B2B", "zero_off", true, 0.30, 500),
    row("B2B", "zero_off", false, 0.20, 0)
  ];
  assert.deepEqual(analyzeImpact(rows), []);
});

test("analyzeImpact: настраиваемый minLeads повышает требования", () => {
  const rows = [
    row("B2B", "mid", true, 0.30, 300),
    row("B2B", "mid", false, 0.20, 300)
  ];
  assert.equal(analyzeImpact(rows, { minLeads: 200 })[0].recommend, "promote");
  assert.equal(analyzeImpact(rows, { minLeads: 500 })[0].recommend, "hold");
});

test("analyzeImpact: сортировка по убыванию lift", () => {
  const rows = [
    row("B2B", "a", true, 0.25, 500), row("B2B", "a", false, 0.20, 500), // lift 0.05
    row("B2B", "b", true, 0.40, 500), row("B2B", "b", false, 0.20, 500)  // lift 0.20
  ];
  const res = analyzeImpact(rows);
  assert.deepEqual(res.map(r => r.automation), ["b", "a"]);
});

test("formatPlaybookReport: топ проектов и флаги promote/demote", () => {
  const metrics = [
    { project_name: "stalfed", conversion: 0.32, leads: 900, playbook: "skeleton:b2b_supply" },
    { project_name: "beauty", conversion: 0.18, leads: 400, playbook: "skeleton:b2c_service" }
  ];
  const impact = [
    { model: "B2B", automation: "kp_followup", conv_on: 0.3, conv_off: 0.2, lift: 0.1, recommend: "promote" },
    { model: "B2C", automation: "sms_blast", conv_on: 0.1, conv_off: 0.18, lift: -0.08, recommend: "demote" }
  ];
  const text = formatPlaybookReport(metrics, impact);
  assert.match(text, /Эффективность плейбуков/);
  assert.match(text, /stalfed: 32\.0%/);
  assert.match(text, /Включить шире/);
  assert.match(text, /B2B\/kp_followup: \+10\.0 п\.п\./);
  assert.match(text, /Пересмотреть/);
  assert.match(text, /B2C\/sms_blast: -8\.0 п\.п\./);
  // топ отсортирован: stalfed выше beauty
  assert.ok(text.indexOf("stalfed") < text.indexOf("beauty"));
});

test("formatPlaybookReport: нет данных", () => {
  const text = formatPlaybookReport([], []);
  assert.match(text, /Нет данных по проектам/);
  assert.match(text, /Значимых сигналов по автоматизациям нет/);
});

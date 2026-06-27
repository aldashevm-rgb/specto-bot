import { test } from "node:test";
import assert from "node:assert/strict";

import { matchPlaybook, recommendPlaybook } from "../handlers/playbook.js";

// Минимальный набор скелетов: B2B-снабжение и B2C-услуги.
const PLAYBOOKS = [
  {
    key: "b2b_supply",
    title: "B2B-снабжение",
    match: { model: "B2B", industry_any: ["строитель", "ЖБИ", "металл", "снабжен"] },
    automations: [
      { code: "lead_autoreply", tier: "base" },
      { code: "manager_sla", tier: "base" },
      { code: "kp_followup", tier: "suggested" }
    ],
    stages: ["Заявка", "КП", "Счёт", "Отгрузка"],
    followups: [{ delayH: 2 }, { delayH: 24 }],
    marketing: ["кейсы поставок", "прайс-лист"]
  },
  {
    key: "b2c_service",
    title: "B2C-услуги",
    match: { model: "B2C", industry_any: ["услуг", "салон", "клиник", "кофей"] },
    automations: [
      { code: "booking_reminder", tier: "base" },
      { code: "review_request", tier: "suggested" }
    ],
    stages: ["Запись", "Визит", "Повтор"],
    followups: [{ delayH: 1 }],
    marketing: ["акции", "отзывы"]
  }
];

test("matchPlaybook: B2B-строй → b2b_supply (точное по отрасли)", () => {
  const profile = { model: "B2B", industry: "строительство", products: ["плиты ЖБИ"], summary: "завод" };
  assert.equal(matchPlaybook(profile, PLAYBOOKS)?.key, "b2b_supply");
});

test("matchPlaybook: B2C+услуги → b2c_service", () => {
  const profile = { model: "B2C", industry: "услуги красоты", products: ["стрижка"], summary: "салон в центре" };
  assert.equal(matchPlaybook(profile, PLAYBOOKS)?.key, "b2c_service");
});

test("matchPlaybook: слово находится в products/summary, не только industry", () => {
  const profile = { model: "B2B", industry: "торговля", products: [], summary: "снабжение объектов" };
  assert.equal(matchPlaybook(profile, PLAYBOOKS)?.key, "b2b_supply");
});

test("matchPlaybook: та же модель, но отрасль не совпала → дефолт по модели", () => {
  const profile = { model: "B2C", industry: "ритейл одежды", products: ["джинсы"], summary: "магазин" };
  // нет слова из b2c_service.industry_any, но модель B2C → первый B2C-плейбук
  assert.equal(matchPlaybook(profile, PLAYBOOKS)?.key, "b2c_service");
});

test("matchPlaybook: нет плейбука под модель → null", () => {
  const profile = { model: "B2B2C", industry: "маркетплейс", products: [], summary: "" };
  assert.equal(matchPlaybook(profile, PLAYBOOKS), null);
});

test("matchPlaybook: пустой список плейбуков → null", () => {
  assert.equal(matchPlaybook({ model: "B2B", industry: "строй" }, []), null);
});

test("matchPlaybook: пустой/невалидный профиль → null", () => {
  assert.equal(matchPlaybook(null, PLAYBOOKS), null);
  assert.equal(matchPlaybook({}, PLAYBOOKS), null); // model=undefined ни с чем не совпадёт
});

test("recommendPlaybook: форма результата", () => {
  const profile = { model: "B2B", industry: "строительство", products: ["ЖБИ"], summary: "" };
  const rec = recommendPlaybook(profile, PLAYBOOKS);
  assert.equal(rec.source, "skeleton:b2b_supply");
  assert.equal(rec.title, "B2B-снабжение");
  assert.deepEqual(rec.stages, ["Заявка", "КП", "Счёт", "Отгрузка"]);
  assert.deepEqual(rec.marketing, ["кейсы поставок", "прайс-лист"]);
  assert.equal(rec.automations.length, 3);
  assert.equal(rec.followups.length, 2);
  // ровно набор ключей
  assert.deepEqual(
    Object.keys(rec).sort(),
    ["automations", "followups", "marketing", "source", "stages", "title"]
  );
});

test("recommendPlaybook: нет совпадения → null", () => {
  const profile = { model: "B2B2C", industry: "x", products: [], summary: "" };
  assert.equal(recommendPlaybook(profile, PLAYBOOKS), null);
});

test("recommendPlaybook: массивы по умолчанию, если в скелете их нет", () => {
  const bare = [{ key: "k", title: "T", match: { model: "B2B", industry_any: ["строй"] } }];
  const rec = recommendPlaybook({ model: "B2B", industry: "строй" }, bare);
  assert.deepEqual(rec.automations, []);
  assert.deepEqual(rec.stages, []);
  assert.deepEqual(rec.followups, []);
  assert.deepEqual(rec.marketing, []);
});

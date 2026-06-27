import { test } from "node:test";
import assert from "node:assert/strict";

import { parseNicheProfile, buildNichePrompt, clampConfidence } from "../handlers/onboarding.js";

test("parseNicheProfile: собирает полный профиль из входа", () => {
  const p = parseNicheProfile({
    industry: "строительство",
    sub_niche: "ЖБИ",
    products: ["плиты", "опоры освещения"],
    model: "B2B",
    geo: "Астана",
    deal_band: "высокий",
    sales_cycle: "длинный",
    channels: ["whatsapp", "2gis"],
    audience: "строительные компании",
    pains: ["мало входящих заявок"],
    summary: "Завод ЖБИ, B2B, Астана.",
    confidence: 0.8
  });
  assert.equal(p.industry, "строительство");
  assert.equal(p.model, "B2B");
  assert.deepEqual(p.products, ["плиты", "опоры освещения"]);
  assert.deepEqual(p.channels, ["whatsapp", "2gis"]);
  assert.equal(p.confidence, 0.8);
});

test("parseNicheProfile: дефолты для пропущенных полей", () => {
  const p = parseNicheProfile({});
  assert.equal(p.industry, "неизвестно");
  assert.equal(p.sub_niche, "неизвестно");
  assert.equal(p.model, "неизвестно");
  assert.equal(p.geo, "неизвестно");
  assert.equal(p.deal_band, "неизвестно");
  assert.equal(p.sales_cycle, "неизвестно");
  assert.equal(p.audience, "неизвестно");
  assert.equal(p.summary, "");
});

test("parseNicheProfile: массивы гарантированы", () => {
  const p = parseNicheProfile({ products: "не массив", channels: null });
  assert.deepEqual(p.products, []);
  assert.deepEqual(p.channels, []);
  assert.deepEqual(p.pains, []);
  // валидный массив сохраняется
  const p2 = parseNicheProfile({ pains: ["боль1", "боль2"] });
  assert.deepEqual(p2.pains, ["боль1", "боль2"]);
});

test("parseNicheProfile: confidence зажимается в 0..1", () => {
  assert.equal(parseNicheProfile({ confidence: 1.7 }).confidence, 1);
  assert.equal(parseNicheProfile({ confidence: -0.5 }).confidence, 0);
  assert.equal(parseNicheProfile({ confidence: 0.42 }).confidence, 0.42);
  assert.equal(parseNicheProfile({ confidence: "плохо" }).confidence, 0);
  assert.equal(parseNicheProfile({}).confidence, 0);
});

test("parseNicheProfile: невалидный input → дефолтный профиль", () => {
  const p = parseNicheProfile(null);
  assert.equal(p.industry, "неизвестно");
  assert.equal(p.confidence, 0);
  assert.deepEqual(p.products, []);
});

test("clampConfidence: зажим и нечисловые значения", () => {
  assert.equal(clampConfidence(0.5), 0.5);
  assert.equal(clampConfidence(2), 1);
  assert.equal(clampConfidence(-1), 0);
  assert.equal(clampConfidence(undefined), 0);
});

test("buildNichePrompt: склеивает все переданные поля", () => {
  const text = buildNichePrompt({
    description: "Завод ЖБИ, продаём плиты",
    companyName: "Стальфед",
    city: "Астана",
    oked: "23.61"
  });
  assert.match(text, /Компания: Стальфед/);
  assert.match(text, /Город: Астана/);
  assert.match(text, /ОКЭД: 23\.61/);
  assert.match(text, /Описание бизнеса:\nЗавод ЖБИ, продаём плиты/);
});

test("buildNichePrompt: опускает пустые/неуказанные поля", () => {
  const text = buildNichePrompt({ description: "Кофейня в центре" });
  assert.match(text, /Описание бизнеса:\nКофейня в центре/);
  assert.doesNotMatch(text, /Компания:/);
  assert.doesNotMatch(text, /Город:/);
  assert.doesNotMatch(text, /ОКЭД:/);
});

test("buildNichePrompt: пустой вход → пустая строка", () => {
  assert.equal(buildNichePrompt({}), "");
  assert.equal(buildNichePrompt(), "");
  assert.equal(buildNichePrompt({ description: "   " }), "");
});

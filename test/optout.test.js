import { test } from "node:test";
import assert from "node:assert/strict";

import {
  normalizeText, isStopRequest, digitsKey, parseBlocklist, isBlocked, followupsEnabled
} from "../handlers/optout.js";

test("normalizeText: ё→е, пунктуация в пробелы, обрамление пробелами", () => {
  assert.equal(normalizeText("Не пишите, пожалуйста!"), " не пишите пожалуйста ");
  assert.equal(normalizeText("СТОП!!!"), " стоп ");
  assert.equal(normalizeText("чёрный список"), " черный список ");
});

test("isStopRequest: прямой запрет писать", () => {
  const phrases = [
    "стоп",
    "СТОП",
    "Не пишите мне больше",
    "не пиши мне",
    "хватит писать",
    "прекратите пожалуйста",
    "не беспокойте меня",
    "не звоните на этот номер",
    "отстаньте",
    "оставьте меня в покое"
  ];
  for (const p of phrases) assert.ok(isStopRequest(p), `не распознано: ${p}`);
});

test("isStopRequest: отписка и удаление из базы", () => {
  const phrases = [
    "отписаться",
    "отпишите меня от рассылки",
    "unsubscribe",
    "удалите мой номер из базы",
    "уберите меня",
    "заблокирую",
    "это спам",
    "в чс отправлю"
  ];
  for (const p of phrases) assert.ok(isStopRequest(p), `не распознано: ${p}`);
});

test("isStopRequest: старые стоп-слова продолжают работать", () => {
  for (const p of ["не нужно", "не надо", "передумал", "не интересно", "откажусь", "не актуально"]) {
    assert.ok(isStopRequest(p), `не распознано: ${p}`);
  }
});

test("isStopRequest: обычные сообщения не считаются отказом", () => {
  const ok = [
    "Здравствуйте, расскажите подробнее",
    "Сколько это стоит?",
    "Нужно посчитать бюджет",
    "Интересно, давайте созвонимся завтра",
    "У нас производство мебели"
  ];
  for (const p of ok) assert.equal(isStopRequest(p), false, `ложное срабатывание: ${p}`);
});

test("isStopRequest: пустой ввод — не отказ", () => {
  assert.equal(isStopRequest(""), false);
  assert.equal(isStopRequest(null), false);
  assert.equal(isStopRequest(undefined), false);
});

test("digitsKey: последние 10 цифр из chat_id любого формата", () => {
  assert.equal(digitsKey("77011234567@c.us"), "7011234567");
  assert.equal(digitsKey("+7 (701) 123-45-67"), "7011234567");
  assert.equal(digitsKey("77011234567"), "7011234567");
  assert.equal(digitsKey("abc"), null);
  assert.equal(digitsKey(""), null);
});

test("parseBlocklist: запятые/точки с запятой/переводы строк, пробелы внутри номера", () => {
  const set = parseBlocklist("77011234567, +7 702 000-00-00;  77773334455 \n");
  assert.equal(set.size, 3);
  assert.ok(set.has("7011234567"));
  assert.ok(set.has("7020000000"));
  assert.ok(set.has("7773334455"));
});

test("parseBlocklist: пустая строка — пустой список", () => {
  assert.equal(parseBlocklist("").size, 0);
  assert.equal(parseBlocklist(undefined).size, 0);
});

test("isBlocked: номер из стоп-листа матчится в любом формате", () => {
  const raw = "77011234567";
  assert.ok(isBlocked("77011234567@c.us", raw));
  assert.ok(isBlocked("+7 701 123 45 67", raw));
  assert.equal(isBlocked("77779998877@c.us", raw), false);
  assert.equal(isBlocked("77011234567", ""), false);
  assert.equal(isBlocked("77011234567", undefined), false);
});

test("followupsEnabled: по умолчанию включено, 0/false/no/off выключают", () => {
  assert.ok(followupsEnabled({}));
  assert.ok(followupsEnabled({ FOLLOWUPS_ENABLED: "1" }));
  for (const v of ["0", "false", "no", "off", "OFF"]) {
    assert.equal(followupsEnabled({ FOLLOWUPS_ENABLED: v }), false, `не выключило: ${v}`);
  }
});

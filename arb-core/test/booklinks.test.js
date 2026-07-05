import { test } from "node:test";
import assert from "node:assert/strict";
import { bookmakerUrl, searchUrl } from "../src/notify/booklinks.js";
import { linkKeyboard } from "../src/notify/telegram.js";

test("bookmakerUrl: известные конторы → сайт", () => {
  assert.equal(bookmakerUrl("1xBet"), "https://1xbet.com");
  assert.equal(bookmakerUrl("Unibet (SE)"), "https://www.unibet.com"); // со скобками
  assert.equal(bookmakerUrl("Betfair"), "https://www.betfair.com");
  assert.equal(bookmakerUrl("Pinnacle"), "https://www.pinnacle.com");
});

test("bookmakerUrl: неизвестная контора → null", () => {
  assert.equal(bookmakerUrl("Некий Букмекер"), null);
});

test("searchUrl: поиск по конторе и командам", () => {
  const u = searchUrl("1xBet", "Real Madrid", "Barcelona");
  assert.match(u, /^https:\/\/www\.google\.com\/search\?q=/);
  assert.match(u, /1xBet/);
  assert.match(u, /Real%20Madrid|Real\+Madrid/);
});

test("linkKeyboard: кнопка конторы (если известна) + поиск", () => {
  const kb = linkKeyboard("1xBet", "A", "B");
  const row = kb.inline_keyboard[0];
  assert.equal(row.length, 2);
  assert.match(row[0].text, /Открыть 1xBet/);
  assert.equal(row[0].url, "https://1xbet.com");
  assert.match(row[1].text, /Найти матч/);
});

test("linkKeyboard: неизвестная контора → только кнопка поиска", () => {
  const kb = linkKeyboard("Некий Бук", "A", "B");
  assert.equal(kb.inline_keyboard[0].length, 1);
  assert.match(kb.inline_keyboard[0][0].text, /Найти матч/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  linkKeyboard, surebetKeyboard, actionRow, collapseToLinks
} from "../src/notify/telegram.js";

test("actionRow: две интерактивные кнопки с callback_data", () => {
  const row = actionRow();
  assert.equal(row.length, 2);
  assert.equal(row[0].callback_data, "ok");
  assert.equal(row[1].callback_data, "no");
  assert.match(row[0].text, /Поставил/);
});

test("linkKeyboard: ряд ссылок + ряд действий", () => {
  const kb = linkKeyboard("1xBet", "A", "B");
  assert.equal(kb.inline_keyboard.length, 2);
  assert.equal(kb.inline_keyboard[0].length, 2);          // открыть + найти
  assert.equal(kb.inline_keyboard[1][0].callback_data, "ok"); // действия
});

test("surebetKeyboard: открыть каждую известную контору + действия", () => {
  const sb = {
    home: "Arsenal", away: "Chelsea",
    arb: { legs: [
      { bookmaker: "1xBet" }, { bookmaker: "Marathonbet" }, { bookmaker: "1xBet" }
    ] }
  };
  const kb = surebetKeyboard(sb);
  const links = kb.inline_keyboard[0];
  assert.equal(links.length, 2);                          // две уникальные конторы
  assert.equal(links[0].url, "https://1xbet.com");
  assert.equal(links[1].url, "https://www.marathonbet.com");
  assert.equal(kb.inline_keyboard[1][0].callback_data, "ok");
});

test("surebetKeyboard: неизвестные конторы → кнопка поиска", () => {
  const sb = { home: "A", away: "B", arb: { legs: [{ bookmaker: "Некий Бук" }] } };
  const kb = surebetKeyboard(sb);
  assert.equal(kb.inline_keyboard[0].length, 1);
  assert.match(kb.inline_keyboard[0][0].text, /Найти матч/);
});

test("collapseToLinks: оставляет только url-кнопки + строку-пометку", () => {
  const kb = linkKeyboard("1xBet", "A", "B");
  const collapsed = collapseToLinks(kb, "✅ Ты отметил: поставил");
  // экшн-ряд (callback ok/no) убран, url-ряд остался, добавлена пометка
  assert.equal(collapsed.inline_keyboard.length, 2);
  assert.ok(collapsed.inline_keyboard[0].every(b => b.url));
  const note = collapsed.inline_keyboard[1][0];
  assert.equal(note.callback_data, "noop");
  assert.match(note.text, /отметил/);
});

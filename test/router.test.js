import { test } from "node:test";
import assert from "node:assert/strict";

import { isStopMessage } from "../handlers/router.js";

test("isStopMessage: короткий явный отказ → стоп", () => {
  assert.equal(isStopMessage("не нужно"), true);
  assert.equal(isStopMessage("спасибо, не надо"), true);
  assert.equal(isStopMessage("не интересно"), true);
  assert.equal(isStopMessage("всё, передумал"), true);
});

test("isStopMessage: вопрос со стоп-словом — НЕ отказ (живой лид)", () => {
  assert.equal(isStopMessage("а мне не надо будет платить фикс?"), false);
  assert.equal(isStopMessage("почему клиенту не нужно платить наперёд?"), false);
});

test("isStopMessage: длинное сообщение со стоп-словом отдаём ИИ, не стопим", () => {
  assert.equal(
    isStopMessage("то что было раньше мне не интересно, расскажите про ваш подход подробнее"),
    false
  );
});

test("isStopMessage: обычный интерес — не стоп", () => {
  assert.equal(isStopMessage("да, расскажите подробнее"), false);
  assert.equal(isStopMessage("сколько это стоит?"), false);
});

test("isStopMessage: пустое/мусорное — не стоп", () => {
  assert.equal(isStopMessage(""), false);
  assert.equal(isStopMessage(null), false);
  assert.equal(isStopMessage(undefined), false);
});

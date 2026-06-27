import { test } from "node:test";
import assert from "node:assert/strict";

import { pickLeastLoaded } from "../handlers/assign.js";

test("pickLeastLoaded: выбирает менеджера с минимальной загрузкой", () => {
  assert.equal(pickLeastLoaded({ Didar: 1741, Айбек: 2339, Ильяс: 1665, Жансая: 877 }), "Жансая");
});

test("pickLeastLoaded: при равенстве берёт первого", () => {
  assert.equal(pickLeastLoaded({ A: 5, B: 5, C: 9 }), "A");
});

test("pickLeastLoaded: пустой список → null", () => {
  assert.equal(pickLeastLoaded({}), null);
});

test("pickLeastLoaded: учитывает обновлённую загрузку (после назначения)", () => {
  // Имитируем последовательное назначение: после +1 у Жансаи выбор может смениться.
  const loads = { Жансая: 877, Ильяс: 878 };
  const first = pickLeastLoaded(loads);
  assert.equal(first, "Жансая");
  loads[first] += 1; // 878
  loads[first] += 1; // 879
  // теперь Ильяс (878) меньше — следующий уйдёт ему
  assert.equal(pickLeastLoaded(loads), "Ильяс");
});

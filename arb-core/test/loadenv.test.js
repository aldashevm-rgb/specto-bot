import { test } from "node:test";
import assert from "node:assert/strict";
import { parseEnv, loadEnv, upsertEnv } from "../src/util/loadEnv.js";

test("parseEnv: базовые пары ключ-значение", () => {
  const e = parseEnv("ODDS_API_KEY=abc123\nARB_STAKE=1000");
  assert.equal(e.ODDS_API_KEY, "abc123");
  assert.equal(e.ARB_STAKE, "1000");
});

test("parseEnv: срезает встроенный комментарий после значения", () => {
  const e = parseEnv("ARB_MIN_MARGIN=0.5      # минимальная маржа\nODDS_MARKET=h2h,totals  # рынки");
  assert.equal(e.ARB_MIN_MARGIN, "0.5");
  assert.equal(e.ODDS_MARKET, "h2h,totals");
});

test("parseEnv: пропускает комментарии и пустые строки", () => {
  const e = parseEnv("# коммент\n\nODDS_API_KEY=x\n   \n# ещё");
  assert.deepEqual(Object.keys(e), ["ODDS_API_KEY"]);
});

test("parseEnv: снимает кавычки и лишние пробелы", () => {
  const e = parseEnv('NAME="value with space"\nOTHER=  trimmed  ');
  assert.equal(e.NAME, "value with space");
  assert.equal(e.OTHER, "trimmed");
});

test("parseEnv: значение с '=' внутри (напр. ключ с padding) сохраняется", () => {
  const e = parseEnv("TOKEN=ab==cd");
  assert.equal(e.TOKEN, "ab==cd");
});

test("loadEnv: несуществующий файл → false, без исключения", () => {
  assert.equal(loadEnv(new URL("./__nope__.env", import.meta.url)), false);
});

test("upsertEnv: обновляет существующий ключ, сохраняет остальное", () => {
  const src = "# коммент\nODDS_API_KEY=abc\nTELEGRAM_BOT_TOKEN=\nARB_STAKE=1000\n";
  const out = upsertEnv(src, { TELEGRAM_BOT_TOKEN: "123:xyz" });
  assert.match(out, /TELEGRAM_BOT_TOKEN=123:xyz/);
  assert.match(out, /ODDS_API_KEY=abc/);   // не тронут
  assert.match(out, /# коммент/);          // комментарий сохранён
  assert.match(out, /ARB_STAKE=1000/);
});

test("upsertEnv: добавляет отсутствующие ключи в конец", () => {
  const out = upsertEnv("ODDS_API_KEY=abc\n", { TELEGRAM_CHAT_ID: "987" });
  assert.match(out, /ODDS_API_KEY=abc/);
  assert.match(out, /TELEGRAM_CHAT_ID=987/);
});

test("upsertEnv: пустой вход → только новые ключи", () => {
  const out = upsertEnv("", { TELEGRAM_BOT_TOKEN: "t", TELEGRAM_CHAT_ID: "c" });
  assert.match(out, /TELEGRAM_BOT_TOKEN=t/);
  assert.match(out, /TELEGRAM_CHAT_ID=c/);
});

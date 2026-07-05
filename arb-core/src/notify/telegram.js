// Уведомления о найденных вилках в Telegram (Bot API sendMessage).
// Формирование текста вынесено в чистую функцию — тестируется без сети.

import { config, haveTelegram } from "../config.js";
import { withRetry } from "../util/http.js";
import { kellyStake } from "../core/kelly.js";
import { sportLabel, outcomeLabel, timeUntil } from "./labels.js";
import { bookmakerUrl, searchUrl } from "./booklinks.js";

// Экранирование для parse_mode=HTML (Telegram).
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Текущее время (вынесено — можно подменить в тестах через _now).
let _now = () => Date.now();

// Вилка → чистый, читаемый HTML-текст сообщения.
export function formatSurebet(sb) {
  const legs = sb.arb.legs.map(l => {
    const pick = outcomeLabel({ name: l.name, market: sb.market, home: sb.home, away: sb.away, point: sb.point });
    return `• <b>${esc(pick)}</b> — кэф ${l.odds}, контора ${esc(l.bookmaker)}, поставь ${l.stake}`;
  }).join("\n");

  return [
    `🎯 <b>ВИЛКА — гарантированный доход +${sb.arb.marginPct}%</b>`,
    ``,
    sportLabel(sb.sport),
    `<b>${esc(sb.home)} — ${esc(sb.away)}</b>`,
    sb.line ? `📊 ${esc(sb.line)}` : null,
    `🕒 ${timeUntil(sb.commence, _now())}`,
    ``,
    `Поставь на ВСЕ исходы (у разных контор):`,
    legs,
    ``,
    `💰 Всего ${sb.arb.invested} → прибыль <b>+${sb.arb.profit}</b> при любом результате`
  ].filter(x => x !== null).join("\n");
}

// Отправить одно сообщение. replyMarkup — опц. inline-клавиатура (кнопки).
// Возвращает true/false. Без ключей — тихо false.
export async function sendTelegram(text, replyMarkup = null) {
  if (!haveTelegram()) return false;
  const url = `https://api.telegram.org/bot${config.telegramToken}/sendMessage`;
  try {
    await withRetry(
      async () => {
        const payload = {
          chat_id: config.telegramChatId,
          text,
          parse_mode: "HTML",
          disable_web_page_preview: true
        };
        if (replyMarkup) payload.reply_markup = replyMarkup;
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const body = await res.text();
          const err = new Error(`Telegram ${res.status}: ${body}`);
          err.status = res.status;
          throw err;
        }
        return res.json();
      },
      { retries: 2, baseMs: 700, label: "Telegram", retryOn: e => !e.status || e.status >= 500 || e.status === 429 }
    );
    return true;
  } catch (err) {
    console.error("Ошибка отправки в Telegram:", err.message);
    return false;
  }
}

// Уведомить о списке вилок выше порога маржи. Возвращает число отправленных.
export async function notifySurebets(surebets = [], minMarginPct = config.notifyMinMarginPct) {
  if (!haveTelegram()) return 0;
  let sent = 0;
  for (const sb of surebets) {
    if (sb.arb.marginPct < minMarginPct) continue;
    if (await sendTelegram(formatSurebet(sb), searchKeyboard(sb.home, sb.away))) sent += 1;
  }
  return sent;
}

// value-ставка → чистый, читаемый HTML-текст алерта.
export function formatValueAlert(v, kelly = null) {
  const b = v.valueBet;
  const rel = b.tier === "sharp" ? "🟢 надёжная" : "🟡 обычная";
  const pick = outcomeLabel({ name: b.name, market: v.market, home: v.home, away: v.away, point: v.point });
  const lines = [
    `💡 <b>ВЫГОДНАЯ СТАВКА  +${b.edgePct}%</b>`,
    ``,
    sportLabel(v.sport),
    `<b>${esc(v.home)} — ${esc(v.away)}</b>`,
    `🕒 ${timeUntil(v.commence, _now())}`,
    ``,
    `✅ Ставить на: <b>${esc(pick)}</b>`,
    `💵 Лучший коэф: <b>${b.odds}</b> — ${esc(b.bookmaker)} (${rel})`
  ];
  // Сравнение кэфов по конторам: где больше, отмечено ⭐.
  if (Array.isArray(b.books) && b.books.length > 1) {
    const cmp = b.books.slice(0, 4)
      .map((x, i) => `${esc(x.bookmaker)} ${x.odds}${i === 0 ? " ⭐" : ""}`)
      .join(" · ");
    lines.push(`📊 Кэфы: ${cmp}`);
  }
  const p = v.prediction && v.prediction.probs ? v.prediction.probs[b.name] : null;
  if (p != null && kelly) {
    const k = kellyStake(p, b.odds, kelly);
    lines.push(`💰 Сумма ставки: <b>${k.stake}</b> (${(k.fractionOfBank * 100).toFixed(1)}% банка)`);
  }
  return lines.join("\n");
}

// Уведомить о value-ставках. kelly = { bankroll, fraction, maxFraction } или null.
export async function notifyValues(values = [], kelly = null) {
  if (!haveTelegram()) return 0;
  let sent = 0;
  for (const v of values) {
    const kb = linkKeyboard(v.valueBet.bookmaker, v.home, v.away);
    if (await sendTelegram(formatValueAlert(v, kelly), kb)) sent += 1;
  }
  return sent;
}

// Результат сыгравшей ставки → HTML-текст («сыграла/не зашла» + деньги).
// rec — заграженная запись лога (с valueBet, winner, bet_won, счётом).
export function formatGradeResult(rec, kelly = null) {
  const b = rec.valueBet || {};
  const won = rec.bet_won === true;
  const head = won ? "✅ <b>СТАВКА СЫГРАЛА!</b>" : "❌ <b>Ставка не зашла</b>";
  const score = (rec.actual_home != null && rec.actual_away != null)
    ? ` · счёт ${rec.actual_home}:${rec.actual_away}` : "";
  const pick = outcomeLabel({ name: b.name, market: rec.market, home: rec.home, away: rec.away, point: rec.point });
  const lines = [
    head,
    ``,
    `${sportLabel(rec.sport)}${score}`,
    `<b>${esc(rec.home)} — ${esc(rec.away)}</b>`,
    `Ставка была: ${esc(pick)} (кэф ${b.odds})`
  ];
  const p = rec.probs ? rec.probs[b.name] : null;
  if (p != null && kelly) {
    const k = kellyStake(p, b.odds, kelly);
    const profit = won ? k.stake * (Number(b.odds) - 1) : -k.stake;
    const r2 = Math.round(profit * 100) / 100;
    lines.push(`💰 Ставил ${k.stake} → <b>${r2 >= 0 ? "+" : ""}${r2}</b>`);
  }
  return lines.join("\n");
}

// Inline-клавиатура с кнопкой подтверждения ставки. cbData — callback_data.
export function confirmKeyboard(cbData, label = "✅ Поставить") {
  return { inline_keyboard: [[{ text: label, callback_data: String(cbData) }]] };
}

// Клавиатура-ссылки: открыть контору + найти матч (ставишь сам в приложении).
export function linkKeyboard(bookmaker, home, away) {
  const row = [];
  const url = bookmakerUrl(bookmaker);
  if (url) row.push({ text: `🔗 Открыть ${bookmaker}`, url });
  row.push({ text: "🔎 Найти матч", url: searchUrl(bookmaker, home, away) });
  return { inline_keyboard: [row] };
}

// Клавиатура только с поиском (для вилок — там несколько контор).
export function searchKeyboard(home, away) {
  return { inline_keyboard: [[{ text: "🔎 Найти матч", url: searchUrl("", home, away) }]] };
}

// Опросить обновления Telegram (для нажатий кнопок). offset — с какого update_id.
// Возвращает { updates, nextOffset }.
export async function getUpdates(offset = 0, timeoutSec = 0) {
  if (!haveTelegram()) return { updates: [], nextOffset: offset };
  const url = `https://api.telegram.org/bot${config.telegramToken}/getUpdates` +
    `?timeout=${timeoutSec}&allowed_updates=%5B%22callback_query%22%5D` +
    (offset ? `&offset=${offset}` : "");
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  const updates = data.ok && Array.isArray(data.result) ? data.result : [];
  const nextOffset = updates.length ? updates[updates.length - 1].update_id + 1 : offset;
  return { updates, nextOffset };
}

// Ответить на нажатие кнопки (убрать «часики») и опц. показать всплывашку.
export async function answerCallback(callbackId, text = "") {
  if (!haveTelegram()) return false;
  const url = `https://api.telegram.org/bot${config.telegramToken}/answerCallbackQuery`;
  try {
    await fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ callback_query_id: callbackId, text: text.slice(0, 200) })
    });
    return true;
  } catch { return false; }
}

// Разослать результаты по заграженным value-ставкам. Возвращает число отправленных.
export async function notifyResults(records = [], kelly = null) {
  if (!haveTelegram()) return 0;
  let sent = 0;
  for (const r of records) {
    if (r.valueBet && r.bet_won != null) {
      if (await sendTelegram(formatGradeResult(r, kelly))) sent += 1;
    }
  }
  return sent;
}

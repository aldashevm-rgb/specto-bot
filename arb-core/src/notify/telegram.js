// Уведомления о найденных вилках в Telegram (Bot API sendMessage).
// Формирование текста вынесено в чистую функцию — тестируется без сети.

import { config, haveTelegram } from "../config.js";
import { withRetry } from "../util/http.js";
import { kellyStake } from "../core/kelly.js";
import { sportLabel, outcomeLabel, timeUntil } from "./labels.js";

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

// Отправить одно сообщение. Возвращает true/false. Без ключей — тихо false.
export async function sendTelegram(text) {
  if (!haveTelegram()) return false;
  const url = `https://api.telegram.org/bot${config.telegramToken}/sendMessage`;
  try {
    await withRetry(
      async () => {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            chat_id: config.telegramChatId,
            text,
            parse_mode: "HTML",
            disable_web_page_preview: true
          })
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
    if (await sendTelegram(formatSurebet(sb))) sent += 1;
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
    `💵 Коэффициент: <b>${b.odds}</b>`,
    `🏦 Контора: ${esc(b.bookmaker)} (${rel})`
  ];
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
    if (await sendTelegram(formatValueAlert(v, kelly))) sent += 1;
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

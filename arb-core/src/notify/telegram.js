// Уведомления о найденных вилках в Telegram (Bot API sendMessage).
// Формирование текста вынесено в чистую функцию — тестируется без сети.

import { config, haveTelegram } from "../config.js";
import { withRetry } from "../util/http.js";

// Экранирование для parse_mode=HTML (Telegram).
function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Вилка → готовый HTML-текст сообщения.
export function formatSurebet(sb) {
  const kickoff = sb.commence ? new Date(sb.commence).toISOString().replace("T", " ").slice(0, 16) : "?";
  const lineTag = sb.line ? ` · ${esc(sb.line)}` : "";
  const head =
    `🎯 <b>Вилка ${sb.arb.marginPct}%</b> (ROI ${sb.arb.roi}%)\n` +
    `${esc(sb.home)} — ${esc(sb.away)}\n` +
    `<i>${esc(sb.sport)}${lineTag} · ${kickoff}</i>\n` +
    `Банк ${sb.arb.invested} → гаранта ${sb.arb.guaranteedPayout} (профит <b>${sb.arb.profit}</b>)`;

  const legs = sb.arb.legs
    .map(l => `• ${esc(l.name)} @ ${l.odds} (${esc(l.bookmaker)}) — ставка ${l.stake}`)
    .join("\n");

  let ai = "";
  if (sb.ai) {
    ai =
      `\n🤖 нужнее победа: ${esc(sb.ai.needsWin)}; вероятный исход: ${esc(sb.ai.likelyOutcome)} ` +
      `(П1 ${Math.round(sb.ai.probs.home * 100)}% / Х ${Math.round(sb.ai.probs.draw * 100)}% / ` +
      `П2 ${Math.round(sb.ai.probs.away * 100)}%)`;
  }
  return `${head}\n${legs}${ai}`;
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

// Оркестратор автоставки с подтверждением. Предлагает ставку кнопкой в Telegram,
// ловит нажатие, проверяет лимиты и ставит через Betfair (или dry-run).
// Всё завязано на config.betting — по умолчанию ВЫКЛ и DRY-RUN.

import { config, haveTelegram, haveBetfair } from "../config.js";
import {
  sendTelegram, confirmKeyboard, answerCallback, formatValueAlert
} from "../notify/telegram.js";
import { kellyStake } from "../core/kelly.js";
import { validateBet } from "./caps.js";
import { addPending, takePending, sweepExpired, shortId } from "./pending.js";
import { placeBet } from "./betfair.js";

const pending = new Map();
let counter = 0;
let spent = { day: "", total: 0 };

function today(nowMs) { return new Date(nowMs).toISOString().slice(0, 10); }
function spentToday(nowMs) {
  const d = today(nowMs);
  if (spent.day !== d) spent = { day: d, total: 0 };
  return spent.total;
}
function addSpent(nowMs, amount) { spentToday(nowMs); spent.total += amount; }

function isBetfair(bookmaker) {
  return String(bookmaker || "").toLowerCase().includes("betfair");
}

function kellyFor(v) {
  const b = v.valueBet;
  const p = v.prediction && v.prediction.probs ? v.prediction.probs[b.name] : null;
  if (p == null) return 0;
  return kellyStake(p, b.odds, {
    bankroll: config.bankroll, fraction: config.kellyFraction, maxFraction: config.kellyMaxFraction, minStake: config.minStake, maxStake: config.maxStake
  }).stake;
}

// Предложить ставку с кнопкой подтверждения (если автоставка ВКЛ и пик — Betfair).
// Возвращает true, если алерт отправлен здесь (вотчер тогда не шлёт его повторно).
export async function maybeOffer(v, nowMs = Date.now()) {
  const b = v.valueBet;
  if (!config.betting.enabled || !haveTelegram() || !isBetfair(b.bookmaker)) return false;
  const stake = kellyFor(v);
  if (!(stake > 0)) return false;

  counter += 1;
  const id = shortId(`${nowMs}${counter}`);
  addPending(pending, id, {
    home: v.home, away: v.away, outcomeName: b.name, price: b.odds, size: stake, commence: v.commence
  }, nowMs, config.betting.confirmTtlMs);

  const kelly = { bankroll: config.bankroll, fraction: config.kellyFraction, maxFraction: config.kellyMaxFraction, minStake: config.minStake, maxStake: config.maxStake };
  const mode = config.betting.dryRun ? "\n🧪 режим DRY-RUN (реальные деньги не трогаются)" : "";
  await sendTelegram(
    formatValueAlert(v, kelly) + `\n\nПоставить эту ставку на Betfair?${mode}`,
    confirmKeyboard(`bet:${id}`, `✅ Поставить ${stake}`)
  );
  return true;
}

async function handleConfirm(id, callbackId, nowMs) {
  const bet = takePending(pending, id, nowMs);
  if (!bet) { await answerCallback(callbackId, "Ставка устарела или уже обработана."); return; }

  const check = validateBet({
    stake: bet.size, maxStake: config.betting.maxStake,
    dailyCap: config.betting.dailyCap, spentToday: spentToday(nowMs)
  });
  if (!check.ok) {
    await answerCallback(callbackId, "Отклонено: " + check.reason);
    await sendTelegram(`⛔ Ставка не поставлена: ${check.reason}`);
    return;
  }

  // DRY-RUN или нет ключей Betfair — реально не ставим.
  if (config.betting.dryRun || !haveBetfair()) {
    addSpent(nowMs, bet.size);
    await answerCallback(callbackId, "🧪 DRY-RUN: ставка НЕ отправлена.");
    await sendTelegram(
      `🧪 <b>DRY-RUN</b> — поставил бы <b>${bet.size}</b> на «${bet.outcomeName}» @ ${bet.price}\n` +
      `${bet.home} — ${bet.away}. Реальные деньги не тронуты.`
    );
    return;
  }

  await answerCallback(callbackId, "Ставлю на Betfair…");
  try {
    const r = await placeBet(bet);
    if (r.ok) {
      addSpent(nowMs, bet.size);
      await sendTelegram(`✅ Betfair принял ставку: <b>${bet.size}</b> на «${bet.outcomeName}» @ ${bet.price}\n${bet.home} — ${bet.away}`);
    } else {
      await sendTelegram(`⚠️ Betfair не принял ставку: ${r.reason || "см. лог"}`);
    }
  } catch (err) {
    await sendTelegram(`⚠️ Ошибка ставки Betfair: ${err.message}`);
  }
}

// Почистить просроченные подтверждения. Зовёт единый поллер (poll.js).
export function sweepBetting(nowMs = Date.now()) {
  if (!config.betting.enabled) return;
  sweepExpired(pending, nowMs);
}

// Обработать нажатие кнопки подтверждения ставки (callback_data вида "bet:<id>",
// префикс уже снят вызывающим). Возвращает true, если это была наша кнопка.
export async function handleBettingCallback(id, callbackId, nowMs = Date.now()) {
  if (!config.betting.enabled || !haveTelegram()) return false;
  await handleConfirm(id, callbackId, nowMs);
  return true;
}

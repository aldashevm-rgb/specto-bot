// Клиент официального API биржи Betfair (Exchange). Логин, поиск рынка/исхода,
// размещение ставки. Сетевые вызовы тонкие; сборка запроса — чистая (тестируется).
//
// ВНИМАНИЕ: реальные деньги. По умолчанию весь путь идёт в DRY-RUN (см. watch).
// Проверено может быть только на твоём аккаунте Betfair — обкатай на dry-run и
// мелких суммах, прежде чем доверять.

import { config } from "../config.js";
import { matchSelectionId } from "./match.js";

const IDENTITY_URL = "https://identitysso.betfair.com/api/login";
const BETTING_URL = "https://api.betfair.com/exchange/betting/rest/v1.0";

// --- Чистая сборка запроса placeOrders (тестируется) ---
// Ставка BACK по лимитной цене (не выше найденной) на size (в валюте счёта).
export function buildPlaceOrders({ marketId, selectionId, price, size }) {
  return {
    marketId: String(marketId),
    instructions: [{
      selectionId: Number(selectionId),
      handicap: 0,
      side: "BACK",
      orderType: "LIMIT",
      limitOrder: {
        size: Math.round(Number(size) * 100) / 100,
        price: Number(price),
        persistenceType: "LAPSE" // не переносить в ин-плей
      }
    }]
  };
}

// Успешна ли ставка по ответу placeOrders.
export function isPlaced(resp) {
  return Boolean(resp && resp.status === "SUCCESS" &&
    Array.isArray(resp.instructionReports) &&
    resp.instructionReports[0]?.orderStatus === "EXECUTION_COMPLETE");
}

// --- Сеть ---

function headers(token) {
  return {
    "X-Application": config.betting.betfair.appKey,
    "X-Authentication": token,
    "Content-Type": "application/json",
    Accept: "application/json"
  };
}

// Интерактивный логин (username+password+appKey) → session token.
export async function login() {
  const { appKey, username, password } = config.betting.betfair;
  if (!appKey || !username || !password) throw new Error("нет BETFAIR_APP_KEY/USERNAME/PASSWORD");
  const res = await fetch(IDENTITY_URL, {
    method: "POST",
    headers: {
      "X-Application": appKey,
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json"
    },
    body: new URLSearchParams({ username, password })
  });
  const data = await res.json().catch(() => ({}));
  if (data.status !== "SUCCESS" || !data.token) {
    throw new Error(`Betfair login: ${data.status || res.status} ${data.error || ""}`);
  }
  return data.token;
}

async function rpc(token, path, body) {
  const res = await fetch(`${BETTING_URL}/${path}`, {
    method: "POST", headers: headers(token), body: JSON.stringify(body)
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Betfair ${path} ${res.status}: ${t.slice(0, 200)}`);
  }
  return res.json();
}

// Найти marketId (MATCH_ODDS) и selectionId по события/исходу. null, если не нашли.
export async function findMarketSelection(token, { home, away, outcomeName, commence }) {
  // Ищем рынок по названию команд.
  const catalogue = await rpc(token, "listMarketCatalogue/", {
    filter: { textQuery: `${home} ${away}`, marketTypeCodes: ["MATCH_ODDS"] },
    maxResults: 5,
    marketProjection: ["RUNNER_DESCRIPTION", "EVENT", "MARKET_START_TIME"]
  });
  if (!Array.isArray(catalogue) || !catalogue.length) return null;

  // Берём ближайший по времени старта к нашему commence.
  const want = commence ? Date.parse(commence) : null;
  let market = catalogue[0];
  if (want) {
    market = catalogue
      .map(m => ({ m, dt: Math.abs(Date.parse(m.marketStartTime || 0) - want) }))
      .sort((a, b) => a.dt - b.dt)[0].m;
  }
  const runners = (market.runners || []).map(r => ({ selectionId: r.selectionId, runnerName: r.runnerName }));
  const selectionId = matchSelectionId(runners, { outcomeName, home, away });
  if (!selectionId) return null;
  return { marketId: market.marketId, selectionId };
}

// Разместить ставку. Возвращает { ok, placed, report } или { ok:false, reason }.
export async function placeBet({ home, away, outcomeName, price, size, commence }) {
  const token = await login();
  const ms = await findMarketSelection(token, { home, away, outcomeName, commence });
  if (!ms) return { ok: false, reason: "рынок/исход на Betfair не найден" };
  const body = buildPlaceOrders({ marketId: ms.marketId, selectionId: ms.selectionId, price, size });
  const resp = await rpc(token, "placeOrders/", body);
  return { ok: isPlaced(resp), placed: isPlaced(resp), report: resp };
}

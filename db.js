const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ready = Boolean(SUPABASE_URL && SERVICE_KEY);
if (!ready) {
  console.warn(
    "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY не заданы — данные НЕ сохраняются. " +
    "Задай их в переменных окружения (см. .env.example)."
  );
}

const BASE = ready ? `${SUPABASE_URL}/rest/v1` : null;

function headers(extra = {}) {
  return {
    apikey: SERVICE_KEY,
    Authorization: `Bearer ${SERVICE_KEY}`,
    "Content-Type": "application/json",
    ...extra
  };
}

async function rest(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Supabase ${res.status}: ${text}`);
  }
  return res;
}

export function isDbReady() {
  return ready;
}

// --- Лиды (specto_bot_orders) ---

export async function saveLead({ phone, name, details, platform }) {
  if (!ready) return;
  try {
    await rest("/specto_bot_orders", {
      method: "POST",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({ phone, name, details, platform })
    });
  } catch (err) {
    console.error("saveLead error:", err.message);
  }
}

export async function getOrders(limit = 200) {
  if (!ready) return [];
  try {
    const res = await rest(
      `/specto_bot_orders?select=*&order=created_at.desc&limit=${limit}`,
      { headers: headers() }
    );
    return await res.json();
  } catch (err) {
    console.error("getOrders error:", err.message);
    return [];
  }
}

// --- История диалога (specto_bot_messages) ---

export async function saveMessage(chatId, platform, role, content) {
  if (!ready) return;
  try {
    await rest("/specto_bot_messages", {
      method: "POST",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify({ chat_id: chatId, platform, role, content })
    });
  } catch (err) {
    console.error("saveMessage error:", err.message);
  }
}

export async function getHistory(chatId, limit = 30) {
  if (!ready) return [];
  try {
    const res = await rest(
      `/specto_bot_messages?chat_id=eq.${encodeURIComponent(chatId)}&select=role,content&order=created_at.desc&limit=${limit}`,
      { headers: headers() }
    );
    const data = await res.json();
    return data.reverse(); // вернуть в хронологическом порядке
  } catch (err) {
    console.error("getHistory error:", err.message);
    return [];
  }
}

export async function countMessages(chatId) {
  if (!ready) return 0;
  try {
    const res = await rest(
      `/specto_bot_messages?chat_id=eq.${encodeURIComponent(chatId)}&select=id&limit=1`,
      { headers: headers({ Prefer: "count=exact" }) }
    );
    const range = res.headers.get("content-range");
    if (range && range.includes("/")) {
      const total = parseInt(range.split("/")[1], 10);
      if (!Number.isNaN(total)) return total;
    }
    const data = await res.json();
    return data.length;
  } catch (err) {
    console.error("countMessages error:", err.message);
    return 0;
  }
}

// --- Состояние диалога / фоллоапы (specto_bot_state) ---

export async function upsertState(chatId, row) {
  if (!ready) return;
  try {
    await rest("/specto_bot_state?on_conflict=chat_id", {
      method: "POST",
      headers: headers({ Prefer: "resolution=merge-duplicates,return=minimal" }),
      body: JSON.stringify({ chat_id: chatId, ...row })
    });
  } catch (err) {
    console.error("upsertState error:", err.message);
  }
}

export async function updateState(chatId, fields) {
  if (!ready) return;
  try {
    await rest(`/specto_bot_state?chat_id=eq.${encodeURIComponent(chatId)}`, {
      method: "PATCH",
      headers: headers({ Prefer: "return=minimal" }),
      body: JSON.stringify(fields)
    });
  } catch (err) {
    console.error("updateState error:", err.message);
  }
}

export async function getDueFollowups(nowIso, limit = 50) {
  if (!ready) return [];
  try {
    const path =
      "/specto_bot_state?select=chat_id,platform,followup_step,last_user_at" +
      "&status=eq.active&next_followup_at=not.is.null" +
      `&next_followup_at=lte.${encodeURIComponent(nowIso)}` +
      `&order=next_followup_at.asc&limit=${limit}`;
    const res = await rest(path, { headers: headers() });
    return await res.json();
  } catch (err) {
    console.error("getDueFollowups error:", err.message);
    return [];
  }
}
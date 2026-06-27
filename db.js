import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;
if (SUPABASE_URL && SERVICE_KEY) {
  supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
} else {
  console.warn(
    "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY не заданы — данные  сохраняются. " +
    "адай их в переменных окружения (см. .env.example)."
  );
}

export function isDbReady() {
  return supabase !== null;
}

export async function saveLead({ phone, name, details, platform }) {
  if (!supabase) return;
  const { error } = await supabase
    .from("specto_bot_orders")
    .insert({ phone, name, details, platform });
  if (error) console.error("saveLead error:", error.message);
}

export async function getOrders(limit = 200) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("specto_bot_orders")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("getOrders error:", error.message);
    return [];
  }
  return data;
}

export async function saveMessage(chatId, platform, role, content) {
  if (!supabase) return;
  const { error } = await supabase
    .from("specto_bot_messages")
    .insert({ chat_id: chatId, platform, role, content });
  if (error) console.error("saveMessage error:", error.message);
}

export async function getHistory(chatId, limit = 30) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("specto_bot_messages")
    .select("role, content")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    console.error("getHistory error:", error.message);
    return [];
  }
  return data.reverse();
}

export async function countMessages(chatId) {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from("specto_bot_messages")
    .select("*", { count: "exact", head: true })
    .eq("chat_id", chatId);
  if (error) {
    console.error("countMessages error:", error.message);
    return 0;
  }
  return count || 0;
}

export async function upsertState(chatId, row) {
  if (!supabase) return;
  const { error } = await supabase
    .from("specto_bot_state")
    .upsert({ chat_id: chatId, ...row }, { onConflict: "chat_id" });
  if (error) console.error("upsertState error:", error.message);
}

export async function updateState(chatId, fields) {
  if (!supabase) return;
  const { error } = await supabase
    .from("specto_bot_state")
    .update(fields)
    .eq("chat_id", chatId);
  if (error) console.error("updateState error:", error.message);
}

export async function getDueFollowups(nowIso, limit = 50) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("specto_bot_state")
    .select("chat_id, platform, followup_step, last_user_at")
    .eq("status", "active")
    .not("next_followup_at", "is", null)
    .lte("next_followup_at", nowIso)
    .order("next_followup_at", { ascending: true })
    .limit(limit);
  if (error) {
    console.error("getDueFollowups error:", error.message);
    return [];
  }
  return data;
}
import { supabase } from "../supabaseClient.js";

const TABLE = "specto_bot_messages";
const MAX = 20; // сколько последних сообщений держим в контексте

// Откат на память, если Supabase не настроен
const memory = {};

export async function getHistory(chatId) {
  if (supabase) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("role, content")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false })
      .limit(MAX);
    if (error) {
      console.error("Ошибка чтения истории из Supabase:", error.message);
      return [];
    }
    // вернулись от новых к старым — разворачиваем в хронологический порядок
    return (data || []).reverse();
  }

  return memory[chatId] ? memory[chatId].slice(-MAX) : [];
}

export async function addMessage(chatId, platform, role, content) {
  if (supabase) {
    const { error } = await supabase
      .from(TABLE)
      .insert({ chat_id: chatId, platform, role, content });
    if (error) console.error("Ошибка сохранения сообщения в Supabase:", error.message);
    return;
  }

  if (!memory[chatId]) memory[chatId] = [];
  memory[chatId].push({ role, content });
  if (memory[chatId].length > MAX) memory[chatId] = memory[chatId].slice(-MAX);
}

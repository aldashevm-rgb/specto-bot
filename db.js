import fs from "fs";
import { supabase } from "./supabaseClient.js";

const DB_FILE = "./orders.json";
const TABLE = "specto_bot_orders";

export async function saveOrder(order) {
  if (supabase) {
    const { error } = await supabase.from(TABLE).insert({
      phone: order.phone,
      name: order.name,
      details: order.details,
      platform: order.platform
    });
    if (error) console.error("Ошибка сохранения лида в Supabase:", error.message);
    return;
  }

  // Локальный откат: JSON-файл
  const orders = readFile();
  order.id = Date.now();
  order.created_at = new Date().toISOString();
  orders.push(order);
  fs.writeFileSync(DB_FILE, JSON.stringify(orders, null, 2));
}

export async function getOrders() {
  if (supabase) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) {
      console.error("Ошибка чтения лидов из Supabase:", error.message);
      return [];
    }
    return data;
  }

  return readFile();
}

function readFile() {
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } catch {
    return [];
  }
}

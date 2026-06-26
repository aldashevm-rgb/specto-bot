import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_KEY;

// Клиент создаётся только если заданы URL и service-ключ.
// Если их нет — экспортируем null, и хранилище откатывается на
// локальный режим (файл/память), чтобы бот можно было запустить без Supabase.
export const supabase =
  url && key
    ? createClient(url, key, { auth: { persistSession: false } })
    : null;

if (!supabase) {
  console.warn(
    "⚠️  Supabase не настроен (SUPABASE_URL/SUPABASE_SERVICE_KEY). " +
      "Лиды пишутся в orders.json, история диалогов — в память (теряется при рестарте)."
  );
}

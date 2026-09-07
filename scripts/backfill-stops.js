// Разовый ремонт: проставить status=stopped тем, кто когда-либо просил не
// писать. До фикса «липкого стопа» такие диалоги возвращались в рассылку после
// любого следующего сообщения клиента.
//
// Запускать в среде с SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY (как у бота).
// По умолчанию — ПРОБНЫЙ прогон: показывает, кого остановит, и ничего не пишет.
//
// Примеры:
//   node scripts/backfill-stops.js
//       посмотреть список (в БД ничего не меняется)
//   node scripts/backfill-stops.js --since=2026-01-01T00:00:00Z
//       учитывать только сообщения этого года
//   node scripts/backfill-stops.js --limit=20 --apply
//       реально остановить первые 20 — безопасно проверить на малой партии
//   node scripts/backfill-stops.js --apply
//       остановить всех найденных

import { backfillStops } from "../handlers/backfillStops.js";
import { isDbReady } from "../db.js";

function parseArgs(argv) {
  const opts = { dryRun: true };
  for (const arg of argv) {
    if (arg === "--apply") opts.dryRun = false;
    else if (arg === "--dry-run") opts.dryRun = true;
    else if (arg.startsWith("--since=")) opts.sinceIso = arg.split("=")[1];
    else if (arg.startsWith("--limit=")) opts.limit = parseInt(arg.split("=")[1], 10);
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else console.warn(`Неизвестный аргумент: ${arg}`);
  }
  return opts;
}

const USAGE = `
Использование: node scripts/backfill-stops.js [--apply] [--since=ISO] [--limit=N]

  (без флагов)   пробный прогон: показать, кому будет проставлен стоп
  --apply        записать изменения в specto_bot_state
  --since=ISO    учитывать только сообщения не раньше этого момента
  --limit=N      обработать не больше N чатов
`.trim();

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.help) {
    console.log(USAGE);
    return;
  }

  if (!isDbReady()) {
    console.error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY не заданы — работать не с чем.");
    process.exit(1);
  }

  const { plan, targets, applied, dryRun } = await backfillStops(opts);

  if (targets.length) {
    console.log(`\n--- ${dryRun ? "Будет остановлено" : "Остановлено"} (${targets.length}) ---`);
    for (const t of targets) {
      const when = t.at ? t.at.slice(0, 10) : "дата неизвестна";
      const hint = t.hadState ? "" : " [строки состояния не было]";
      console.log(`${t.chat_id}  ${when}  «${t.text.slice(0, 80)}»${hint}`);
    }
  } else {
    console.log("\nНечего останавливать — все найденные отказы уже учтены.");
  }

  console.log(
    `\nИтог: найдено отказов ${plan.toStop.length + plan.alreadyStopped.length}, ` +
    `уже было stopped ${plan.alreadyStopped.length}, ` +
    `${dryRun ? "к остановке" : "остановлено"} ${dryRun ? targets.length : applied.length}.`
  );

  if (dryRun && targets.length) {
    console.log("\nЭто пробный прогон. Чтобы записать — тот же вызов с --apply.");
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

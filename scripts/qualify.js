// CLI для ИИ-квалификации лидов. Запускать в среде с ANTHROPIC_API_KEY,
// SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY (как у бота).
//
// Примеры:
//   node scripts/qualify.js --dry-run --limit=2
//       прогнать 2 лида без записи в БД (безопасный тест)
//   node scripts/qualify.js --dry-run --chat=77012424492@c.us
//       только конкретный чат, без записи
//   node scripts/qualify.js --limit=50
//       квалифицировать и записать до 50 лидов
//   node scripts/qualify.js --since=2026-06-01T00:00:00Z
//       только чаты с сообщениями после указанного момента

import { processQualifications } from "../handlers/qualify.js";

function parseArgs(argv) {
  const opts = { dryRun: false, restale: false };
  for (const arg of argv) {
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg === "--restale") opts.restale = true;
    else if (arg.startsWith("--limit=")) opts.limit = parseInt(arg.split("=")[1], 10);
    else if (arg.startsWith("--since=")) opts.sinceIso = arg.split("=")[1];
    else if (arg.startsWith("--chat=")) {
      opts.onlyChats = (opts.onlyChats || []).concat(arg.split("=")[1].split(","));
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  console.log("Квалификация лидов:", JSON.stringify({ ...opts, log: undefined }));

  const results = await processQualifications(opts);

  const counts = {};
  for (const r of results) counts[r.status] = (counts[r.status] || 0) + 1;

  console.log("\n--- Итог ---");
  console.log(JSON.stringify(counts, null, 2));

  for (const r of results) {
    if (r.score == null) continue;
    console.log(`\n${r.lead_name || r.lead_id} [${r.chat_id}] — ${r.status}`);
    console.log(`  score: ${r.score}`);
    console.log(`  profile: ${JSON.stringify(r.profile, null, 2).replace(/\n/g, "\n  ")}`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

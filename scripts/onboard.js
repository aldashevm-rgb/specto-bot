// CLI для ИИ-классификации ниши проекта (онбординг). Запускать в среде с
// ANTHROPIC_API_KEY, SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY (как у бота).
//
// Примеры:
//   node scripts/onboard.js --project=stalfed --text "Завод ЖБИ в Астане, продаём плиты и опоры освещения строительным компаниям" --dry-run
//       классифицировать и напечатать профиль БЕЗ записи в БД
//   node scripts/onboard.js --project=stalfed --text "..." --company="Стальфед" --city=Астана --oked=23.61
//       классифицировать и сохранить профиль в projects

import { classifyAndSaveNiche } from "../handlers/onboarding.js";

function parseArgs(argv) {
  const opts = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") opts.dryRun = true;
    else if (arg.startsWith("--project=")) opts.projectId = arg.split("=")[1];
    else if (arg.startsWith("--company=")) opts.companyName = arg.split("=").slice(1).join("=");
    else if (arg.startsWith("--city=")) opts.city = arg.split("=").slice(1).join("=");
    else if (arg.startsWith("--oked=")) opts.oked = arg.split("=").slice(1).join("=");
    else if (arg.startsWith("--text=")) opts.description = arg.split("=").slice(1).join("=");
    // --text "..." (значение отдельным аргументом)
    else if (arg === "--text") opts.description = argv[++i];
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!opts.projectId) {
    console.error("Укажи проект: --project=<id>");
    process.exit(1);
  }
  if (!opts.description || !opts.description.trim()) {
    console.error("Укажи описание бизнеса: --text \"...\"");
    process.exit(1);
  }

  console.log(`Онбординг проекта ${opts.projectId}${opts.dryRun ? " [dry-run]" : ""}...`);

  const result = await classifyAndSaveNiche(opts);
  if (!result) {
    console.error("Не удалось классифицировать нишу.");
    process.exit(1);
  }

  console.log("\n--- Профиль ниши ---");
  console.log(JSON.stringify(result.profile, null, 2));
  console.log(`\nСохранено в БД: ${result.saved ? "да" : "нет"}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

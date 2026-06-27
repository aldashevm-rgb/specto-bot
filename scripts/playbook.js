// CLI для движка плейбуков. Запускать в среде с SUPABASE_URL и
// SUPABASE_SERVICE_ROLE_KEY (как у бота); ANTHROPIC_API_KEY нужен только для
// --customize (докрутка под бизнес через Claude).
//
// Примеры:
//   node scripts/playbook.js --project=stalfed
//       подобрать плейбук по niche_profile и НАПЕЧАТАТЬ (dry-run, ничего не пишем)
//   node scripts/playbook.js --project=stalfed --apply
//       применить: сохранить плейбук в проект и включить базовые автоматизации
//   node scripts/playbook.js --project=stalfed --apply --apply-suggested
//       включить и предлагаемые (suggested) автоматизации тоже

import { getProject, getPlaybooks } from "../db.js";
import { recommendPlaybook, applyPlaybook, customizePlaybook } from "../handlers/playbook.js";

function parseArgs(argv) {
  const opts = { apply: false, applySuggested: false, customize: false };
  for (const arg of argv) {
    if (arg === "--apply") opts.apply = true;
    else if (arg === "--apply-suggested") opts.applySuggested = true;
    else if (arg === "--customize") opts.customize = true;
    else if (arg.startsWith("--project=")) opts.projectId = arg.split("=")[1];
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!opts.projectId) {
    console.error("Укажи проект: --project=<id>");
    process.exit(1);
  }

  const project = await getProject(opts.projectId);
  if (!project) {
    console.error(`Проект ${opts.projectId} не найден.`);
    process.exit(1);
  }
  const profile = project.niche_profile;
  if (!profile) {
    console.error("У проекта нет niche_profile — сначала прогони онбординг (scripts/onboard.js).");
    process.exit(1);
  }

  const playbooks = await getPlaybooks();
  let recommendation = recommendPlaybook(profile, playbooks);
  if (!recommendation) {
    console.error("Подходящий плейбук не найден.");
    process.exit(1);
  }

  if (opts.customize) recommendation = await customizePlaybook(profile, recommendation);

  console.log("\n--- Рекомендованный плейбук ---");
  console.log(JSON.stringify(recommendation, null, 2));

  // По умолчанию dry-run: automation_rules флипаем только с --apply.
  const dryRun = !opts.apply;
  const res = await applyPlaybook({
    projectId: opts.projectId,
    organizationId: project.organization_id,
    recommendation,
    applySuggested: opts.applySuggested,
    dryRun
  });

  console.log(`\n--- ${dryRun ? "План (dry-run)" : "Применено"} ---`);
  console.log(`Включено базовых/применённых: ${res.applied.length}${res.applied.length ? " (" + res.applied.join(", ") + ")" : ""}`);
  console.log(`Предлагаемых (suggested): ${res.suggested.length}${res.suggested.length ? " (" + res.suggested.join(", ") + ")" : ""}`);
  if (dryRun) console.log("\nНичего не записано. Для применения добавь --apply.");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

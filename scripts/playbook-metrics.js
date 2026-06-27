// CLI для аналитики эффективности плейбуков. Запускать в среде с SUPABASE_URL и
// SUPABASE_SERVICE_ROLE_KEY (как у бота). Только чтение вьюх — ничего не меняет.
//
// Примеры:
//   node scripts/playbook-metrics.js
//       печатает метрики по проектам, анализ влияния автоматизаций и сводку
//   node scripts/playbook-metrics.js --min-leads=100
//       снизить порог объёма для рекомендаций promote/demote

import { getPlaybookMetrics, getAutomationImpact } from "../db.js";
import { analyzeImpact, formatPlaybookReport } from "../handlers/playbookMetrics.js";

function parseArgs(argv) {
  const opts = {};
  for (const arg of argv) {
    if (arg.startsWith("--min-leads=")) opts.minLeads = parseInt(arg.split("=")[1], 10);
  }
  return opts;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  const [metrics, impactRows] = await Promise.all([
    getPlaybookMetrics(),
    getAutomationImpact()
  ]);

  const impact = analyzeImpact(impactRows, opts.minLeads ? { minLeads: opts.minLeads } : {});

  console.log("=== playbook_metrics (по проектам) ===");
  console.log(JSON.stringify(metrics, null, 2));

  console.log("\n=== анализ влияния автоматизаций ===");
  console.log(JSON.stringify(impact, null, 2));

  console.log("\n=== сводка ===");
  console.log(formatPlaybookReport(metrics, impact));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

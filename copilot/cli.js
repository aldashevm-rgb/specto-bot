#!/usr/bin/env node
// CLI кодинг-ассистента: интерактивный REPL в терминале (аналог Claude Code / Codex).
// Запуск:  node copilot/cli.js  [рабочий_каталог]
// Одноразовый запрос:  node copilot/cli.js -p "твой запрос"

import readline from "node:readline";
import path from "node:path";
import { runAgent } from "./core/agent.js";
import { mainProvider, strongProvider } from "./core/providers.js";
import { loadEnv } from "./core/loadEnv.js";

loadEnv(); // подхватить .copilot.env из текущей папки до чтения настроек

const args = process.argv.slice(2);
let promptFlag = null;
let rootArg = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "-p" || args[i] === "--prompt") promptFlag = args[++i];
  else rootArg = args[i];
}
const root = path.resolve(rootArg || process.cwd());

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

const ICON = {
  read_file: "📖",
  write_file: "✍️ ",
  edit_file: "✏️ ",
  list_files: "📂",
  search: "🔎",
  run_bash: "⚙️ ",
  remember: "🧠",
  forget: "🗑️ ",
  generate_image: "🎨",
  web_search: "🌐",
  fetch_url: "🔗",
};

function makeHandler() {
  let inThinking = false;
  return (evt) => {
    switch (evt.type) {
      case "thinking":
        if (!inThinking) {
          process.stdout.write(C.dim("\n💭 "));
          inThinking = true;
        }
        process.stdout.write(C.dim(evt.text));
        break;
      case "text":
        if (inThinking) {
          process.stdout.write("\n\n");
          inThinking = false;
        }
        process.stdout.write(evt.text);
        break;
      case "tool_use":
        inThinking = false;
        break;
      case "tool_result": {
        const icon = ICON[evt.name] || "🔧";
        const arg =
          evt.input?.path || evt.input?.pattern || evt.input?.query || evt.input?.command || "";
        const status = evt.ok ? C.green("✓") : C.red("✗");
        process.stdout.write(
          `\n${icon} ${C.cyan(evt.name)} ${C.dim(String(arg).slice(0, 60))} ${status}\n`
        );
        break;
      }
      case "usage":
        break;
      case "turn_end":
        process.stdout.write("\n");
        break;
    }
  };
}

async function ask(history, text, provider) {
  history.push({ role: "user", content: text });
  try {
    await runAgent({ history, root, provider, onEvent: makeHandler() });
  } catch (e) {
    process.stdout.write(C.red("\nОшибка: " + e.message + "\n"));
  }
}

async function main() {
  const history = [];
  const main = mainProvider();
  const strong = strongProvider();

  if (promptFlag) {
    await ask(history, promptFlag, main);
    return;
  }

  console.log(C.bold("\n  Copilot CLI") + C.dim(`  ·  ${main.label}`));
  console.log(C.dim(`  Рабочая область: ${root}`));
  console.log(
    C.dim(
      `  Команды: /hard <запрос> — умнее (${strong.label}), /reset — сброс, /exit — выход.\n`
    )
  );

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: C.cyan("› "),
  });
  rl.prompt();

  rl.on("line", async (line) => {
    const input = line.trim();
    if (!input) return rl.prompt();
    if (input === "/exit" || input === "/quit") return rl.close();
    if (input === "/reset") {
      history.length = 0;
      console.log(C.dim("  История сброшена.\n"));
      return rl.prompt();
    }
    // /hard <запрос> — разово выполнить через сильный провайдер (Claude).
    let provider = main;
    let text = input;
    if (input.startsWith("/hard")) {
      provider = strong;
      text = input.slice(5).trim();
      if (!text) {
        console.log(C.dim("  Использование: /hard <запрос>\n"));
        return rl.prompt();
      }
      console.log(C.yellow(`  → ${strong.label}`));
    }
    rl.pause();
    await ask(history, text, provider);
    console.log();
    rl.resume();
    rl.prompt();
  });

  rl.on("close", () => {
    console.log(C.dim("\n  Пока!\n"));
    process.exit(0);
  });
}

main();

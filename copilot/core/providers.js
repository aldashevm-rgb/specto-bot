// Реестр провайдеров «мозга». Гибридная схема:
//   - основной (по умолчанию Ollama, локально, бесплатно);
//   - сильный (по умолчанию Claude) — для сложных задач / команды /hard.
//
// Одна и та же логика агента работает с любым провайдером.

import { streamMessage } from "./client.js";
import { streamOpenAI } from "./openai.js";

const env = process.env;

// Собирает конфиг провайдера по имени.
export function resolveProvider(name) {
  switch (name) {
    case "anthropic":
    case "claude":
      return {
        kind: "anthropic",
        model: env.COPILOT_MODEL || "claude-opus-5",
        label: `Claude · ${env.COPILOT_MODEL || "claude-opus-5"}`,
      };
    case "deepseek":
      return {
        kind: "openai",
        baseUrl: "https://api.deepseek.com/v1",
        apiKey: env.DEEPSEEK_API_KEY || env.COPILOT_API_KEY,
        model: env.COPILOT_MODEL || "deepseek-chat",
        label: "DeepSeek · deepseek-chat",
      };
    case "groq":
      return {
        kind: "openai",
        baseUrl: "https://api.groq.com/openai/v1",
        apiKey: env.GROQ_API_KEY || env.COPILOT_API_KEY,
        model: env.COPILOT_MODEL || "llama-3.3-70b-versatile",
        label: "Groq",
      };
    case "openrouter":
      return {
        kind: "openai",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: env.OPENROUTER_API_KEY || env.COPILOT_API_KEY,
        model: env.COPILOT_MODEL || "qwen/qwen-2.5-coder-32b-instruct",
        label: "OpenRouter",
      };
    case "openai":
      // Произвольный OpenAI-совместимый эндпоинт (LM Studio, свой сервер и т.д.).
      return {
        kind: "openai",
        baseUrl: env.COPILOT_BASE_URL || "http://localhost:1234/v1",
        apiKey: env.COPILOT_API_KEY || "none",
        model: env.COPILOT_MODEL || "local-model",
        label: `OpenAI-совм. · ${env.COPILOT_MODEL || "local"}`,
      };
    case "ollama":
    default:
      return {
        kind: "openai",
        baseUrl: env.COPILOT_BASE_URL || "http://localhost:11434/v1",
        apiKey: "ollama",
        model: env.COPILOT_MODEL || "qwen2.5-coder:7b",
        label: `Ollama · ${env.COPILOT_MODEL || "qwen2.5-coder:7b"} (локально, бесплатно)`,
      };
  }
}

// Основной провайдер (по умолчанию — локальная Ollama).
export function mainProvider() {
  return resolveProvider(env.COPILOT_PROVIDER || "ollama");
}

// Сильный провайдер для сложного (команда /hard). По умолчанию — Claude.
export function strongProvider() {
  return resolveProvider(env.COPILOT_STRONG || "anthropic");
}

// Единый вызов одного хода — диспетчеризует по kind.
export function streamTurn(cfg, params, onEvent) {
  if (cfg.kind === "anthropic") {
    return streamMessage({ ...params, model: cfg.model }, onEvent);
  }
  return streamOpenAI(cfg, params, onEvent);
}

import { ChatAnthropic } from "@langchain/anthropic";
import { ChatOpenAI } from "@langchain/openai";
import type { GraphKeys } from "./graph";

// OpenRouter uses OpenAI-compatible API (/chat/completions), not Anthropic native (/messages)
// Map Anthropic model IDs to OpenRouter slugs
const OR_MODELS: Record<string, string> = {
  "claude-haiku-4-5-20251001": "anthropic/claude-haiku-4.5",
  "claude-sonnet-4-6":         "anthropic/claude-sonnet-4.6",
  "claude-opus-4-7":           "anthropic/claude-opus-4.7",
};

export function makeLLM(keys: GraphKeys, model: string, maxTokens: number) {
  if (keys.openrouterKey) {
    const orModel = OR_MODELS[model] ?? (model.includes("/") ? model : `anthropic/${model}`);
    return new ChatOpenAI({
      model: orModel,
      apiKey: keys.openrouterKey,
      maxTokens,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
        defaultHeaders: {
          "HTTP-Referer": "https://content-agent-ui.vercel.app",
          "X-Title": "Content Agent",
        },
      },
    });
  }
  if (keys.anthropicKey) {
    return new ChatAnthropic({ model, apiKey: keys.anthropicKey, maxTokens });
  }
  throw new Error("Brak klucza API (Anthropic lub OpenRouter)");
}

import { ChatAnthropic } from "@langchain/anthropic";
import type { GraphKeys } from "./graph";

// OpenRouter uses stable model slugs — map Anthropic IDs to OR equivalents
const OR_MODELS: Record<string, string> = {
  "claude-haiku-4-5-20251001": "anthropic/claude-3.5-haiku-20241022",
  "claude-sonnet-4-6":         "anthropic/claude-3.5-sonnet-20241022",
  "claude-opus-4-7":           "anthropic/claude-3-opus-20240229",
};

export function makeLLM(keys: GraphKeys, model: string, maxTokens: number) {
  if (keys.openrouterKey) {
    const orModel = OR_MODELS[model] ?? (model.includes("/") ? model : `anthropic/${model}`);
    return new ChatAnthropic({
      model: orModel,
      anthropicApiKey: keys.openrouterKey,
      maxTokens,
      clientOptions: {
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

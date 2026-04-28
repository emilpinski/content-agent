import { ChatAnthropic } from "@langchain/anthropic";
import type { GraphKeys } from "./graph";

export function makeLLM(keys: GraphKeys, model: string, maxTokens: number) {
  // Anthropic direct API takes priority — uses correct Claude 4.x model IDs
  if (keys.anthropicKey) {
    return new ChatAnthropic({ model, apiKey: keys.anthropicKey, maxTokens });
  }
  if (keys.openrouterKey) {
    const orModel = model.includes("/") ? model : `anthropic/${model}`;
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
  throw new Error("Brak klucza API (Anthropic lub OpenRouter)");
}

import { ChatAnthropic } from "@langchain/anthropic";
import type { GraphKeys } from "./graph";

export function makeLLM(keys: GraphKeys, model: string, maxTokens: number) {
  if (keys.openrouterKey) {
    return new ChatAnthropic({
      model,
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
  return new ChatAnthropic({ model, apiKey: keys.anthropicKey, maxTokens });
}

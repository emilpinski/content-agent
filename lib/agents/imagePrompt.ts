import { ChatAnthropic } from "@langchain/anthropic";
import type { ContentStateType } from "../state";
import type { GraphKeys } from "../graph";

export function makeImagePromptNode(keys: GraphKeys) {
  return async function imagePromptNode(state: ContentStateType): Promise<Partial<ContentStateType>> {
  if (state.dryRun) {
    return {
      imagePrompt: `Midjourney: A professional, warm-toned photo of a modern Polish service business, clean interior, natural light, shallow depth of field. Topic: ${state.topic}. Style: editorial photography, 4K, --ar 16:9 --style raw`,
    };
  }

  const llm = new ChatAnthropic({
    model: "claude-haiku-4-5-20251001",
    apiKey: keys.anthropicKey,
    maxTokens: 300,
  });

  const prompt = `Na podstawie poniższego artykułu wygeneruj dwa prompty do generatora obrazów AI (Midjourney / Flux):

Temat: ${state.topic}
Fraza SEO: ${state.seoPhrase}

Nagłówek artykułu: ${state.articleMd.split("\n")[0] ?? state.topic}

Wygeneruj:
1. **Prompt miniaturki bloga** — zdjęcie do artykułu (16:9, editorial, profesjonalne)
2. **Prompt social media** — grafika do posta (1:1, bold, przyciągająca uwagę)

Format odpowiedzi (tylko to, nic więcej):
**Miniaturka:** [prompt po angielsku, max 100 słów, zakończony --ar 16:9 --style raw]
**Social media:** [prompt po angielsku, max 80 słów, zakończony --ar 1:1]`;

  const response = await llm.invoke(prompt);
  return { imagePrompt: response.content as string };
  };
}

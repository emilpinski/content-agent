import { ChatAnthropic } from "@langchain/anthropic";
import { tavily } from "@tavily/core";
import type { ContentStateType } from "../state";

const MOCK_RESEARCH = `
## Mock Research Notes (dry-run)

**Key facts:**
- Topic area has strong local search intent
- Users look for practical, actionable advice
- Mobile-first audience (60%+ mobile traffic)

**Statistics:**
- Industry growing 5% YoY in Poland
- 72% of customers read reviews before choosing a local service

**Key points to cover:**
1. How to evaluate quality
2. Price vs. value considerations
3. Location and convenience factors
4. Online reviews and reputation

**Sources:** [mock data — dry run mode]
`;

export async function researcherNode(state: ContentStateType): Promise<Partial<ContentStateType>> {
  if (state.dryRun) {
    return { researchNotes: MOCK_RESEARCH };
  }

  const client = tavily({ apiKey: process.env.TAVILY_API_KEY! });
  const llm = new ChatAnthropic({
    model: "claude-haiku-4-5-20251001",
    apiKey: process.env.ANTHROPIC_API_KEY!,
    maxTokens: 1500,
  });

  const searchQuery = `${state.topic} ${state.seoPhrase} porady wskazówki`;
  const results = await client.search(searchQuery, { maxResults: 6, searchDepth: "basic" });

  const snippets = results.results
    .map((r: { title: string; content: string; url: string }, i: number) =>
      `[${i + 1}] ${r.title}\n${r.content.slice(0, 400)}\nURL: ${r.url}`
    )
    .join("\n\n");

  const prompt = `Jesteś agentem badawczym. Na podstawie poniższych wyników wyszukiwania, wyodrębnij kluczowe fakty, statystyki i punkty do omówienia dla artykułu na temat: "${state.topic}" z frazą SEO: "${state.seoPhrase}".

Wyniki wyszukiwania:
${snippets}

Sporządź zwięzłe notatki badawcze (po polsku) zawierające:
- 5-8 kluczowych faktów/statystyk
- 4-6 głównych punktów do omówienia w artykule
- Ważne terminy i słowa kluczowe
- Perspektywa użytkownika (czego szukają)

Format: markdown, zwięźle.`;

  const response = await llm.invoke(prompt);
  return { researchNotes: response.content as string };
}

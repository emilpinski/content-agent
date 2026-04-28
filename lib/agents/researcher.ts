import { tavily } from "@tavily/core";
import type { ContentStateType } from "../state";
import type { GraphKeys } from "../graph";
import { makeLLM } from "../llm";

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

async function braveSearch(query: string, apiKey: string): Promise<string> {
  const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=6&search_lang=pl`;
  const res = await fetch(url, { headers: { "Accept": "application/json", "X-Subscription-Token": apiKey } });
  if (!res.ok) throw new Error(`Brave Search error: ${res.status}`);
  const data = await res.json() as { web?: { results?: { title: string; description: string; url: string }[] } };
  return (data.web?.results ?? [])
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.description}\nURL: ${r.url}`)
    .join("\n\n");
}

async function tavilySearch(query: string, apiKey: string): Promise<string> {
  const client = tavily({ apiKey });
  const results = await client.search(query, { maxResults: 6, searchDepth: "basic" });
  return results.results
    .map((r: { title: string; content: string; url: string }, i: number) =>
      `[${i + 1}] ${r.title}\n${r.content.slice(0, 400)}\nURL: ${r.url}`)
    .join("\n\n");
}

export function makeResearcherNode(keys: GraphKeys) {
  return async function researcherNode(state: ContentStateType): Promise<Partial<ContentStateType>> {
    if (state.dryRun) return { researchNotes: MOCK_RESEARCH };

    const llm = makeLLM(keys, "claude-haiku-4-5-20251001", 1500);
    const query = `${state.topic} ${state.seoPhrase} porady wskazówki`;

    let snippets = "";
    if (keys.searchKey) {
      snippets = keys.searchProvider === "brave"
        ? await braveSearch(query, keys.searchKey)
        : await tavilySearch(query, keys.searchKey);
    }

    const prompt = `Jesteś agentem badawczym. ${snippets ? `Na podstawie wyników wyszukiwania, wyodrębnij` : `Bazując na swojej wiedzy, przygotuj`} kluczowe fakty i punkty dla artykułu na temat: "${state.topic}" z frazą SEO: "${state.seoPhrase}".

${snippets ? `Wyniki wyszukiwania:\n${snippets}\n\n` : ""}Sporządź zwięzłe notatki (po polsku):
- 5-8 kluczowych faktów/statystyk
- 4-6 głównych punktów do omówienia
- Ważne terminy i słowa kluczowe
- Perspektywa użytkownika

Format: markdown, zwięźle.`;

    const response = await llm.invoke(prompt);
    return { researchNotes: response.content as string };
  };
}

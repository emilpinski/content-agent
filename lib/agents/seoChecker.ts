import { ChatAnthropic } from "@langchain/anthropic";
import type { ContentStateType } from "../state";

export async function seoCheckerNode(state: ContentStateType): Promise<Partial<ContentStateType>> {
  const article = state.articleMd;
  const phrase = state.seoPhrase.toLowerCase();

  // Regex metrics (no LLM needed for counting)
  const wordCount = article.split(/\s+/).filter(Boolean).length;
  const phraseCount = (article.toLowerCase().match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  const density = wordCount > 0 ? ((phraseCount / wordCount) * 100).toFixed(2) : "0";
  const h1Match = article.match(/^# .+/m)?.[0] ?? "Brak H1";
  const h2Count = (article.match(/^## .+/gm) ?? []).length;
  const avgSentenceLen = Math.round(
    article.split(/[.!?]+/).filter((s) => s.trim().length > 10).reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) /
    Math.max(article.split(/[.!?]+/).filter((s) => s.trim().length > 10).length, 1)
  );

  if (state.dryRun) {
    const report = `# Raport SEO (dry-run)

## Metryki
- **Liczba słów:** ${wordCount}
- **Fraza SEO "${state.seoPhrase}":** ${phraseCount}x (gęstość: ${density}%)
- **H1:** ${h1Match}
- **Liczba sekcji H2:** ${h2Count}
- **Średnia długość zdania:** ${avgSentenceLen} słów

## Ocena
- ${phraseCount >= 3 ? "✅" : "⚠️"} Gęstość frazy SEO: ${phraseCount >= 3 ? "OK" : "Za mało — dodaj więcej"}
- ${wordCount >= 1000 ? "✅" : "⚠️"} Długość artykułu: ${wordCount >= 1000 ? "OK" : "Za krótki"}
- ${h2Count >= 3 ? "✅" : "⚠️"} Struktura nagłówków: ${h2Count >= 3 ? "OK" : "Dodaj więcej sekcji H2"}
- ${avgSentenceLen <= 20 ? "✅" : "⚠️"} Czytelność: ${avgSentenceLen <= 20 ? "OK" : "Zdania za długie"}

## Sugestia meta description
"${state.topic} — sprawdź nasze porady dotyczące ${state.seoPhrase}. Praktyczny przewodnik."

*Tryb dry-run — analiza LLM pominięta*`;
    return { seoReportMd: report };
  }

  const llm = new ChatAnthropic({
    model: "claude-haiku-4-5-20251001",
    apiKey: process.env.ANTHROPIC_API_KEY!,
    maxTokens: 1000,
  });

  const prompt = `Jesteś ekspertem SEO. Przeanalizuj poniższy artykuł i napisz raport SEO po polsku.

Fraza kluczowa: "${state.seoPhrase}"
Metryki wyliczone automatycznie:
- Liczba słów: ${wordCount}
- Fraza SEO pojawia się ${phraseCount}x (gęstość: ${density}%)
- H1: ${h1Match}
- Sekcje H2: ${h2Count}
- Średnia długość zdania: ${avgSentenceLen} słów

Artykuł (pierwsze 800 słów):
${article.slice(0, 3000)}

Napisz raport w Markdown zawierający:
1. Podsumowanie metryk (tabela)
2. Ocenę każdego elementu (✅/⚠️/❌)
3. Sugerowany meta title (max 60 znaków)
4. Sugerowany meta description (max 155 znaków)
5. Top 3 poprawki do wprowadzenia

Tylko raport w Markdown, bez wstępu.`;

  const response = await llm.invoke(prompt);
  return { seoReportMd: response.content as string };
}

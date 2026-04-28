import type { ContentStateType } from "../state";
import type { GraphKeys } from "../graph";
import { makeLLM } from "../llm";

export function makeSeoCheckerNode(keys: GraphKeys) {
  return async function seoCheckerNode(state: ContentStateType): Promise<Partial<ContentStateType>> {
    const article = state.articleMd;
    const phrase = state.seoPhrase.toLowerCase();

    const wordCount = article.split(/\s+/).filter(Boolean).length;
    const phraseCount = (article.toLowerCase().match(new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
    const density = wordCount > 0 ? ((phraseCount / wordCount) * 100).toFixed(2) : "0";
    const h1Match = article.match(/^# .+/m)?.[0] ?? "Brak H1";
    const h2Count = (article.match(/^## .+/gm) ?? []).length;
    const avgSentenceLen = Math.round(
      article.split(/[.!?]+/).filter((s) => s.trim().length > 10)
        .reduce((sum, s) => sum + s.trim().split(/\s+/).length, 0) /
      Math.max(article.split(/[.!?]+/).filter((s) => s.trim().length > 10).length, 1)
    );

    if (state.dryRun) {
      return {
        seoReportMd: `# Raport SEO (dry-run)\n\n## Metryki\n- **Słowa:** ${wordCount}\n- **Fraza "${state.seoPhrase}":** ${phraseCount}x (${density}%)\n- **H1:** ${h1Match}\n- **Sekcje H2:** ${h2Count}\n- **Średnia dł. zdania:** ${avgSentenceLen} słów\n\n## Ocena\n- ${phraseCount >= 3 ? "✅" : "⚠️"} Gęstość SEO\n- ${wordCount >= 1000 ? "✅" : "⚠️"} Długość\n- ${h2Count >= 3 ? "✅" : "⚠️"} Struktura H2\n- ${avgSentenceLen <= 20 ? "✅" : "⚠️"} Czytelność\n\n## Sugestia meta description\n"${state.topic} — ${state.seoPhrase}. Praktyczny przewodnik."\n\n*Dry-run — analiza LLM pominięta*`,
      };
    }

    const llm = makeLLM(keys, "claude-haiku-4-5-20251001", 1000);

    const response = await llm.invoke(
      `Jesteś ekspertem SEO. Napisz raport SEO po polsku dla artykułu z frazą "${state.seoPhrase}".

Metryki: słowa=${wordCount}, fraza ${phraseCount}x (${density}%), H1="${h1Match}", H2=${h2Count}, avg zdanie=${avgSentenceLen} słów

Artykuł (fragment):
${article.slice(0, 3000)}

Raport w Markdown:
1. Tabela metryk z oceną ✅/⚠️/❌
2. Meta title (max 60 znaków)
3. Meta description (max 155 znaków)
4. Top 3 poprawki

Tylko raport, bez wstępu.`
    );

    return { seoReportMd: response.content as string };
  };
}

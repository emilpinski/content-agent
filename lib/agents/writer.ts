import { ChatAnthropic } from "@langchain/anthropic";
import type { ContentStateType } from "../state";
import type { GraphKeys } from "../graph";

const MOCK_ARTICLE = `# Jak wybrać najlepszego fryzjera w Twoim mieście

Wybór dobrego fryzjera to decyzja, która ma ogromny wpływ na Twój wygląd i samopoczucie.

## Dlaczego warto poświęcić czas na wybór fryzjera?

Dobry fryzjer to specjalista, który rozumie Twoje potrzeby.

## Na co zwrócić uwagę?

### 1. Opinie i rekomendacje
Zacznij od sprawdzenia opinii w Google Maps i na Facebooku.

### 2. Portfolio prac
Dobry fryzjer powinien mieć portfolio na Instagramie lub stronie salonu.

### 3. Cena vs. jakość
Szukaj balansu między ceną a jakością.

## Podsumowanie

Kieruj się opiniami, portfolio i pierwszym wrażeniem z konsultacji.

*Tryb dry-run — przykładowa treść.*`;

export function makeWriterNode(keys: GraphKeys) {
  return async function writerNode(state: ContentStateType): Promise<Partial<ContentStateType>> {
    if (state.dryRun) return { articleMd: MOCK_ARTICLE };

    const llm = new ChatAnthropic({ model: "claude-sonnet-4-6", apiKey: keys.anthropicKey, maxTokens: 3000 });

    const prompt = `Jesteś ekspertem content marketingu. Napisz artykuł blogowy po polsku na temat: "${state.topic}".

Fraza SEO: "${state.seoPhrase}"

Notatki badawcze:
${state.researchNotes}

Wymagania:
- Długość: 1200-1500 słów
- Fraza SEO "${state.seoPhrase}" w: tytule H1, pierwszym akapicie, ≥2 nagłówkach H2/H3
- Struktura: H1 → wprowadzenie → 4-6 sekcji H2 → podsumowanie z CTA
- Styl: profesjonalny, przystępny, dla polskiego czytelnika
- Format: Markdown

Napisz TYLKO artykuł w Markdown.`;

    const response = await llm.invoke(prompt);
    return { articleMd: response.content as string };
  };
}

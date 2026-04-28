import { ChatAnthropic } from "@langchain/anthropic";
import type { ContentStateType } from "../state";

const MOCK_ARTICLE = `# Jak wybrać najlepszego fryzjera w Twoim mieście

Wybór dobrego fryzjera to decyzja, która ma ogromny wpływ na Twój wygląd i samopoczucie. W tym artykule podpowiemy, na co zwrócić uwagę.

## Dlaczego warto poświęcić czas na wybór fryzjera?

Dobry fryzjer to nie tylko osoba, która tnie włosy. To specjalista, który rozumie Twoje potrzeby i pomaga wyglądać najlepiej jak możesz.

## Na co zwrócić uwagę?

### 1. Opinie i rekomendacje

Zacznij od sprawdzenia opinii w internecie. Google Maps, Facebook i portale branżowe to świetne miejsca do weryfikacji jakości usług.

### 2. Portfolio prac

Dobry fryzjer powinien mieć portfolio swoich prac — czy to na Instagramie, czy na stronie salonu.

### 3. Cena vs. jakość

Najtańszy nie zawsze oznacza najgorszy, a najdroższy niekoniecznie najlepszy. Szukaj balansu między ceną a jakością.

## Podsumowanie

Wybierając fryzjera, kieruj się opiniami, portfolio i pierwszym wrażeniem z konsultacji. Dobry specjalista zawsze znajdzie czas na omówienie Twoich oczekiwań.

*Ten artykuł powstał w trybie dry-run — to przykładowa treść.*`;

export async function writerNode(state: ContentStateType): Promise<Partial<ContentStateType>> {
  if (state.dryRun) {
    return { articleMd: MOCK_ARTICLE };
  }

  const llm = new ChatAnthropic({
    model: "claude-sonnet-4-6",
    apiKey: process.env.ANTHROPIC_API_KEY!,
    maxTokens: 3000,
  });

  const prompt = `Jesteś ekspertem content marketingu. Napisz artykuł blogowy po polsku na temat: "${state.topic}".

Fraza SEO do zoptymalizowania: "${state.seoPhrase}"

Notatki badawcze do wykorzystania:
${state.researchNotes}

Wymagania:
- Długość: 1200-1500 słów
- Fraza SEO "${state.seoPhrase}" musi pojawić się w: tytule (H1), pierwszym akapicie, co najmniej 2 nagłówkach H2/H3
- Struktura: H1 → wprowadzenie → 4-6 sekcji H2 → podsumowanie
- Styl: profesjonalny, ale przystępny. Pisz do polskiego czytelnika.
- Każda sekcja H2 powinna mieć 150-250 słów
- Używaj list punktowanych tam gdzie pasuje
- Zakończ wezwaniem do działania (CTA)
- Format: Markdown

Napisz TYLKO artykuł w Markdown, bez żadnych komentarzy przed ani po.`;

  const response = await llm.invoke(prompt);
  return { articleMd: response.content as string };
}

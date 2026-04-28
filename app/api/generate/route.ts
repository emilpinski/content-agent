import { NextRequest } from "next/server";
import { buildGraph } from "@/lib/graph";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

// In-memory rate limiter (resets on cold start — good enough for serverless)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

function isValidAnthropicKey(k: string) { return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(k); }
function isValidOpenRouterKey(k: string) { return /^sk-or-v1-[A-Za-z0-9]{20,}$/.test(k); }

function send(controller: ReadableStreamDefaultController, encoder: TextEncoder, data: Record<string, unknown>) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!checkRateLimit(ip)) {
    return new Response(JSON.stringify({ error: "Zbyt wiele żądań. Spróbuj za minutę." }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { topic, seoPhrase, dryRun, apiKeys } = await req.json();

  if (!topic?.trim() || !seoPhrase?.trim()) {
    return new Response(JSON.stringify({ error: "topic and seoPhrase required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (topic.length > 300 || seoPhrase.length > 150) {
    return new Response(JSON.stringify({ error: "Temat lub fraza SEO jest za długa." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // User-provided keys take precedence over env vars
  const anthropicKey: string = (apiKeys?.anthropicKey as string) || process.env.ANTHROPIC_API_KEY || "";
  const openrouterKey: string = (apiKeys?.openrouterKey as string) || process.env.OPENROUTER_API_KEY || "";
  const searchProvider: string = (apiKeys?.searchProvider as string) || "brave";
  const searchKey: string = (apiKeys?.braveKey as string) || (apiKeys?.tavilyKey as string) || process.env.BRAVE_SEARCH_KEY || process.env.TAVILY_API_KEY || "";

  // Validate key format only when user-provided (env vars trusted)
  if (apiKeys?.anthropicKey && !isValidAnthropicKey(anthropicKey)) {
    return new Response(JSON.stringify({ error: "Nieprawidłowy format Anthropic API key (oczekiwany: sk-ant-...)" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (apiKeys?.openrouterKey && !isValidOpenRouterKey(openrouterKey)) {
    return new Response(JSON.stringify({ error: "Nieprawidłowy format OpenRouter API key (oczekiwany: sk-or-v1-...)" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!anthropicKey && !openrouterKey) {
    return new Response(JSON.stringify({ error: "Brak klucza API. Dodaj ANTHROPIC_API_KEY lub OPENROUTER_API_KEY w Ustawieniach." }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        send(controller, encoder, { type: "progress", step: "researcher", message: "[Researcher] Szukam informacji..." });

        const pipeline = buildGraph({ anthropicKey, openrouterKey, searchProvider, searchKey });

        // LangGraph streaming — each node completion triggers a stream chunk
        const stream_ = await pipeline.stream(
          { topic, seoPhrase, dryRun: dryRun ?? false },
          { streamMode: "updates" }
        );

        let finalState = { topic, seoPhrase, researchNotes: "", articleMd: "", seoReportMd: "", imagePrompt: "", dryRun: false };

        for await (const update of stream_) {
          const nodeName = Object.keys(update)[0];
          const nodeOutput = (update as Record<string, Record<string, unknown>>)[nodeName] ?? {};

          if (nodeName === "researcher") {
            send(controller, encoder, { type: "progress", step: "writer", message: "[Researcher] Gotowe. Piszę artykuł..." });
            finalState = { ...finalState, ...nodeOutput };
          } else if (nodeName === "writer") {
            send(controller, encoder, { type: "progress", step: "seo", message: "[Writer] Artykuł napisany. Analizuję SEO..." });
            finalState = { ...finalState, ...nodeOutput };
          } else if (nodeName === "seo_checker") {
            send(controller, encoder, { type: "progress", step: "image_prompt", message: "[SEO Checker] Gotowe. Generuję prompt obrazu..." });
            finalState = { ...finalState, ...nodeOutput };
          } else if (nodeName === "image_prompt") {
            send(controller, encoder, { type: "progress", step: "done", message: "[Image Prompt] Gotowe." });
            finalState = { ...finalState, ...nodeOutput };
          }
        }

        // Save to Supabase if configured
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (supabaseUrl && supabaseKey && !dryRun) {
          try {
            const supabase = createClient(supabaseUrl, supabaseKey);
            await supabase.from("content_agent_articles").insert({
              topic,
              seo_phrase: seoPhrase,
              article_md: finalState.articleMd,
              seo_report_md: finalState.seoReportMd,
              image_prompt: finalState.imagePrompt,
            });
          } catch (e) {
            console.error("[Supabase] Save failed:", e);
          }
        }

        send(controller, encoder, {
          type: "result",
          article: finalState.articleMd,
          seoReport: finalState.seoReportMd,
          imagePrompt: finalState.imagePrompt,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        send(controller, encoder, { type: "error", message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}

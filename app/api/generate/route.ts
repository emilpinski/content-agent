import { NextRequest } from "next/server";
import { buildGraph } from "@/lib/graph";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function send(controller: ReadableStreamDefaultController, encoder: TextEncoder, data: Record<string, unknown>) {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
}

export async function POST(req: NextRequest) {
  const { topic, seoPhrase, dryRun } = await req.json();

  if (!topic?.trim() || !seoPhrase?.trim()) {
    return new Response(JSON.stringify({ error: "topic and seoPhrase required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        send(controller, encoder, { type: "progress", step: "researcher", message: "[Researcher] Szukam informacji..." });

        const pipeline = buildGraph();

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
          } catch {
            // Supabase save failure is non-fatal
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

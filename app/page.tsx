"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Step = "idle" | "researcher" | "writer" | "seo" | "image_prompt" | "done" | "error";
type Tab = "article" | "seo" | "image";
type Mode = "single" | "bulk";

interface HistoryItem {
  id: string;
  topic: string;
  seoPhrase: string;
  article: string;
  seoReport: string;
  imagePrompt: string;
  createdAt: string;
}

interface BulkRow { topic: string; seoPhrase: string }
interface BulkResult extends BulkRow { article: string; seoReport: string; imagePrompt: string; status: "pending" | "running" | "done" | "error" }

const PIPELINE_STEPS = [
  { id: "researcher", label: "Researcher", desc: "Szuka informacji (Brave Search)" },
  { id: "writer", label: "Writer", desc: "Pisze artykuł (Sonnet)" },
  { id: "seo", label: "SEO Checker", desc: "Analizuje SEO (Haiku)" },
  { id: "image_prompt", label: "Image Prompt", desc: "Generuje prompt obrazu" },
];

function downloadFile(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/markdown" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function getHistory(): HistoryItem[] {
  try { return JSON.parse(localStorage.getItem("ca-history") || "[]"); } catch { return []; }
}
function saveToHistory(item: HistoryItem) {
  const h = [item, ...getHistory()].slice(0, 5);
  localStorage.setItem("ca-history", JSON.stringify(h));
}

function parseBulkCsv(text: string): BulkRow[] {
  return text.trim().split("\n").slice(1).map((line) => {
    const [topic, seoPhrase] = line.split(",").map((s) => s.trim().replace(/^"|"$/g, ""));
    return { topic, seoPhrase };
  }).filter((r) => r.topic && r.seoPhrase);
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("single");
  const [topic, setTopic] = useState("");
  const [seoPhrase, setSeoPhrase] = useState("");
  const [dryRun, setDryRun] = useState(false);
  const [step, setStep] = useState<Step>("idle");
  const [article, setArticle] = useState("");
  const [seoReport, setSeoReport] = useState("");
  const [imagePrompt, setImagePrompt] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("article");
  const [history, setHistory] = useState<HistoryItem[]>(() => typeof window !== "undefined" ? getHistory() : []);
  const [bulkCsv, setBulkCsv] = useState("");
  const [bulkResults, setBulkResults] = useState<BulkResult[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const runGeneration = useCallback(async (t: string, s: string, dry: boolean): Promise<{ article: string; seoReport: string; imagePrompt: string }> => {
    let apiKeys: Record<string, string> | undefined;
    try {
      const saved = localStorage.getItem("ca-settings");
      if (saved) apiKeys = JSON.parse(saved);
    } catch { /* ignore */ }

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: t, seoPhrase: s, dryRun: dry, apiKeys }),
      signal: abortRef.current?.signal,
    });

    if (!res.ok || !res.body) throw new Error("API error");

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let resultArticle = "", resultSeo = "", resultImage = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        let event: Record<string, unknown>;
        try { event = JSON.parse(line.slice(6)); } catch { continue; }

        if (event.type === "progress") {
          if (event.step === "writer") setStep("writer");
          else if (event.step === "seo") setStep("seo");
          else if (event.step === "image_prompt") setStep("image_prompt");
          else if (event.step === "done") setStep("done");
        } else if (event.type === "result") {
          resultArticle = (event.article as string) ?? "";
          resultSeo = (event.seoReport as string) ?? "";
          resultImage = (event.imagePrompt as string) ?? "";
        } else if (event.type === "error") {
          throw new Error((event.message as string) ?? "Błąd generowania");
        }
      }
    }
    return { article: resultArticle, seoReport: resultSeo, imagePrompt: resultImage };
  }, []);

  const generate = useCallback(async () => {
    if (!topic.trim() || !seoPhrase.trim()) return;
    setStep("researcher"); setArticle(""); setSeoReport(""); setImagePrompt(""); setErrorMsg("");
    abortRef.current = new AbortController();
    try {
      const result = await runGeneration(topic, seoPhrase, dryRun);
      setArticle(result.article);
      setSeoReport(result.seoReport);
      setImagePrompt(result.imagePrompt);
      setStep("done");
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
      const item: HistoryItem = {
        id: Date.now().toString(), topic, seoPhrase,
        article: result.article, seoReport: result.seoReport, imagePrompt: result.imagePrompt,
        createdAt: new Date().toLocaleString("pl-PL"),
      };
      saveToHistory(item);
      setHistory(getHistory());
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== "AbortError") {
        setStep("error");
        setErrorMsg(err.message || "Nieznany błąd");
      }
    }
  }, [topic, seoPhrase, dryRun, runGeneration]);

  const runBulk = useCallback(async () => {
    const rows = parseBulkCsv(bulkCsv);
    if (!rows.length) return;
    const results: BulkResult[] = rows.map((r) => ({ ...r, article: "", seoReport: "", imagePrompt: "", status: "pending" }));
    setBulkResults([...results]);
    setBulkRunning(true);
    abortRef.current = new AbortController();

    for (let i = 0; i < results.length; i++) {
      results[i].status = "running";
      setBulkResults([...results]);
      try {
        const out = await runGeneration(results[i].topic, results[i].seoPhrase, dryRun);
        results[i] = { ...results[i], ...out, status: "done" };
      } catch {
        results[i].status = "error";
      }
      setBulkResults([...results]);
    }
    setBulkRunning(false);
  }, [bulkCsv, dryRun, runGeneration]);

  const isRunning = ["researcher", "writer", "seo", "image_prompt"].includes(step);

  const stepIndex = { idle: -1, researcher: 0, writer: 1, seo: 2, image_prompt: 3, done: 4, error: -1 }[step];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", padding: "1rem 2rem", display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: "linear-gradient(135deg, #6366f1, #8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>✦</div>
        <span style={{ fontWeight: 600, fontSize: "1.1rem" }}>Content Agent</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.5rem", alignItems: "center" }}>
          <Link href="/settings" style={{ color: "var(--muted)", textDecoration: "none", fontSize: "0.8rem", padding: "0.3rem 0.75rem", border: "1px solid var(--border)", borderRadius: 6 }}>⚙ Ustawienia</Link>
          {(["single", "bulk"] as Mode[]).map((m) => (
            <button key={m} onClick={() => setMode(m)} style={{ background: mode === m ? "var(--accent)" : "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "0.3rem 0.75rem", color: "var(--text)", fontSize: "0.8rem", cursor: "pointer", fontWeight: mode === m ? 600 : 400 }}>
              {m === "single" ? "Pojedynczy" : "Bulk (CSV)"}
            </button>
          ))}
        </div>
      </header>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "2rem" }}>
        {mode === "single" ? (
          <div className="content-grid" style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: "1.5rem" }}>
            {/* LEFT */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              {/* Form */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "1.5rem" }}>
                <h2 style={{ margin: "0 0 1.25rem", fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Nowy artykuł</h2>
                {[{ label: "Temat", value: topic, setter: setTopic, placeholder: "Jak wybrać fryzjera w Warszawie" },
                  { label: "Fraza SEO", value: seoPhrase, setter: setSeoPhrase, placeholder: "fryzjer Warszawa" }].map(({ label, value, setter, placeholder }) => (
                  <div key={label}>
                    <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.8rem", color: "var(--muted)" }}>{label}</label>
                    <input value={value} onChange={(e) => setter(e.target.value)} placeholder={placeholder} disabled={isRunning}
                      style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.6rem 0.75rem", color: "var(--text)", fontSize: "0.875rem", marginBottom: "1rem", outline: "none" }} />
                  </div>
                ))}
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "var(--muted)", cursor: "pointer", marginBottom: "1.25rem" }}>
                  <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} disabled={isRunning} style={{ accentColor: "var(--accent)" }} />
                  Dry run (mock, bez API)
                </label>
                <button onClick={generate} disabled={isRunning || !topic.trim() || !seoPhrase.trim()}
                  style={{ width: "100%", background: isRunning || !topic.trim() || !seoPhrase.trim() ? "var(--border)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 8, padding: "0.75rem", color: "#fff", fontWeight: 600, fontSize: "0.9rem", cursor: isRunning || !topic.trim() || !seoPhrase.trim() ? "not-allowed" : "pointer" }}>
                  {isRunning ? "Generuję..." : "Generuj artykuł"}
                </button>
              </div>

              {/* Pipeline */}
              <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "1.25rem" }}>
                <h2 style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Pipeline (4 agenty)</h2>
                {PIPELINE_STEPS.map((s, i) => {
                  const active = stepIndex === i;
                  const done = stepIndex > i;
                  return (
                    <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.55rem 0", borderBottom: i < 3 ? "1px solid var(--border)" : "none", opacity: step === "idle" ? 0.45 : 1 }}>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem", fontWeight: 700, flexShrink: 0, background: done ? "var(--success)" : active ? "var(--accent)" : "var(--border)", color: "#fff", boxShadow: active ? "0 0 14px rgba(99,102,241,0.6)" : "none" }}>
                        {done ? "✓" : i + 1}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.82rem" }}>{s.label}</div>
                        <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{s.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* History */}
              {history.length > 0 && (
                <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "1.25rem" }}>
                  <h2 style={{ margin: "0 0 0.75rem", fontSize: "0.8rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Historia</h2>
                  {history.map((item) => (
                    <div key={item.id} onClick={() => { setArticle(item.article); setSeoReport(item.seoReport); setImagePrompt(item.imagePrompt); setStep("done"); }}
                      style={{ padding: "0.5rem", borderRadius: 6, cursor: "pointer", marginBottom: "0.2rem", borderBottom: "1px solid var(--border)" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--border)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      <div style={{ fontSize: "0.82rem", fontWeight: 500 }}>{item.topic.slice(0, 38)}{item.topic.length > 38 ? "…" : ""}</div>
                      <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>{item.seoPhrase} · {item.createdAt}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RIGHT */}
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, display: "flex", flexDirection: "column", minHeight: 600 }}>
              {step === "idle" && !article && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "var(--muted)", gap: "0.75rem" }}>
                  <div style={{ fontSize: "3rem", opacity: 0.2 }}>✦</div>
                  <div style={{ fontSize: "0.9rem" }}>Wpisz temat i frazę SEO, kliknij Generuj</div>
                </div>
              )}

              {isRunning && (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "1rem" }}>
                  <div style={{ fontSize: "2rem", animation: "spin 2s linear infinite" }}>✦</div>
                  <div style={{ fontSize: "0.9rem", color: "var(--muted)" }}>
                    {step === "researcher" && "Researcher szuka informacji..."}
                    {step === "writer" && "Writer pisze artykuł..."}
                    {step === "seo" && "SEO Checker analizuje..."}
                    {step === "image_prompt" && "Image Prompt generuje..."}
                  </div>
                </div>
              )}

              {step === "error" && !article && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "0.75rem", padding: "2rem" }}>
                  <div style={{ fontSize: "2rem" }}>⚠️</div>
                  <div style={{ fontWeight: 600, color: "#f87171" }}>Błąd generowania</div>
                  <div style={{ fontSize: "0.82rem", color: "var(--muted)", textAlign: "center", maxWidth: 320, wordBreak: "break-word" }}>{errorMsg || "Sprawdź klucze API w Ustawieniach"}</div>
                  <button onClick={() => setStep("idle")} style={{ marginTop: "0.5rem", background: "var(--border)", border: "none", borderRadius: 6, padding: "0.4rem 1rem", color: "var(--text)", fontSize: "0.8rem", cursor: "pointer" }}>Spróbuj ponownie</button>
                </div>
              )}

              {(step === "done" || step === "error") && article && (
                <div ref={resultRef}>
                  <div style={{ display: "flex", borderBottom: "1px solid var(--border)", padding: "0 1.5rem", alignItems: "center" }}>
                    {(["article", "seo", "image"] as Tab[]).map((tab) => (
                      <button key={tab} onClick={() => setActiveTab(tab)}
                        style={{ background: "none", border: "none", padding: "0.875rem 1rem", cursor: "pointer", fontSize: "0.85rem", fontWeight: activeTab === tab ? 600 : 400, color: activeTab === tab ? "var(--text)" : "var(--muted)", borderBottom: activeTab === tab ? "2px solid var(--accent)" : "2px solid transparent", marginBottom: -1 }}>
                        {tab === "article" ? "Artykuł" : tab === "seo" ? "Raport SEO" : "Image Prompt"}
                      </button>
                    ))}
                    <div style={{ marginLeft: "auto", display: "flex", gap: "0.4rem" }}>
                      <button onClick={() => downloadFile(article, "artykul.md")} style={{ background: "var(--border)", border: "none", borderRadius: 6, padding: "0.35rem 0.65rem", color: "var(--text)", fontSize: "0.75rem", cursor: "pointer" }}>↓ Artykuł</button>
                      <button onClick={() => downloadFile(seoReport, "seo.md")} style={{ background: "var(--border)", border: "none", borderRadius: 6, padding: "0.35rem 0.65rem", color: "var(--text)", fontSize: "0.75rem", cursor: "pointer" }}>↓ SEO</button>
                    </div>
                  </div>
                  <div style={{ flex: 1, padding: "1.5rem", overflowY: "auto", maxHeight: 680 }} className="prose-dark">
                    {activeTab === "image" ? (
                      <div>
                        <h3 style={{ color: "#f1f5f9", marginTop: 0 }}>Prompty do generatora obrazów</h3>
                        <pre style={{ background: "var(--bg)", borderRadius: 8, padding: "1rem", whiteSpace: "pre-wrap", fontSize: "0.85rem", color: "#94a3b8", lineHeight: 1.6 }}>{imagePrompt}</pre>
                        <button onClick={() => navigator.clipboard.writeText(imagePrompt)} style={{ marginTop: "0.75rem", background: "var(--accent)", border: "none", borderRadius: 6, padding: "0.4rem 0.9rem", color: "#fff", fontSize: "0.8rem", cursor: "pointer" }}>Kopiuj prompt</button>
                      </div>
                    ) : (
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {activeTab === "article" ? article : seoReport}
                      </ReactMarkdown>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* BULK MODE */
          <div style={{ maxWidth: 800, margin: "0 auto" }}>
            <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "1.5rem", marginBottom: "1rem" }}>
              <h2 style={{ margin: "0 0 0.75rem", fontSize: "0.9rem", fontWeight: 600 }}>Bulk generowanie (CSV)</h2>
              <p style={{ fontSize: "0.82rem", color: "var(--muted)", margin: "0 0 1rem" }}>Format CSV: nagłówek <code style={{ background: "var(--bg)", padding: "1px 5px", borderRadius: 4 }}>topic,seoPhrase</code>, następnie wiersze.</p>
              <textarea value={bulkCsv} onChange={(e) => setBulkCsv(e.target.value)} placeholder={"topic,seoPhrase\nJak wybrać fryzjera w Warszawie,fryzjer Warszawa\nNajlepsze restauracje w Krakowie,restauracje Kraków"} rows={6} style={{ width: "100%", background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.75rem", color: "var(--text)", fontSize: "0.85rem", fontFamily: "monospace", resize: "vertical", outline: "none" }} />
              <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem", alignItems: "center" }}>
                <button onClick={runBulk} disabled={bulkRunning || !bulkCsv.trim()} style={{ background: bulkRunning || !bulkCsv.trim() ? "var(--border)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 8, padding: "0.65rem 1.5rem", color: "#fff", fontWeight: 600, fontSize: "0.875rem", cursor: bulkRunning || !bulkCsv.trim() ? "not-allowed" : "pointer" }}>
                  {bulkRunning ? "Generuję..." : `Generuj ${parseBulkCsv(bulkCsv).length || 0} artykułów`}
                </button>
                <label style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem", color: "var(--muted)", cursor: "pointer" }}>
                  <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} style={{ accentColor: "var(--accent)" }} /> Dry run
                </label>
              </div>
            </div>

            {bulkResults.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                {bulkResults.map((r, i) => (
                  <div key={i} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: "1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", flexShrink: 0, background: r.status === "done" ? "var(--success)" : r.status === "error" ? "var(--error)" : r.status === "running" ? "var(--accent)" : "var(--border)", color: "#fff" }}>
                      {r.status === "done" ? "✓" : r.status === "error" ? "✗" : r.status === "running" ? "…" : i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 500, fontSize: "0.875rem" }}>{r.topic}</div>
                      <div style={{ fontSize: "0.75rem", color: "var(--muted)" }}>{r.seoPhrase}</div>
                    </div>
                    {r.status === "done" && (
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button onClick={() => downloadFile(r.article, `artykul-${i + 1}.md`)} style={{ background: "var(--border)", border: "none", borderRadius: 6, padding: "0.3rem 0.6rem", color: "var(--text)", fontSize: "0.75rem", cursor: "pointer" }}>↓ Art</button>
                        <button onClick={() => downloadFile(r.seoReport, `seo-${i + 1}.md`)} style={{ background: "var(--border)", border: "none", borderRadius: 6, padding: "0.3rem 0.6rem", color: "var(--text)", fontSize: "0.75rem", cursor: "pointer" }}>↓ SEO</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        input:focus, textarea:focus { border-color: var(--accent) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }
        * { scrollbar-width: thin; scrollbar-color: var(--border) transparent; }
        @media (max-width: 768px) {
          .content-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}

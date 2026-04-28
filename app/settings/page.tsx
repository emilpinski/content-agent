"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Settings {
  anthropicKey: string;
  openrouterKey: string;
  searchProvider: "tavily" | "brave";
  tavilyKey: string;
  braveKey: string;
}

const DEFAULT: Settings = { anthropicKey: "", openrouterKey: "", searchProvider: "tavily", tavilyKey: "", braveKey: "" };
const STORAGE_KEY = "ca-settings";

function loadSettings(): Settings {
  try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") }; }
  catch { return DEFAULT; }
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings>(DEFAULT);
  const [saved, setSaved] = useState(false);
  const [show, setShow] = useState<Record<string, boolean>>({});

  useEffect(() => { setSettings(loadSettings()); }, []);

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function toggle(key: string) { setShow((s) => ({ ...s, [key]: !s[key] })); }

  const input = (label: string, field: keyof Settings, placeholder: string, hint: string) => (
    <div style={{ marginBottom: "1.25rem" }}>
      <label style={{ display: "block", marginBottom: "0.4rem", fontSize: "0.82rem", color: "var(--muted)" }}>{label}</label>
      <div style={{ display: "flex", gap: "0.5rem" }}>
        <input
          type={show[field] ? "text" : "password"}
          value={settings[field] as string}
          onChange={(e) => setSettings((s) => ({ ...s, [field]: e.target.value }))}
          placeholder={placeholder}
          style={{ flex: 1, background: "var(--bg)", border: "1px solid var(--border)", borderRadius: 8, padding: "0.6rem 0.75rem", color: "var(--text)", fontSize: "0.875rem", outline: "none", fontFamily: "monospace" }}
        />
        <button onClick={() => toggle(field)} style={{ background: "var(--border)", border: "none", borderRadius: 8, padding: "0 0.75rem", color: "var(--muted)", cursor: "pointer", fontSize: "0.8rem" }}>
          {show[field] ? "Ukryj" : "Pokaż"}
        </button>
      </div>
      <div style={{ fontSize: "0.75rem", color: "var(--muted)", marginTop: "0.3rem" }}>{hint}</div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <header style={{ borderBottom: "1px solid var(--border)", padding: "1rem 2rem", display: "flex", alignItems: "center", gap: "1rem" }}>
        <Link href="/" style={{ color: "var(--muted)", textDecoration: "none", fontSize: "0.85rem" }}>← Wróć</Link>
        <div style={{ width: 1, height: 16, background: "var(--border)" }} />
        <span style={{ fontWeight: 600 }}>Ustawienia API</span>
      </header>

      <div style={{ maxWidth: 560, margin: "2rem auto", padding: "0 1.5rem" }}>
        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "1.75rem" }}>

          <h2 style={{ margin: "0 0 1.5rem", fontSize: "0.85rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Klucze API
          </h2>

          {input("OpenRouter API Key (zalecany)", "openrouterKey", "sk-or-v1-...", "Pobierz z openrouter.ai — dostęp do wielu modeli")}
          {input("Anthropic API Key (alternatywnie)", "anthropicKey", "sk-ant-...", "Bezpośredni dostęp do modeli Anthropic — console.anthropic.com")}

          <div style={{ marginBottom: "1.5rem" }}>
            <label style={{ display: "block", marginBottom: "0.6rem", fontSize: "0.82rem", color: "var(--muted)" }}>
              Dostawca wyszukiwania (Researcher agent)
            </label>
            <div style={{ display: "flex", gap: "0.75rem" }}>
              {(["brave", "tavily"] as const).map((p) => (
                <button key={p} onClick={() => setSettings((s) => ({ ...s, searchProvider: p }))}
                  style={{ flex: 1, padding: "0.65rem", borderRadius: 8, border: `1px solid ${settings.searchProvider === p ? "var(--accent)" : "var(--border)"}`, background: settings.searchProvider === p ? "rgba(99,102,241,0.1)" : "var(--bg)", color: settings.searchProvider === p ? "var(--text)" : "var(--muted)", cursor: "pointer", fontWeight: settings.searchProvider === p ? 600 : 400, fontSize: "0.875rem" }}>
                  {p === "brave" ? "Brave Search" : "Tavily"}
                  {p === "brave" && <span style={{ display: "block", fontSize: "0.7rem", color: "var(--success)", marginTop: 2 }}>2000 req/mies. free</span>}
                  {p === "tavily" && <span style={{ display: "block", fontSize: "0.7rem", color: "var(--muted)", marginTop: 2 }}>1000 req/mies. free</span>}
                </button>
              ))}
            </div>
          </div>

          {settings.searchProvider === "brave"
            ? input("Brave Search API Key", "braveKey", "BSA...", "Pobierz z brave.com/search/api (free: 2000 req/mies.)")
            : input("Tavily API Key", "tavilyKey", "tvly-...", "Pobierz z tavily.com (free: 1000 req/mies.)")}

          <div style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8, padding: "0.75rem 1rem", marginBottom: "1.5rem", fontSize: "0.8rem", color: "#a5b4fc" }}>
            Klucze są zapisywane lokalnie w Twojej przeglądarce (localStorage) i przesyłane do serwera tylko podczas generowania. Serwer ich nie przechowuje. Klucze są dostępne wyłącznie dla tej domeny.
          </div>

          <button onClick={save} style={{ width: "100%", background: saved ? "var(--success)" : "linear-gradient(135deg, #6366f1, #8b5cf6)", border: "none", borderRadius: 8, padding: "0.75rem", color: "#fff", fontWeight: 600, fontSize: "0.9rem", cursor: "pointer", transition: "background 0.3s" }}>
            {saved ? "✓ Zapisano" : "Zapisz ustawienia"}
          </button>
        </div>

        <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 12, padding: "1.5rem", marginTop: "1rem" }}>
          <h3 style={{ margin: "0 0 0.75rem", fontSize: "0.82rem", fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Jak zacząć</h3>
          <ol style={{ margin: 0, paddingLeft: "1.25rem", fontSize: "0.82rem", color: "#94a3b8", lineHeight: 2 }}>
            <li>Pobierz OpenRouter key z <strong style={{ color: "var(--text)" }}>openrouter.ai</strong> (lub Anthropic key z console.anthropic.com)</li>
            <li>Zarejestruj się na <strong style={{ color: "var(--text)" }}>brave.com/search/api</strong> (lub tavily.com)</li>
            <li>Wklej klucze powyżej i zapisz</li>
            <li>Wróć na stronę główną i generuj artykuły</li>
            <li>Klucze są <strong style={{ color: "var(--text)" }}>automatycznie usuwane</strong> po każdym generowaniu</li>
          </ol>
        </div>
      </div>

      <style>{`input:focus { border-color: var(--accent) !important; box-shadow: 0 0 0 3px rgba(99,102,241,0.15); }`}</style>
    </div>
  );
}

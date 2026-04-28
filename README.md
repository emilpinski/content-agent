# Content Agent UI

AI-powered content generation pipeline built with LangGraph. Generates SEO-optimized Polish articles using a 4-agent workflow.

**Live:** [content-agent-ui.vercel.app](https://content-agent-ui.vercel.app)

---

## How it works

Enter a topic and SEO phrase — the pipeline runs 4 agents in sequence:

1. **Researcher** — searches the web (Tavily or Brave Search) and extracts key facts
2. **Writer** — writes a full Polish article (1000–1500+ words) based on research
3. **SEO Checker** — analyzes the article and generates meta title, meta description, keyword density report
4. **Image Prompt** — generates a detailed image prompt for a thumbnail/social graphic

Progress is streamed in real time via SSE.

---

## Setup

### 1. API Keys

You need at least one LLM provider and one search provider:

| Key | Where to get | Required |
|-----|-------------|---------|
| OpenRouter API Key | [openrouter.ai](https://openrouter.ai) | Recommended |
| Anthropic API Key | [console.anthropic.com](https://console.anthropic.com) | Alternative |
| Tavily API Key | [tavily.com](https://tavily.com) — 1000 req/mo free | Recommended |
| Brave Search API Key | [brave.com/search/api](https://brave.com/search/api) — 2000 req/mo free | Alternative |

### 2. Enter keys in the app

Go to ⚙ Settings → paste your keys → Save. Keys are stored in your browser (localStorage) and sent to the server only during generation. The server does not store them.

### 3. Generate

Enter topic + SEO phrase → click Generate → wait ~60–90s for the full pipeline to complete.

---

## Models used (via OpenRouter)

| Agent | Model |
|-------|-------|
| Researcher | claude-haiku-4.5 |
| Writer | claude-sonnet-4.6 |
| SEO Checker | claude-haiku-4.5 |
| Image Prompt | claude-haiku-4.5 |

---

## Tech stack

- **Next.js 15** (App Router, Node.js runtime)
- **LangGraph** — agent orchestration
- **LangChain OpenAI** — OpenRouter-compatible LLM client
- **Tavily / Brave Search** — web research
- **Supabase** (optional) — article history storage
- **Vercel** — hosting (max 300s function timeout)

---

## Self-hosting

```bash
git clone https://github.com/emilpinski/content-agent
cd content-agent-ui
npm install
cp .env.example .env.local
# Fill in keys in .env.local (optional — users can provide their own via UI)
npm run dev
```

### Environment variables (all optional — users can provide via UI)

```
ANTHROPIC_API_KEY=sk-ant-...
OPENROUTER_API_KEY=sk-or-v1-...
TAVILY_API_KEY=tvly-...
BRAVE_SEARCH_KEY=BSA...
NEXT_PUBLIC_SUPABASE_URL=https://...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## Rate limiting

5 requests per minute per IP (in-memory, resets on cold start).

---

## Security

- API keys validated by format before use (`sk-ant-*`, `sk-or-v1-*`)
- Input length limited (topic: 300 chars, SEO phrase: 150 chars)
- CSP headers configured
- No key logging on server side

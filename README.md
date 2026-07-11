# Research Copilot

A focused research-paper assistant that does the things a general chatbot can't: it reads the **full text** of a paper (not just the abstract), keeps a **searchable library**, answers questions with **section-level citations**, scores each summary for **faithfulness** (a "does it hallucinate?" trust score), and lets you **ask across every paper you've saved**.

Bring your own LLM key — Anthropic, OpenAI, Gemini, or Groq — chosen in the UI and never stored.

**Live:** https://research-copilot-steel.vercel.app

---

## Why not just use ChatGPT / Claude?

| | General chat | Research Copilot |
|---|---|---|
| Reads | what you paste (often the abstract) | the **full PDF** from arXiv / open-access sources |
| Memory | forgets between chats | **persistent library** across sessions |
| Citations | "trust me" | every claim links to **§section, page** |
| Hallucination check | none | **trust score** flags unsupported claims |
| Across many papers | one at a time | **ask across your whole library** + compare |

## Features

- **Full-text ingestion** — fetches metadata from arXiv or Semantic Scholar; pulls the PDF when available, falls back to abstract-only (clearly badged).
- **Grounded summaries** — structured 7-section summary generated from the full text.
- **Trust score** — a second model pass verifies each summary claim against its sources and reports the fraction supported + the unsupported claims.
- **Cited Q&A** — retrieval-augmented answers where each statement carries a `[Cn] · paper · §section · page` citation.
- **Ask across your library** — one question, answered from every paper you've indexed.
- **Compare vs. references** — pulls a paper's top references and builds an approach/finding comparison table.
- **Metrics page** — papers indexed, summaries, average trust score, latency by action.

## Architecture

```
Next.js (App Router) on Vercel
├─ Single-page BYOK UI (provider/model/key, kept in memory)
├─ API routes (serverless)
│   ├─ /api/ingest     fetch meta + full text → chunk → embed → store
│   ├─ /api/summarize  full-text summary + faithfulness trust score (cached)
│   ├─ /api/ask        RAG retrieval → cited answer (paper- or library-scoped)
│   ├─ /api/compare    Semantic Scholar references → comparison table
│   ├─ /api/papers     library list
│   └─ /api/metrics    observability aggregates
├─ Vercel AI SDK → Anthropic / OpenAI / Gemini / Groq (BYOK)
├─ Google Gemini text-embedding-004 (768-dim, BYOK, free tier)
└─ Neon Postgres + pgvector (papers, chunks, summaries, events)
```

Design rationale lives in [`docs/architecture.md`](docs/architecture.md).

## Tech stack

Next.js 16 · TypeScript · Vercel AI SDK · Anthropic/OpenAI/Google/Groq · Neon Postgres + pgvector · Drizzle ORM · Vitest · Tailwind. Deployed on Vercel (git-connected: push to `main` → production).

## Local setup

```bash
npm install
```

Create `.env.local`:

```
DATABASE_URL=postgres://…            # Neon connection string (only server secret)
```

> LLM and embedding keys are NOT env vars — they're entered in the UI per session (BYOK).

Provision the database (Neon → enable pgvector, then run migrations):

```bash
# In the Neon SQL editor once:  CREATE EXTENSION IF NOT EXISTS vector;
npm run db:migrate     # applies drizzle/0000_*.sql
```

Run it:

```bash
npm run dev            # http://localhost:3000
npm test               # unit tests
```

Using the app: pick an LLM provider + model and paste that provider's key, paste a **Gemini key** for embeddings (free tier), then **Add to library** with an arXiv id (e.g. `1706.03762`), a DOI (`DOI:10.1038/…`), or a Semantic Scholar id. Click a paper to summarize; ask questions per paper or across the library.

## Deploy (Vercel)

The repo is git-connected to a Vercel project — pushing to `main` deploys to production. Set `DATABASE_URL` in the Vercel project's environment variables. No other server secrets (BYOK).

## Roadmap

- Streamed answers alongside the trust/citation payload
- Optional per-user auth + private libraries
- Background ingestion queue for very large PDFs
- Citation-graph exploration beyond direct references

## Legacy

This started as a single Jupyter notebook that summarized paper **abstracts** (preserved in [`docs/legacy/`](docs/legacy/)). It was rebuilt into this full-text, grounded, multi-paper app.

# Architecture Decision Record

Short rationale for the choices that shape Research Copilot. One decision per section: what and why, plus the tradeoff.

## Why this exists (the thesis)
General chat assistants summarize a paper you paste in, but they read one paper, keep no memory, and can't show you which sentence a claim came from. This tool wins on exactly those gaps: it reads the **full text** (not just the abstract), keeps a **persistent library**, answers with **section-level citations**, scores its own summaries for **faithfulness**, and searches **across everything you've saved**.

## Vercel-only, Neon Postgres + pgvector
Constraint: deploy on Vercel; no Supabase/Render/Fly. Chosen datastore is **Neon** (Vercel Marketplace) with the `pgvector` extension, so papers, chunks, embeddings, summaries, and the events log all live in **one** database with one bill and one migration history. Tradeoff: a dedicated vector DB (Pinecone/Weaviate) would scale retrieval further, but at this size a single Postgres with an HNSW index is simpler and cheaper. Upgrade path: move `chunks` to a dedicated index only if recall/latency at scale demands it.

## BYOK in the browser, nothing stored
The LLM is bring-your-own-key: provider (Anthropic/OpenAI/Gemini/Groq) + model + key are entered in the UI, held in React state only, sent per request, and **never persisted or logged**. The server builds the provider client transiently and an allowlist guard (`isValidSelection`) rejects unknown provider/model pairs. Tradeoff: keys transit our serverless function (standard for BYOK, over HTTPS) and are lost on refresh — the price of storing nothing.

## Embeddings pinned to one model
pgvector columns are fixed-dimension, so all vectors must come from one embedding model to be comparable. Embeddings are standardized on **Google Gemini `gemini-embedding-001`**, pinned to **768-dim** via `outputDimensionality` (its native dimension is 3072; it's a Matryoshka model, so truncation is safe), also BYOK — chosen because it has a genuinely free tier (of the four providers, only OpenAI and Gemini offer embeddings, and Gemini is free). Note: `text-embedding-004` was retired, which is why the model id is `gemini-embedding-001`. Consequence: the library/RAG features need a Gemini key even if the LLM is Groq/Anthropic — though if the LLM is also Gemini, one key covers both. Free-tier consequence: ~1,000 embedding requests/day, so full-text adds are budget-limited (see the README's Limitations). Upgrade path: to change models, change the constants in `lib/models.ts`, migrate the `vector(N)` column, and re-embed.

## JSON responses, not streaming (Phase 2 routes)
`/api/summarize` and `/api/ask` return JSON rather than token streams, so a summary can carry its **trust score + unsupported-claim list** and an answer can carry its **citations** in one round trip. Tradeoff: no token-by-token typing effect; acceptable because the differentiating data (trust, citations) is only complete at the end anyway.

## Faithfulness trust score
After generating a summary, a second model pass checks each claim against the retrieved source chunks and returns a 0–1 score (fraction supported) plus the unsupported claims. This is the honest answer to "does it hallucinate?" — something chat can't show. The pure aggregation (`aggregateVerdicts`) is unit-tested; the LLM judgement is not (non-deterministic).

## No background queue (yet)
Ingest + summarize run inline within the function's `maxDuration`. A 20-page paper fits comfortably; streaming/JSON keeps requests bounded. Tradeoff: a very large PDF could approach the limit. The 10× escape hatch — a queue (e.g. Vercel Cron + a jobs table, or a durable workflow) — is deliberately deferred until a real paper times out, rather than built speculatively.

## Lazy database client
`lib/db/client.ts` reads `DATABASE_URL` on first query, not at import, via a Proxy. This lets `next build` evaluate route modules and BYOK-only requests run without a database key present, and keeps the only server secret to exactly one variable.

## Full-text vs. abstract honesty
arXiv exposes a PDF; Semantic-Scholar-only papers often don't (only some have an `openAccessPdf`). When full text is unavailable the paper is ingested abstract-only and flagged `fullTextAvailable = false`, surfaced as an "abstract only" badge. The system never implies it read more than it did.

# Research Copilot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-notebook "abstract summarizer" into a deployed Next.js web app that ingests the *full text* of research papers, produces grounded/cited summaries with a hallucination "trust score", answers questions across a saved library, and compares papers via their citation graph.

**Architecture:** Next.js (App Router) on Vercel. Serverless route handlers fetch paper metadata + full text (arXiv PDF / Semantic Scholar `openAccessPdf`, abstract fallback), chunk + embed into Neon Postgres with `pgvector`, and call Claude via the Vercel AI SDK for streamed generation. RAG retrieval grounds every summary and answer; a second Claude pass scores each summary's claims against its source chunks. One Postgres database holds papers, chunks, summaries, and an events log for the metrics page.

**Tech Stack:** Next.js 15 (App Router, TypeScript), Vercel AI SDK (`ai`, `@ai-sdk/anthropic`), Anthropic Claude (`claude-sonnet-5` for generation, `claude-haiku-4-5-20251001` for cheap checks), Voyage AI embeddings (`voyage-3.5`, 1024-dim), Neon Postgres + `pgvector`, Drizzle ORM + drizzle-kit migrations, `unpdf` for PDF text, shadcn/ui + Tailwind, Vitest for unit tests.

## Global Constraints

- **Deploy target:** Vercel only. No Supabase, no Render, no Fly.io. Database = Neon Postgres (Vercel Marketplace). Cache/rate-limit (if ever added) = Upstash Redis (Vercel Marketplace). Not in scope now.
- **Node driver:** use `@neondatabase/serverless` (HTTP driver) — NOT `pg`. Vercel serverless functions must not hold long-lived TCP pools.
- **Secrets:** `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `DATABASE_URL` only. All via env vars. Never commit. `.env.example` documents them. App throws on startup if any is missing.
- **Model IDs (verify current at build via the claude-api skill before first call):** generation `claude-sonnet-5`; cheap checks `claude-haiku-4-5-20251001`. Embeddings: Voyage `voyage-3.5`, dimension **1024** (the `vector(1024)` column depends on this — if you change the model, change the column).
- **Full-text honesty:** never claim a paper was fully read when only the abstract was available. Every paper row carries `full_text_available: boolean`; the UI shows an "abstract-only" badge when false.
- **Function duration:** set `maxDuration` on ingest/summarize/compare routes. Stream long generations. No background queue unless a real paper times out (documented in the ADR as the 10× escape hatch).
- **TDD:** pure logic (fetchers, chunker, faithfulness aggregation, citation parsing) is unit-tested with Vitest before implementation. Route handlers get one smoke test each with mocked deps. UI is verified by running it, not unit-tested.
- **Commits:** one per task minimum. Conventional commit messages.

---

## File Structure

```
app/
  layout.tsx, page.tsx            # library + input landing
  paper/[id]/page.tsx             # summary + chat view
  metrics/page.tsx                # observability view
  api/
    ingest/route.ts
    summarize/route.ts
    ask/route.ts
    compare/route.ts
    papers/route.ts
    metrics/route.ts
lib/
  env.ts                          # validated env, throws on missing
  db/
    client.ts                     # neon + drizzle
    schema.ts                     # papers, chunks, summaries, events
  sources/
    arxiv.ts                      # fetch metadata + pdf url
    semanticscholar.ts            # fetch metadata + openAccessPdf
    resolve.ts                    # id/url/DOI -> {source, id}
  ingest/
    pdf.ts                        # unpdf -> per-page text
    chunk.ts                      # text -> chunks with section+page
    embed.ts                      # voyage embeddings
    pipeline.ts                   # orchestrates fetch->chunk->embed->store
  rag/
    retrieve.ts                   # vector search
    summarize.ts                  # map-reduce structured summary
    faithfulness.ts               # trust score
    ask.ts                        # cited Q&A
  compare.ts                      # citation-graph comparison
  log.ts                          # structured logging + event insert
components/                       # shadcn + app components
docs/architecture.md             # ADR
drizzle/                         # generated migrations
.env.example
vercel.json
```

---

## Phase 1 — Skeleton + full-text summarize (fixes the core flaw & the audit bug)

Deliverable: deployed Next.js app where you paste an arXiv ID and get a streamed summary generated from the **full paper text**, not the abstract.

### Task 1: Project scaffold + validated env

**Files:**
- Create: `package.json` (via create-next-app), `lib/env.ts`, `.env.example`, `vercel.json`
- Test: `lib/env.test.ts`

**Interfaces:**
- Produces: `env` object `{ ANTHROPIC_API_KEY: string; VOYAGE_API_KEY: string; DATABASE_URL: string }` — importing it in any module guarantees the vars exist.

- [ ] **Step 1: Scaffold** — Run:
```bash
npx create-next-app@latest research-copilot --typescript --app --tailwind --eslint --src-dir=false --import-alias "@/*"
cd research-copilot
npx shadcn@latest init -d
npm i ai @ai-sdk/anthropic @neondatabase/serverless drizzle-orm unpdf zod
npm i -D drizzle-kit vitest @types/node
```
Then copy the existing repo's README/notebook into `docs/legacy/` so history isn't lost.

- [ ] **Step 2: Write failing env test** — `lib/env.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
describe('env', () => {
  it('throws when a required var is missing', async () => {
    delete process.env.DATABASE_URL
    await expect(import('./env?bust=' + Math.random())).rejects.toThrow(/DATABASE_URL/)
  })
})
```
Run `npx vitest run lib/env.test.ts` — expected FAIL (no `env.ts`).

- [ ] **Step 3: Implement `lib/env.ts`:**
```ts
import { z } from 'zod'
const schema = z.object({
  ANTHROPIC_API_KEY: z.string().min(1),
  VOYAGE_API_KEY: z.string().min(1),
  DATABASE_URL: z.string().url(),
})
const parsed = schema.safeParse(process.env)
if (!parsed.success) {
  const missing = parsed.error.issues.map(i => i.path.join('.')).join(', ')
  throw new Error(`Missing/invalid env: ${missing}`)
}
export const env = parsed.data
```

- [ ] **Step 4:** `.env.example`:
```
ANTHROPIC_API_KEY=sk-ant-...
VOYAGE_API_KEY=pa-...
DATABASE_URL=postgres://user:pass@ep-xxx.neon.tech/db?sslmode=require
```
`vercel.json`:
```json
{ "functions": { "app/api/ingest/route.ts": { "maxDuration": 300 }, "app/api/summarize/route.ts": { "maxDuration": 300 }, "app/api/compare/route.ts": { "maxDuration": 300 } } }
```

- [ ] **Step 5:** Run `npx vitest run` (env test passes with vars set), then **commit** `feat: scaffold next.js app with validated env`.

### Task 2: arXiv source (metadata + PDF url) — with the error-handling bug fixed

**Files:**
- Create: `lib/sources/arxiv.ts`, `lib/sources/resolve.ts`
- Test: `lib/sources/arxiv.test.ts`

**Interfaces:**
- Produces: `type PaperMeta = { source: 'arxiv'|'semanticscholar'; externalId: string; title: string; authors: string[]; year: number|null; abstract: string; url: string; pdfUrl: string|null }`
- Produces: `fetchArxiv(id: string): Promise<PaperMeta>`
- Produces: `resolveInput(input: string): { source: 'arxiv'|'semanticscholar'; id: string }` — parses a raw arXiv id, arXiv URL, `DOI:` / `ArXiv:` prefixed id, or S2 hash.

- [ ] **Step 1: Failing test** — `lib/sources/arxiv.test.ts` (mock `fetch`):
```ts
import { describe, it, expect, vi } from 'vitest'
import { fetchArxiv } from './arxiv'
const ATOM = `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:arxiv="http://arxiv.org/schemas/atom"><entry><title>Attention Is All You Need</title><summary>We propose the Transformer.</summary><author><name>Ashish Vaswani</name></author><arxiv:primary_category term="cs.CL"/><link type="text/html" href="https://arxiv.org/abs/1706.03762"/></entry></feed>`
it('parses arxiv metadata', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => ATOM }))
  const m = await fetchArxiv('1706.03762')
  expect(m.title).toBe('Attention Is All You Need')
  expect(m.authors).toContain('Ashish Vaswani')
  expect(m.pdfUrl).toBe('https://arxiv.org/pdf/1706.03762')
})
it('throws a clear error on non-200 (the old notebook bug)', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503, text: async () => '' }))
  await expect(fetchArxiv('bad')).rejects.toThrow(/arXiv.*503/)
})
```
Run — expected FAIL.

- [ ] **Step 2: Implement `lib/sources/arxiv.ts`:**
```ts
import { XMLParser } from 'fast-xml-parser' // npm i fast-xml-parser
import type { PaperMeta } from './types'
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })

export async function fetchArxiv(id: string): Promise<PaperMeta> {
  const res = await fetch(`https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`)
  if (!res.ok) throw new Error(`arXiv request failed (${res.status}) for id ${id}`)
  const feed = parser.parse(await res.text())?.feed
  const entry = feed?.entry
  if (!entry || Array.isArray(entry) === false && !entry.title) throw new Error(`No arXiv paper for id ${id}`)
  const e = Array.isArray(entry) ? entry[0] : entry
  const authors = ([] as any[]).concat(e.author ?? []).map(a => a.name).filter(Boolean)
  const cat = ([] as any[]).concat(e['arxiv:primary_category'] ?? [])[0]?.['@_term'] ?? null
  return {
    source: 'arxiv', externalId: id,
    title: String(e.title).trim(),
    authors,
    year: e.published ? new Date(e.published).getFullYear() : null,
    abstract: String(e.summary ?? '').trim(),
    url: `https://arxiv.org/abs/${id}`,
    pdfUrl: `https://arxiv.org/pdf/${id}`,
    // @ts-expect-error carry category through for chunk section hints
    category: cat,
  }
}
```
> Note: this replaces the notebook's `ET.fromstring(response.content)`-with-no-status-check. `fast-xml-parser` is chosen over `xml2js` (no callback API, smaller). Add `lib/sources/types.ts` exporting `PaperMeta`.

- [ ] **Step 3: Implement `lib/sources/resolve.ts`:**
```ts
export function resolveInput(input: string): { source: 'arxiv'|'semanticscholar'; id: string } {
  const s = input.trim()
  const abs = s.match(/arxiv\.org\/(?:abs|pdf)\/([\w.\/-]+?)(?:v\d+)?$/i)
  if (abs) return { source: 'arxiv', id: abs[1] }
  if (/^\d{4}\.\d{4,5}$/.test(s)) return { source: 'arxiv', id: s }
  if (/^(DOI:|ArXiv:)/i.test(s)) return { source: 'semanticscholar', id: s }
  if (/^10\.\d{4,}\//.test(s)) return { source: 'semanticscholar', id: `DOI:${s}` }
  if (/^[0-9a-f]{40}$/i.test(s)) return { source: 'semanticscholar', id: s }
  return { source: 'semanticscholar', id: s } // let S2 search resolve it
}
```
Add `npm i fast-xml-parser`.

- [ ] **Step 4:** Run tests — PASS. **Commit** `feat: arxiv source with status-checked fetch and input resolver`.

### Task 3: PDF text extraction + chunking

**Files:**
- Create: `lib/ingest/pdf.ts`, `lib/ingest/chunk.ts`
- Test: `lib/ingest/chunk.test.ts`

**Interfaces:**
- Produces: `extractPdf(pdfUrl: string): Promise<{ page: number; text: string }[]>`
- Produces: `type Chunk = { idx: number; section: string; page: number; content: string }`
- Produces: `chunkPages(pages: {page:number;text:string}[], opts?: {maxChars?:number; overlap?:number}): Chunk[]`

- [ ] **Step 1: Failing test** — `lib/ingest/chunk.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { chunkPages } from './chunk'
it('splits long pages into overlapping chunks with page numbers', () => {
  const pages = [{ page: 1, text: '3 Method\n' + 'x '.repeat(1200) }]
  const chunks = chunkPages(pages, { maxChars: 800, overlap: 100 })
  expect(chunks.length).toBeGreaterThan(1)
  expect(chunks[0].page).toBe(1)
  expect(chunks[0].section.toLowerCase()).toContain('method')
  expect(chunks[0].idx).toBe(0)
})
it('returns empty for empty input', () => {
  expect(chunkPages([])).toEqual([])
})
```
Run — FAIL.

- [ ] **Step 2: Implement `lib/ingest/pdf.ts`:**
```ts
import { extractText, getDocumentProxy } from 'unpdf'
export async function extractPdf(pdfUrl: string): Promise<{ page: number; text: string }[]> {
  const res = await fetch(pdfUrl)
  if (!res.ok) throw new Error(`PDF fetch failed (${res.status}) for ${pdfUrl}`)
  const buf = new Uint8Array(await res.arrayBuffer())
  const pdf = await getDocumentProxy(buf)
  const { text } = await extractText(pdf, { mergePages: false })
  return (text as string[]).map((t, i) => ({ page: i + 1, text: t }))
}
```

- [ ] **Step 3: Implement `lib/ingest/chunk.ts`:**
```ts
export type Chunk = { idx: number; section: string; page: number; content: string }
const HEADER = /^\s*(\d+(?:\.\d+)*)\s+([A-Z][A-Za-z ]{2,40})\s*$/m
export function chunkPages(pages: {page:number;text:string}[], opts: {maxChars?:number; overlap?:number} = {}): Chunk[] {
  const maxChars = opts.maxChars ?? 3000, overlap = opts.overlap ?? 300
  const chunks: Chunk[] = []
  let section = 'Body', idx = 0
  for (const { page, text } of pages) {
    const h = text.match(HEADER); if (h) section = `${h[1]} ${h[2]}`.trim()
    for (let start = 0; start < text.length; start += (maxChars - overlap)) {
      const content = text.slice(start, start + maxChars).trim()
      if (content.length < 40) continue
      chunks.push({ idx: idx++, section, page, content })
    }
  }
  return chunks
}
```
> ponytail: regex section detection is a known-ceiling heuristic. Comment in code: `// ponytail: heuristic section headers; swap for a layout-aware parser (grobid) only if citations feel wrong`.

- [ ] **Step 4:** Run tests — PASS. **Commit** `feat: pdf extraction and section-aware chunking`.

### Task 4: Streaming full-text summary route (no DB yet)

**Files:**
- Create: `app/api/summarize/route.ts`, `lib/rag/summarize.ts`
- Create: `app/page.tsx` (minimal input + streamed output)
- Test: `lib/rag/summarize.test.ts` (prompt-builder unit only)

**Interfaces:**
- Produces: `buildSummaryPrompt(meta: PaperMeta, body: string, fullText: boolean): { system: string; user: string }`
- Route `POST /api/summarize` body `{ input: string }` → streams markdown.

- [ ] **Step 1: Failing test** for `buildSummaryPrompt` — asserts the 7 sections are present and that when `fullText=false` the prompt tells the model it only has the abstract:
```ts
import { it, expect } from 'vitest'
import { buildSummaryPrompt } from './summarize'
it('flags abstract-only mode', () => {
  const { user } = buildSummaryPrompt({ title:'T', authors:[], abstract:'a' } as any, 'a', false)
  expect(user.toLowerCase()).toContain('only the abstract')
})
```
Run — FAIL.

- [ ] **Step 2: Implement `lib/rag/summarize.ts`** (prompt builder + streamer). The 7 sections come verbatim from the legacy notebook's system prompt (reuse, don't reinvent):
```ts
import { anthropic } from '@ai-sdk/anthropic'
import { streamText } from 'ai'
import type { PaperMeta } from '@/lib/sources/types'

const SYSTEM = `You are a research assistant that makes academic papers accessible.
Produce a structured markdown summary with EXACTLY these sections:
1. What is this paper about?
2. The problem they are solving
3. Their approach
4. Key findings
5. Why it matters
6. Limitations and future directions
7. Who should read this?
When source text is provided, cite the section you drew each claim from as [§Section]. Do not invent findings not in the text. Respond in raw markdown, no code fences.`

export function buildSummaryPrompt(meta: PaperMeta, body: string, fullText: boolean) {
  const header = `Title: ${meta.title}\nAuthors: ${meta.authors.join(', ')}\n`
  const note = fullText
    ? 'You have the full paper text below. Ground every claim in it.'
    : 'You have ONLY the abstract below (full text was unavailable). Say so if a section cannot be answered.'
  return { system: SYSTEM, user: `${note}\n\n${header}\n${body}` }
}

export function streamSummary(meta: PaperMeta, body: string, fullText: boolean) {
  const { system, user } = buildSummaryPrompt(meta, body, fullText)
  return streamText({ model: anthropic('claude-sonnet-5'), system, prompt: user, maxOutputTokens: 1500 })
}
```

- [ ] **Step 3: Implement `app/api/summarize/route.ts`:**
```ts
import { resolveInput } from '@/lib/sources/resolve'
import { fetchArxiv } from '@/lib/sources/arxiv'
import { extractPdf } from '@/lib/ingest/pdf'
import { streamSummary } from '@/lib/rag/summarize'
export const maxDuration = 300
export async function POST(req: Request) {
  const { input } = await req.json()
  const { source, id } = resolveInput(input)
  if (source !== 'arxiv') return Response.json({ error: 'Phase 1 supports arXiv only' }, { status: 400 })
  const meta = await fetchArxiv(id)
  let body = meta.abstract, fullText = false
  try {
    const pages = await extractPdf(meta.pdfUrl!)
    const joined = pages.map(p => p.text).join('\n').slice(0, 120_000)
    if (joined.length > meta.abstract.length * 2) { body = joined; fullText = true }
  } catch { /* fall back to abstract */ }
  return streamSummary(meta, body, fullText).toTextStreamResponse()
}
```

- [ ] **Step 4: Minimal `app/page.tsx`** — input box posting to `/api/summarize`, render streamed text. Use AI SDK `useCompletion` or a plain `fetch` reader. (Standard client code; verify by running.)

- [ ] **Step 5:** Run `npm run dev`, summarize `1706.03762`, confirm the output references methods/results that are NOT in the abstract (proves full text is used). **Commit** `feat: streaming full-text summary for arxiv papers`.

- [ ] **Step 6: Deploy** — `vercel` link + deploy, set the 3 env vars in Vercel dashboard, confirm the deployed URL summarizes a paper. This is the first shippable demo.

---

## Phase 2 — Neon + pgvector + ingestion + library

Deliverable: papers and their embedded chunks persist; a library page lists them; summaries are cached.

### Task 5: Database schema + migration

**Files:**
- Create: `lib/db/schema.ts`, `lib/db/client.ts`, `drizzle.config.ts`
- Test: `lib/db/schema.test.ts` (type-level + a live insert/select against a test DB, skipped if no `DATABASE_URL`)

**Interfaces:**
- Produces: Drizzle tables `papers`, `chunks`, `summaries`, `events`; `db` client.

- [ ] **Step 1:** Enable pgvector once on Neon: `CREATE EXTENSION IF NOT EXISTS vector;` (run via Neon SQL editor; document in README).

- [ ] **Step 2: Implement `lib/db/schema.ts`:**
```ts
import { pgTable, uuid, text, integer, boolean, jsonb, real, timestamp, vector, index, unique } from 'drizzle-orm/pg-core'
export const papers = pgTable('papers', {
  id: uuid('id').defaultRandom().primaryKey(),
  source: text('source').notNull(),
  externalId: text('external_id').notNull(),
  title: text('title').notNull(),
  authors: jsonb('authors').$type<string[]>().notNull(),
  year: integer('year'),
  abstract: text('abstract'),
  url: text('url'),
  fullTextAvailable: boolean('full_text_available').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
}, t => ({ uq: unique().on(t.source, t.externalId) }))

export const chunks = pgTable('chunks', {
  id: uuid('id').defaultRandom().primaryKey(),
  paperId: uuid('paper_id').notNull().references(() => papers.id, { onDelete: 'cascade' }),
  idx: integer('idx').notNull(),
  section: text('section').notNull(),
  page: integer('page').notNull(),
  content: text('content').notNull(),
  embedding: vector('embedding', { dimensions: 1024 }).notNull(),
}, t => ({ emb: index('chunks_emb_idx').using('hnsw', t.embedding.op('vector_cosine_ops')) }))

export const summaries = pgTable('summaries', {
  paperId: uuid('paper_id').primaryKey().references(() => papers.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  trustScore: real('trust_score'),
  createdAt: timestamp('created_at').defaultNow(),
})

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  action: text('action').notNull(),
  paperId: uuid('paper_id'),
  latencyMs: integer('latency_ms'),
  tokens: integer('tokens'),
  createdAt: timestamp('created_at').defaultNow(),
})
```

- [ ] **Step 3: Implement `lib/db/client.ts`:**
```ts
import { drizzle } from 'drizzle-orm/neon-http'
import { neon } from '@neondatabase/serverless'
import { env } from '@/lib/env'
import * as schema from './schema'
export const db = drizzle(neon(env.DATABASE_URL), { schema })
```
`drizzle.config.ts` points at `lib/db/schema.ts`, out `./drizzle`.

- [ ] **Step 4:** `npx drizzle-kit generate && npx drizzle-kit migrate`. Commit the generated SQL in `drizzle/`. **Commit** `feat: neon+pgvector schema and migrations`.

### Task 6: Voyage embeddings + ingestion pipeline

**Files:**
- Create: `lib/ingest/embed.ts`, `lib/ingest/pipeline.ts`, `app/api/ingest/route.ts`
- Test: `lib/ingest/embed.test.ts` (mock fetch), `lib/ingest/pipeline.test.ts` (mock sources + db)

**Interfaces:**
- Produces: `embed(texts: string[]): Promise<number[][]>` (1024-dim each)
- Produces: `ingest(input: string): Promise<{ paperId: string; fullTextAvailable: boolean }>` — idempotent upsert on (source, externalId).

- [ ] **Step 1: Failing test** for `embed` asserts it POSTs to Voyage and returns vectors of length 1024. Mock the HTTP.

- [ ] **Step 2: Implement `lib/ingest/embed.ts`:**
```ts
import { env } from '@/lib/env'
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return []
  const res = await fetch('https://api.voyageai.com/v1/embeddings', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.VOYAGE_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'voyage-3.5', input: texts, input_type: 'document' }),
  })
  if (!res.ok) throw new Error(`Voyage embed failed (${res.status})`)
  const json = await res.json()
  return json.data.map((d: any) => d.embedding as number[])
}
```
> Voyage caps batch size/token count — chunk the `texts` array into batches of ≤128 in `pipeline.ts`.

- [ ] **Step 3: Implement `lib/ingest/pipeline.ts`** — resolve → fetch meta (arxiv or S2, Task 9 adds S2; for now arxiv) → extract PDF → chunk → embed in batches → upsert paper, delete old chunks, insert new. Return `paperId`. Log an `events` row. (Full code: ~60 lines; include batching loop `for (let i=0;i<chunks.length;i+=128)`.)

- [ ] **Step 4: `app/api/ingest/route.ts`** — `POST {input}` → `ingest()` → `{ paperId }`. `maxDuration = 300`.

- [ ] **Step 5:** Run tests + a live `curl` ingest of `1706.03762`; verify rows in Neon. **Commit** `feat: voyage embeddings and idempotent ingestion pipeline`.

### Task 7: Library list + wire summarize to cache

**Files:**
- Create: `app/api/papers/route.ts`, `lib/log.ts`
- Modify: `app/api/summarize/route.ts` (read/write `summaries` cache; ingest-first), `app/page.tsx` (library list), `app/paper/[id]/page.tsx`

**Interfaces:**
- Produces: `GET /api/papers` → `{ id, title, authors, year, fullTextAvailable }[]`
- Produces: `logEvent(action, {paperId?, latencyMs?, tokens?})`

- [ ] **Step 1:** `lib/log.ts` — structured `console.log(JSON.stringify({level,msg,...}))` + insert into `events`. One function, used everywhere.
- [ ] **Step 2:** Modify summarize: it now takes `{ paperId }`, checks `summaries` cache, else generates from stored chunks (join to full text) and on stream-finish writes cache + trust score placeholder. Landing page flow becomes: input → `/api/ingest` → redirect to `/paper/[id]` → summary streams.
- [ ] **Step 3:** `app/api/papers/route.ts` returns the library; `app/page.tsx` renders it under the input box.
- [ ] **Step 4:** Run: ingest two papers, see both in the library, reopen one → summary served from cache (no second Claude call — verify via `events`). **Commit** `feat: library list and summary caching`.

---

## Phase 3 — Grounded Q&A with inline citations

Deliverable: on a paper page, ask a question → cited answer whose citations link to the exact chunk.

### Task 8: Retrieval + cited ask route

**Files:**
- Create: `lib/rag/retrieve.ts`, `lib/rag/ask.ts`, `app/api/ask/route.ts`
- Modify: `app/paper/[id]/page.tsx` (chat UI)
- Test: `lib/rag/ask.test.ts` (citation-marker parsing)

**Interfaces:**
- Produces: `retrieve(query: string, opts: { paperId?: string; limit?: number }): Promise<Chunk[]>` — cosine search; `paperId` omitted ⇒ whole library (used in Phase 4).
- Produces: `type Citation = { marker: string; chunkId: string; section: string; page: number }`
- Produces: `parseCitations(answer: string, chunks: RetrievedChunk[]): Citation[]`

- [ ] **Step 1: Failing test** — `parseCitations('The model uses attention [C1].', [{label:'C1',...}])` returns one citation mapping `C1` → its chunk with section+page.

- [ ] **Step 2: `lib/rag/retrieve.ts`** — embed the query (`input_type: 'query'`), run Drizzle `sql` cosine order:
```ts
import { sql } from 'drizzle-orm'
import { db } from '@/lib/db/client'
import { chunks } from '@/lib/db/schema'
import { embed } from '@/lib/ingest/embed'
export async function retrieve(query: string, opts: { paperId?: string; limit?: number } = {}) {
  const [qv] = await embed([query]) // note: pass input_type 'query' variant
  const emb = sql.raw(`'[${qv.join(',')}]'::vector`)
  const rows = await db.select().from(chunks)
    .where(opts.paperId ? sql`${chunks.paperId} = ${opts.paperId}` : sql`true`)
    .orderBy(sql`${chunks.embedding} <=> ${emb}`)
    .limit(opts.limit ?? 8)
  return rows
}
```
> Add an `embedQuery` variant (or a param) so query embeddings use `input_type: 'query'` while ingestion uses `'document'`.

- [ ] **Step 3: `lib/rag/ask.ts`** — label retrieved chunks `[C1..Cn]`, prompt Claude to answer using only them and cite `[Cn]`, stream. Return the citation map alongside. `parseCitations` maps markers back to chunk metadata for the UI to render links.

- [ ] **Step 4: `app/api/ask/route.ts`** + chat UI on the paper page. Citations render as hoverable `[§3.2 p5]` links that scroll to / show the source chunk.

- [ ] **Step 5:** Ask "what dataset did they evaluate on?" on the Transformer paper → answer cites the results section chunk. **Commit** `feat: grounded Q&A with inline citations`.

---

## Phase 4 — Trust score + ask-across-library + Semantic Scholar + compare

### Task 9: Semantic Scholar source (full-text when open-access)

**Files:**
- Create: `lib/sources/semanticscholar.ts`; Modify: `lib/ingest/pipeline.ts` (branch on source)
- Test: `lib/sources/semanticscholar.test.ts`

**Interfaces:**
- Produces: `fetchSemanticScholar(id: string): Promise<PaperMeta>` — sets `pdfUrl` from `openAccessPdf.url` when present, else `null` (→ abstract-only ingestion). Fields: `title,authors,year,abstract,citationCount,fieldsOfStudy,externalIds,openAccessPdf,references,citations`.

- [ ] **Steps:** TDD the JSON parse (mock fetch, one fixture with `openAccessPdf`, one without → `pdfUrl` null + `fullTextAvailable` false downstream). Wire into pipeline. **Commit** `feat: semantic scholar source with open-access full text`.

### Task 10: Faithfulness / trust score

**Files:**
- Create: `lib/rag/faithfulness.ts`; Modify: summarize finish handler to compute + store `trustScore`
- Test: `lib/rag/faithfulness.test.ts` (aggregation math, mocked LLM verdicts)

**Interfaces:**
- Produces: `scoreFaithfulness(summary: string, sourceChunks: {content:string}[]): Promise<{ score: number; claims: { claim: string; supported: boolean; evidence: string|null }[] }>` — one `claude-haiku-4-5-20251001` structured-output call returning per-claim verdicts; `score = supported / total`.

- [ ] **Step 1: Failing test** — given a mocked verdict list of 3 supported / 1 unsupported, `score === 0.75`.
- [ ] **Step 2: Implement** using AI SDK `generateObject` with a Zod schema `{ claims: {claim, supported, evidence}[] }`. Prompt: "For each factual claim in the summary, mark supported=true only if the source chunks entail it."
- [ ] **Step 3:** Store `trustScore` on `summaries`; paper page shows a badge (green ≥0.85, amber ≥0.6, red below) with an expandable list of unsupported claims.
- [ ] **Step 4:** **Commit** `feat: summary faithfulness trust score`.

### Task 11: Ask-across-library

**Files:** Modify `app/api/ask/route.ts` (accept `scope: 'paper'|'library'`), add a library-wide chat entry on `app/page.tsx`.

- [ ] `retrieve()` already supports omitting `paperId`. Add `scope` param; when `library`, retrieve across all chunks and cite `[C1 · <paper title>]` so answers attribute the source paper. Verify: ingest 3 papers, ask "which of my papers discuss attention?" → answer cites the right ones. **Commit** `feat: ask across the whole library`.

### Task 12: Multi-paper compare via citation graph

**Files:** Create `lib/compare.ts`, `app/api/compare/route.ts`, compare UI section.

**Interfaces:** `compare(paperId: string, n?: number): Promise<{ table: { paperId:string; title:string; approach:string; finding:string }[] }>` — pull top-N references/citations from S2, ingest+summarize each (reuse pipeline + cache), then one Claude call builds a comparison row per paper.

- [ ] TDD the row-assembly given mocked summaries. Cap N (default 4) and `logEvent` what was skipped (no silent truncation). **Commit** `feat: multi-paper comparison via citation graph`.

---

## Phase 5 — Interview polish: ADR, metrics, README

### Task 13: Metrics endpoint + page

**Files:** Create `app/api/metrics/route.ts`, `app/metrics/page.tsx`.
- [ ] `GET /api/metrics` aggregates `events`: papers processed, avg summarize latency, total tokens, trust-score distribution. Page renders simple cards (see the `dataviz` skill for the chart if you add one). **Commit** `feat: observability metrics page`.

### Task 14: ADR + README rewrite

**Files:** Create `docs/architecture.md`; rewrite `README.md`.
- [ ] `docs/architecture.md`: why Neon (serverless HTTP driver, Vercel-native), why pgvector over a separate vector DB (one datastore, one bill), why no queue yet (streaming covers it; queue is the 10× escape hatch), full-text-vs-abstract honesty, cost controls (caching, Haiku for checks). One decision per section.
- [ ] README: what it does, the "beats general chat" thesis (full text + grounding + trust score + library memory), architecture diagram, local setup, deploy steps, env table, screenshots/GIF. **Commit** `docs: architecture decision record and portfolio README`.

---

## Self-Review

- **Spec coverage:** full-text summarize (T4), library (T5–7), grounded cited Q&A (T8), trust score (T10), ask-across-library (T11), multi-paper compare (T12), ADR+metrics (T13–14), Vercel/Neon-only constraint (T1,T5), arXiv bug fix (T2). All four user-chosen differentiators present. ✅
- **Placeholder scan:** pipeline.ts (T6 step 3) and some UI steps describe rather than show full code — flagged inline as "full code ~60 lines"; expand at execution time. All pure-logic tasks carry complete code + tests.
- **Type consistency:** `PaperMeta` (T2) consumed by T4/T6/T9; `Chunk` (T3) by T6/T8; `retrieve()` signature (T8) reused by T11; `embed()` (T6) by T8's query path — one open item: T8 needs an `input_type:'query'` embedding variant, noted in T8 step 2.

---

## Execution Handoff

Two execution options:
1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks.
2. **Inline Execution** — tasks in-session with checkpoints.

Prerequisite before any coding: Neon database + Voyage API key provisioned, `pgvector` extension enabled, three env vars set locally and in Vercel.

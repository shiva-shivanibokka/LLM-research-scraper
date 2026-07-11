import {
  pgTable, uuid, text, integer, boolean, jsonb, real, timestamp, vector, index, unique,
} from 'drizzle-orm/pg-core'
import { EMBEDDING_DIM } from '@/lib/models'

export const papers = pgTable(
  'papers',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    source: text('source').notNull(),
    externalId: text('external_id').notNull(),
    title: text('title').notNull(),
    authors: jsonb('authors').$type<string[]>().notNull(),
    year: integer('year'),
    abstract: text('abstract'),
    url: text('url'),
    fullText: text('full_text'), // concatenated full text when available, for summarization
    fullTextAvailable: boolean('full_text_available').notNull().default(false),
    citationCount: integer('citation_count'),
    createdAt: timestamp('created_at').defaultNow(),
  },
  (t) => ({ uq: unique('papers_source_external').on(t.source, t.externalId) }),
)

export const chunks = pgTable(
  'chunks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    paperId: uuid('paper_id').notNull().references(() => papers.id, { onDelete: 'cascade' }),
    idx: integer('idx').notNull(),
    section: text('section').notNull(),
    page: integer('page').notNull(),
    content: text('content').notNull(),
    embedding: vector('embedding', { dimensions: EMBEDDING_DIM }).notNull(),
  },
  (t) => ({ emb: index('chunks_emb_idx').using('hnsw', t.embedding.op('vector_cosine_ops')) }),
)

export const summaries = pgTable('summaries', {
  paperId: uuid('paper_id').primaryKey().references(() => papers.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  trustScore: real('trust_score'),
  unsupportedClaims: jsonb('unsupported_claims').$type<string[]>(),
  createdAt: timestamp('created_at').defaultNow(),
})

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  action: text('action').notNull(),
  paperId: uuid('paper_id'),
  latencyMs: integer('latency_ms'),
  createdAt: timestamp('created_at').defaultNow(),
})

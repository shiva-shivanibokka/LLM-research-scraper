CREATE EXTENSION IF NOT EXISTS vector;--> statement-breakpoint
CREATE TABLE "chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paper_id" uuid NOT NULL,
	"idx" integer NOT NULL,
	"section" text NOT NULL,
	"page" integer NOT NULL,
	"content" text NOT NULL,
	"embedding" vector(768) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action" text NOT NULL,
	"paper_id" uuid,
	"latency_ms" integer,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "papers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"external_id" text NOT NULL,
	"title" text NOT NULL,
	"authors" jsonb NOT NULL,
	"year" integer,
	"abstract" text,
	"url" text,
	"full_text" text,
	"full_text_available" boolean DEFAULT false NOT NULL,
	"citation_count" integer,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "papers_source_external" UNIQUE("source","external_id")
);
--> statement-breakpoint
CREATE TABLE "summaries" (
	"paper_id" uuid PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"trust_score" real,
	"unsupported_claims" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "chunks" ADD CONSTRAINT "chunks_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "summaries" ADD CONSTRAINT "summaries_paper_id_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chunks_emb_idx" ON "chunks" USING hnsw ("embedding" vector_cosine_ops);
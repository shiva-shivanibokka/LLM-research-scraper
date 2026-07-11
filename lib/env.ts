// The only server-side secret is DATABASE_URL. LLM and embedding keys are BYOK
// (passed per request, never stored). Validated lazily on first DB access so
// `next build` and BYOK-only requests don't require it.
export function requireDatabaseUrl(): string {
  const v = process.env.DATABASE_URL
  if (!v || v.trim() === '') throw new Error('Missing required env: DATABASE_URL')
  return v
}

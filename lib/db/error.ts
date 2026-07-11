// Drizzle wraps every driver failure in a DrizzleQueryError whose `.message` is
// the noisy "Failed query: <sql> — params: <every param>" dump. The ACTUAL
// Postgres reason (e.g. "there is no unique or exclusion constraint matching
// the ON CONFLICT specification") lives in `.cause`. Returning `.message` to the
// client hides it behind a wall of params. This digs out the real reason.
export function dbErrorMessage(e: unknown): string {
  if (!(e instanceof Error)) return String(e)
  const cause = (e as { cause?: unknown }).cause
  if (cause instanceof Error) {
    const c = cause as Error & { code?: string; detail?: string; hint?: string }
    return [c.message, c.detail, c.hint && `hint: ${c.hint}`, c.code && `(${c.code})`]
      .filter(Boolean)
      .join(' — ')
  }
  return e.message
}

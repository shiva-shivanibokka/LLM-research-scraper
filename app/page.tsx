'use client'

import { useState } from 'react'

export default function Home() {
  const [input, setInput] = useState('1706.03762')
  const [summary, setSummary] = useState('')
  const [title, setTitle] = useState('')
  const [fullText, setFullText] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function run() {
    setLoading(true)
    setError('')
    setSummary('')
    setTitle('')
    setFullText(null)
    try {
      const res = await fetch('/api/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input }),
      })
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({ error: res.statusText }))
        setError(j.error || 'Request failed')
        return
      }
      setTitle(decodeURIComponent(res.headers.get('x-paper-title') || ''))
      setFullText(res.headers.get('x-full-text') === 'true')
      const reader = res.body.getReader()
      const dec = new TextDecoder()
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        setSummary((s) => s + dec.decode(value, { stream: true }))
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-semibold">Research Copilot</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Full-text paper summaries — paste an arXiv id or URL (e.g. 1706.03762).
      </p>

      <div className="mt-6 flex gap-2">
        <input
          className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !loading && run()}
          placeholder="arXiv id or URL"
        />
        <button
          onClick={run}
          disabled={loading}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {loading ? 'Summarizing…' : 'Summarize'}
        </button>
      </div>

      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {(title || summary) && (
        <section className="mt-8">
          {title && <h2 className="text-lg font-medium">{title}</h2>}
          {fullText !== null && (
            <span
              className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                fullText ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {fullText ? 'full text' : 'abstract only'}
            </span>
          )}
          <article className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-neutral-800 dark:text-neutral-200">
            {summary}
          </article>
        </section>
      )}
    </main>
  )
}

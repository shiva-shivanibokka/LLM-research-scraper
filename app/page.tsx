'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { PROVIDERS, type ProviderId } from '@/lib/provider-list'

type Paper = { id: string; title: string; authors: string[]; year: number | null; fullTextAvailable: boolean; citationCount: number | null }
type Citation = { marker: string; paperTitle: string; section: string; page: number }

const card = 'rounded-lg border border-neutral-200 p-4 dark:border-neutral-800'
const field = 'rounded-md border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900'
const btn = 'rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900'

export default function Home() {
  // BYOK — memory only
  const [provider, setProvider] = useState<ProviderId>('anthropic')
  const [model, setModel] = useState<string>(PROVIDERS.anthropic.models[0])
  const [llmKey, setLlmKey] = useState('')
  const [embKey, setEmbKey] = useState('')

  const [papers, setPapers] = useState<Paper[]>([])
  const [input, setInput] = useState('1706.03762')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  const [selected, setSelected] = useState<Paper | null>(null)
  const [summary, setSummary] = useState<{ text: string; trust: number | null; unsupported: string[] } | null>(null)
  const [pQuestion, setPQuestion] = useState('')
  const [pAnswer, setPAnswer] = useState<{ answer: string; citations: Citation[] } | null>(null)

  const [libQuestion, setLibQuestion] = useState('')
  const [libAnswer, setLibAnswer] = useState<{ answer: string; citations: Citation[] } | null>(null)

  const [cmpInput, setCmpInput] = useState('')
  const [cmpRows, setCmpRows] = useState<{ title: string; approach: string; finding: string }[] | null>(null)

  const llm = () => ({ provider, model, apiKey: llmKey })

  const loadPapers = useCallback(async () => {
    try {
      const r = await fetch('/api/papers')
      if (r.ok) setPapers((await r.json()).papers)
    } catch { /* ignore */ }
  }, [])
  useEffect(() => { loadPapers() }, [loadPapers])

  async function post(url: string, body: unknown) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const j = await r.json().catch(() => ({ error: r.statusText }))
    if (!r.ok) throw new Error(j.error || 'Request failed')
    return j
  }

  async function addPaper() {
    if (!embKey.trim()) return setError('Enter your Gemini key (used for embeddings).')
    setError(''); setBusy('add')
    try {
      await post('/api/ingest', { input, embApiKey: embKey })
      await loadPapers()
    } catch (e) { setError(msg(e)) } finally { setBusy('') }
  }

  async function summarize(p: Paper) {
    if (!llmKey.trim()) return setError('Enter your LLM API key.')
    setSelected(p); setSummary(null); setPAnswer(null); setError(''); setBusy('sum')
    try {
      const j = await post('/api/summarize', { paperId: p.id, ...llm() })
      setSummary({ text: j.summary, trust: j.trustScore, unsupported: j.unsupported ?? [] })
    } catch (e) { setError(msg(e)) } finally { setBusy('') }
  }

  async function askPaper() {
    if (!selected || !pQuestion.trim()) return
    setError(''); setBusy('pask'); setPAnswer(null)
    try {
      setPAnswer(await post('/api/ask', { question: pQuestion, scope: 'paper', paperId: selected.id, embApiKey: embKey, ...llm() }))
    } catch (e) { setError(msg(e)) } finally { setBusy('') }
  }

  async function askLibrary() {
    if (!libQuestion.trim()) return
    setError(''); setBusy('lask'); setLibAnswer(null)
    try {
      setLibAnswer(await post('/api/ask', { question: libQuestion, scope: 'library', embApiKey: embKey, ...llm() }))
    } catch (e) { setError(msg(e)) } finally { setBusy('') }
  }

  async function runCompare() {
    if (!cmpInput.trim()) return
    setError(''); setBusy('cmp'); setCmpRows(null)
    try {
      const j = await post('/api/compare', { input: cmpInput, ...llm() })
      setCmpRows(j.rows)
    } catch (e) { setError(msg(e)) } finally { setBusy('') }
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Research Copilot</h1>
        <Link href="/metrics" className="text-sm text-neutral-500 underline">Metrics</Link>
      </div>
      <p className="mt-1 text-sm text-neutral-500">
        Full-text summaries, grounded Q&A with citations, a trust score, and cross-library search. Keys stay in your browser.
      </p>

      {/* Keys */}
      <section className={`mt-6 ${card}`}>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <select className={field} value={provider} onChange={(e) => { const p = e.target.value as ProviderId; setProvider(p); setModel(PROVIDERS[p].models[0]) }} aria-label="Provider">
            {(Object.keys(PROVIDERS) as ProviderId[]).map((p) => <option key={p} value={p}>{PROVIDERS[p].label}</option>)}
          </select>
          <select className={field} value={model} onChange={(e) => setModel(e.target.value)} aria-label="Model">
            {PROVIDERS[provider].models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          <input type="password" className={field} value={llmKey} onChange={(e) => setLlmKey(e.target.value)} placeholder={`${PROVIDERS[provider].label} API key (LLM)`} autoComplete="off" />
          <input type="password" className={field} value={embKey} onChange={(e) => setEmbKey(e.target.value)} placeholder="Gemini API key (embeddings, free)" autoComplete="off" />
        </div>
      </section>

      {error && <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {/* Add paper */}
      <section className="mt-6 flex gap-2">
        <input className={`flex-1 ${field}`} value={input} onChange={(e) => setInput(e.target.value)} placeholder="arXiv id / URL, DOI:…, or Semantic Scholar id" />
        <button className={btn} onClick={addPaper} disabled={busy === 'add'}>{busy === 'add' ? 'Adding…' : 'Add to library'}</button>
      </section>

      <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Library */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Library ({papers.length})</h2>
          <ul className="mt-3 space-y-2">
            {papers.map((p) => (
              <li key={p.id}>
                <button onClick={() => summarize(p)} className={`w-full text-left ${card} hover:border-neutral-400`}>
                  <div className="text-sm font-medium">{p.title}</div>
                  <div className="mt-1 text-xs text-neutral-500">
                    {p.year ?? '—'} · {p.fullTextAvailable ? 'full text' : 'abstract only'}
                    {p.citationCount != null ? ` · ${p.citationCount.toLocaleString()} citations` : ''}
                  </div>
                </button>
              </li>
            ))}
            {papers.length === 0 && <li className="text-sm text-neutral-500">No papers yet — add one above.</li>}
          </ul>

          {/* Library-wide ask */}
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">Ask across library</h2>
          <div className="mt-3 flex gap-2">
            <input className={`flex-1 ${field}`} value={libQuestion} onChange={(e) => setLibQuestion(e.target.value)} placeholder="What do my papers say about…?" />
            <button className={btn} onClick={askLibrary} disabled={busy === 'lask'}>Ask</button>
          </div>
          {libAnswer && <AnswerBlock a={libAnswer} />}

          {/* Compare */}
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">Compare vs references</h2>
          <div className="mt-3 flex gap-2">
            <input className={`flex-1 ${field}`} value={cmpInput} onChange={(e) => setCmpInput(e.target.value)} placeholder="Paper id — compares its top references" />
            <button className={btn} onClick={runCompare} disabled={busy === 'cmp'}>Compare</button>
          </div>
          {cmpRows && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-xs">
                <thead><tr className="text-left text-neutral-500"><th className="p-1">Paper</th><th className="p-1">Approach</th><th className="p-1">Finding</th></tr></thead>
                <tbody>{cmpRows.map((r, i) => <tr key={i} className="border-t border-neutral-200 dark:border-neutral-800"><td className="p-1 font-medium">{r.title}</td><td className="p-1">{r.approach}</td><td className="p-1">{r.finding}</td></tr>)}</tbody>
              </table>
              {cmpRows.length === 0 && <p className="text-sm text-neutral-500">No references with abstracts found.</p>}
            </div>
          )}
        </section>

        {/* Selected paper */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">Paper</h2>
          {!selected && <p className="mt-3 text-sm text-neutral-500">Click a paper to summarize it.</p>}
          {selected && (
            <div className="mt-3">
              <h3 className="font-medium">{selected.title}</h3>
              {busy === 'sum' && <p className="mt-2 text-sm text-neutral-500">Summarizing + scoring faithfulness…</p>}
              {summary && (
                <>
                  <TrustBadge score={summary.trust} />
                  {summary.unsupported.length > 0 && (
                    <details className="mt-2 text-xs text-amber-700">
                      <summary className="cursor-pointer">{summary.unsupported.length} unsupported claim(s)</summary>
                      <ul className="mt-1 list-disc pl-5">{summary.unsupported.map((c, i) => <li key={i}>{c}</li>)}</ul>
                    </details>
                  )}
                  <article className="mt-3 whitespace-pre-wrap text-sm leading-relaxed">{summary.text}</article>

                  <h2 className="mt-6 text-sm font-semibold uppercase tracking-wide text-neutral-500">Ask this paper</h2>
                  <div className="mt-2 flex gap-2">
                    <input className={`flex-1 ${field}`} value={pQuestion} onChange={(e) => setPQuestion(e.target.value)} placeholder="e.g. what baseline did they compare against?" />
                    <button className={btn} onClick={askPaper} disabled={busy === 'pask'}>Ask</button>
                  </div>
                  {pAnswer && <AnswerBlock a={pAnswer} />}
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

function TrustBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="mt-2 inline-block rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600">trust: n/a</span>
  const pct = Math.round(score * 100)
  const cls = score >= 0.85 ? 'bg-green-100 text-green-800' : score >= 0.6 ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
  return <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>trust {pct}%</span>
}

function AnswerBlock({ a }: { a: { answer: string; citations: Citation[] } }) {
  return (
    <div className="mt-3 text-sm">
      <p className="whitespace-pre-wrap leading-relaxed">{a.answer}</p>
      {a.citations.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {a.citations.map((c) => (
            <span key={c.marker} className="rounded bg-neutral-100 px-1.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              [{c.marker}] {c.paperTitle} §{c.section} p{c.page}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function msg(e: unknown) { return e instanceof Error ? e.message : String(e) }

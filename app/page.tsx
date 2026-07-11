'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { PROVIDERS, type ProviderId } from '@/lib/provider-list'

type Paper = { id: string; title: string; authors: string[]; year: number | null; fullTextAvailable: boolean; citationCount: number | null }
type Citation = { marker: string; paperTitle: string; section: string; page: number }

const EXAMPLES = [
  { label: 'Attention Is All You Need', id: '1706.03762' },
  { label: 'GPT-4 Technical Report', id: '2303.08774' },
  { label: 'AlphaFold (DOI)', id: 'DOI:10.1038/s41586-021-03819-2' },
]

export default function Home() {
  // BYOK — kept in memory only
  const [provider, setProvider] = useState<ProviderId>('google')
  const [model, setModel] = useState<string>(PROVIDERS.google.models[0])
  const [llmKey, setLlmKey] = useState('')
  const [embKey, setEmbKey] = useState('')

  const [papers, setPapers] = useState<Paper[]>([])
  const [input, setInput] = useState('')
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

  async function post(url: string, bodyData: unknown) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(bodyData) })
    const j = await r.json().catch(() => ({ error: r.statusText }))
    if (!r.ok) throw new Error(j.error || 'Request failed')
    return j
  }

  async function addPaper() {
    if (!input.trim()) return setError('Paste a paper ID or URL first.')
    if (!embKey.trim()) return setError('Add your Gemini key above — it indexes the paper for search.')
    setError(''); setBusy('add')
    try {
      await post('/api/ingest', { input, embApiKey: embKey })
      setInput('')
      await loadPapers()
    } catch (e) { setError(msg(e)) } finally { setBusy('') }
  }

  async function summarize(p: Paper) {
    if (!llmKey.trim()) return setError('Add your model key above to generate summaries.')
    setSelected(p); setSummary(null); setPAnswer(null); setPQuestion(''); setError(''); setBusy('sum')
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
      setCmpRows((await post('/api/compare', { input: cmpInput, ...llm() })).rows)
    } catch (e) { setError(msg(e)) } finally { setBusy('') }
  }

  const oneKey = provider === 'google'

  return (
    <main className="wrap">
      <div className="topbar">
        <span className="brand">Research Copilot</span>
        <Link href="/metrics" className="navlink">Metrics →</Link>
      </div>

      <header className="hero">
        <h1>Read papers with receipts.</h1>
        <p>
          Summaries built from a paper&apos;s <b style={{ color: 'var(--text)' }}>full text</b>, answers grounded in the
          source with section-level citations, and a trust score that flags anything the paper doesn&apos;t back up.
          Everything a general chatbot can&apos;t: memory, citations, and a whole library you can question at once.
        </p>
        <a className="live" href="#start"><span className="dot" /> live · bring your own key</a>
      </header>

      {error && <div className="error">{error}</div>}

      {/* STEP 1 */}
      <section className="panel" id="start">
        <p className="eyebrow"><span className="n">01</span> Connect</p>
        <h2>Add your keys</h2>
        <p className="sub">Both keys stay in your browser for this session only — they&apos;re never saved or sent anywhere but the model provider.</p>
        <div className="grid two">
          <div className="field">
            <span className="lab">Model provider</span>
            <select value={provider} onChange={(e) => { const p = e.target.value as ProviderId; setProvider(p); setModel(PROVIDERS[p].models[0]) }}>
              {(Object.keys(PROVIDERS) as ProviderId[]).map((p) => <option key={p} value={p}>{PROVIDERS[p].label}</option>)}
            </select>
          </div>
          <div className="field">
            <span className="lab">Model</span>
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {PROVIDERS[provider].models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div className="field">
            <span className="lab">Model key — writes summaries &amp; answers</span>
            <input type="password" value={llmKey} onChange={(e) => setLlmKey(e.target.value)} placeholder={`${PROVIDERS[provider].label} API key`} autoComplete="off" />
          </div>
          <div className="field">
            <span className="lab">Gemini key — powers search &amp; your library (free)</span>
            <input type="password" value={embKey} onChange={(e) => setEmbKey(e.target.value)} placeholder="Gemini API key" autoComplete="off" />
          </div>
        </div>
        <p className="help">
          The <b>model key</b> runs summaries and answers with the provider you pick above. The <b>Gemini key</b> turns papers into searchable vectors — it&apos;s free from{' '}
          <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>.
          {oneKey && ' Since you picked Gemini as your model too, you can paste the same key in both.'}
        </p>
      </section>

      {/* STEP 2 */}
      <section className="panel">
        <p className="eyebrow"><span className="n">02</span> Add a paper</p>
        <h2>Add a paper to your library</h2>
        <p className="sub">Paste a paper&apos;s identifier. We fetch its full text (or abstract, if that&apos;s all that&apos;s public), index it, and add it below.</p>
        <div className="row">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && busy !== 'add' && addPaper()} placeholder="arXiv ID (e.g. 1706.03762), arXiv URL, DOI:10.…, or Semantic Scholar ID" />
          <button className="btn primary" onClick={addPaper} disabled={busy === 'add'}>{busy === 'add' ? 'Adding…' : 'Add to library'}</button>
        </div>
        <div className="examples">
          <span className="section-label" style={{ margin: 0, alignSelf: 'center' }}>Try one:</span>
          {EXAMPLES.map((e) => <button key={e.id} className="example" onClick={() => setInput(e.id)}>{e.label}</button>)}
        </div>
      </section>

      {/* STEP 3 */}
      <div className="cols">
        <div>
          <section className="panel">
            <p className="eyebrow"><span className="n">03</span> Read</p>
            <h2>Library <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({papers.length})</span></h2>
            <p className="sub">Click a paper to summarize it and ask questions.</p>
            <div className="grid" style={{ gap: '.6rem' }}>
              {papers.map((p) => (
                <button key={p.id} className={`paper-card${selected?.id === p.id ? ' active' : ''}`} onClick={() => summarize(p)}>
                  <div className="t">{p.title}</div>
                  <div className="m">
                    {p.year ?? '—'} · <span className={`badge ${p.fullTextAvailable ? 'full' : 'abs'}`}>{p.fullTextAvailable ? 'full text' : 'abstract only'}</span>
                    {p.citationCount != null ? ` · ${p.citationCount.toLocaleString()} citations` : ''}
                  </div>
                </button>
              ))}
              {papers.length === 0 && <div className="empty">Your library is empty. Add a paper above to get started.</div>}
            </div>
          </section>

          <section className="panel">
            <h2>Ask across your library</h2>
            <p className="sub">One question, answered from every paper you&apos;ve added — with citations. A chatbot can&apos;t do this; it has no memory of what you&apos;ve read.</p>
            <div className="row">
              <input value={libQuestion} onChange={(e) => setLibQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && askLibrary()} placeholder="What do my papers say about positional encoding?" />
              <button className="btn" onClick={askLibrary} disabled={busy === 'lask'}>{busy === 'lask' ? '…' : 'Ask'}</button>
            </div>
            {libAnswer && <AnswerBlock a={libAnswer} />}
          </section>

          <section className="panel">
            <h2>Compare against references</h2>
            <p className="sub">Give a paper&apos;s ID to summarize its most-cited references into one table of approaches and findings.</p>
            <div className="row">
              <input value={cmpInput} onChange={(e) => setCmpInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runCompare()} placeholder="Paper ID (e.g. 1706.03762)" />
              <button className="btn" onClick={runCompare} disabled={busy === 'cmp'}>{busy === 'cmp' ? '…' : 'Compare'}</button>
            </div>
            {cmpRows && (cmpRows.length ? (
              <div style={{ overflowX: 'auto', marginTop: '.8rem' }}>
                <table className="data">
                  <thead><tr><th>Paper</th><th>Approach</th><th>Finding</th></tr></thead>
                  <tbody>{cmpRows.map((r, i) => <tr key={i}><td style={{ fontWeight: 600 }}>{r.title}</td><td>{r.approach}</td><td>{r.finding}</td></tr>)}</tbody>
                </table>
              </div>
            ) : <p className="help">No references with public abstracts were found for that paper.</p>)}
          </section>
        </div>

        <div>
          <section className="panel">
            <h2>{selected ? selected.title : 'Paper'}</h2>
            {!selected && <div className="empty">Pick a paper from your library to see its summary, trust score, and ask it questions.</div>}
            {busy === 'sum' && <p className="spinner">Reading the full text, summarizing, and scoring faithfulness…</p>}
            {selected && summary && (
              <>
                <TrustMeter score={summary.trust} />
                {summary.unsupported.length > 0 && (
                  <details className="claims">
                    <summary>{summary.unsupported.length} claim(s) the sources don&apos;t clearly support</summary>
                    <ul>{summary.unsupported.map((c, i) => <li key={i}>{c}</li>)}</ul>
                  </details>
                )}
                <article className="prose" style={{ marginTop: '1rem' }}>{summary.text}</article>

                <p className="section-label" style={{ marginTop: '1.6rem' }}>Ask this paper</p>
                <div className="row">
                  <input value={pQuestion} onChange={(e) => setPQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && askPaper()} placeholder="What baseline did they compare against?" />
                  <button className="btn" onClick={askPaper} disabled={busy === 'pask'}>{busy === 'pask' ? '…' : 'Ask'}</button>
                </div>
                {pAnswer && <AnswerBlock a={pAnswer} />}
              </>
            )}
          </section>
        </div>
      </div>

      <p className="footer">Bring your own key · nothing stored · built on arXiv &amp; Semantic Scholar</p>
    </main>
  )
}

function TrustMeter({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="trust na">
        <div className="top"><span className="pct">Not scored</span><span className="cap">trust</span></div>
        <p className="help" style={{ margin: '.4rem 0 0' }}>No source text was available to verify against (abstract-only paper).</p>
      </div>
    )
  }
  const pct = Math.round(score * 100)
  const cls = score >= 0.85 ? 'good' : score >= 0.6 ? 'mid' : 'low'
  return (
    <div className={`trust ${cls}`}>
      <div className="top"><span className="pct">{pct}%</span><span className="cap">claims backed by the source</span></div>
      <div className="track"><div className="fill" style={{ width: `${pct}%` }} /></div>
    </div>
  )
}

function AnswerBlock({ a }: { a: { answer: string; citations: Citation[] } }) {
  return (
    <div className="answer">
      <p className="prose">{a.answer}</p>
      {a.citations.length > 0 && (
        <div className="cites">
          {a.citations.map((c) => (
            <span key={c.marker} className="cite"><b>[{c.marker}]</b> {c.paperTitle} · §{c.section} p{c.page}</span>
          ))}
        </div>
      )}
    </div>
  )
}

function msg(e: unknown) { return e instanceof Error ? e.message : String(e) }

'use client'

import { useCallback, useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PROVIDERS, type ProviderId } from '@/lib/provider-list'

type Paper = { id: string; title: string; authors: string[]; year: number | null; fullTextAvailable: boolean; citationCount: number | null }
type Citation = { marker: string; paperTitle: string; section: string; page: number }
type Metrics = { papers: number; summaries: number; avgTrust: number | null; latency: { action: string; avgMs: number | null; n: number }[] }
type TabId = 'library' | 'ask' | 'compare' | 'metrics'

const EXAMPLES = [
  { label: 'Attention Is All You Need', id: '1706.03762' },
  { label: 'GPT-4 Technical Report', id: '2303.08774' },
  { label: 'AlphaFold (DOI)', id: 'DOI:10.1038/s41586-021-03819-2' },
]
const TABS: { id: TabId; label: string }[] = [
  { id: 'library', label: 'Library' },
  { id: 'ask', label: 'Ask library' },
  { id: 'compare', label: 'Compare' },
  { id: 'metrics', label: 'Metrics' },
]

const VS = [
  ['Reads the abstract you paste in', 'Reads the full PDF, end to end'],
  ['Forgets every conversation', 'Keeps a searchable library'],
  ['“Trust me” — no sources', 'Cites the exact section and page'],
  ['Can’t check its own claims', 'Scores each summary for faithfulness'],
]

const DEMO_PAPER: Paper = { id: 'demo', title: 'Attention Is All You Need', authors: ['Vaswani et al.'], year: 2017, fullTextAvailable: true, citationCount: 170825 }
const DEMO_SUMMARY = `## What is this paper about?
This paper introduces the **Transformer**, a network for sequence tasks (like translation) built entirely on *attention* — a way of letting every word weigh how much to focus on every other word — dropping the recurrent and convolutional layers earlier models relied on. [§Abstract]

## The problem they are solving
Recurrent models read a sentence word by word, which is slow to train and struggles to link words that are far apart. The authors wanted a model that sees the whole sequence at once and trains far faster. [§1 Introduction]

## Their approach
They stack self-attention and feed-forward layers in an encoder–decoder design, use **multi-head attention** so the model can capture several relationships in parallel, and add positional encodings to track word order without recurrence. [§3 Model Architecture]

## Key findings
The Transformer set a new state of the art on English–German (28.4 BLEU) and English–French (41.8 BLEU) translation, while training in a fraction of the time of the previous best models. [§6 Results]

## Why it matters
Nearly every modern large language model — GPT, Claude, Gemini — is built on the Transformer. This is the foundation of the current era of AI.

## Limitations and future directions
Attention cost grows quadratically with sequence length, and the evaluation focuses on translation; the authors suggest extending it to other tasks and modalities. [§7 Conclusion]

## Who should read this?
Anyone entering machine learning or NLP — it is the single most influential architecture paper of the last decade.`
const DEMO_QUESTION = 'What datasets did they evaluate on?'
const DEMO_ANSWER = {
  answer: 'They evaluated on two WMT 2014 machine-translation benchmarks: English-to-German and English-to-French [C1]. The Transformer reached 28.4 BLEU on English-to-German and set a new single-model state of the art of 41.8 BLEU on English-to-French [C1].',
  citations: [{ marker: 'C1', paperTitle: 'Attention Is All You Need', section: '6 Results', page: 8 }],
}

export default function Home() {
  const [provider, setProvider] = useState<ProviderId>('google')
  const [model, setModel] = useState<string>(PROVIDERS.google.models[0])
  const [llmKey, setLlmKey] = useState('')
  const [embKey, setEmbKey] = useState('')

  const [tab, setTab] = useState<TabId>('library')
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

  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [demoActive, setDemoActive] = useState(false)

  const llm = () => ({ provider, model, apiKey: llmKey })

  function loadDemo() {
    setError('')
    setDemoActive(true)
    setTab('library')
    setSelected(DEMO_PAPER)
    setSummary({ text: DEMO_SUMMARY, trust: 0.96, unsupported: [] })
    setPQuestion(DEMO_QUESTION)
    setPAnswer(DEMO_ANSWER)
  }

  const loadPapers = useCallback(async () => {
    try {
      const r = await fetch('/api/papers')
      if (r.ok) setPapers((await r.json()).papers)
    } catch { /* ignore */ }
  }, [])
  useEffect(() => { loadPapers() }, [loadPapers])
  useEffect(() => {
    if (tab === 'metrics') fetch('/api/metrics').then((r) => r.json()).then(setMetrics).catch(() => {})
  }, [tab])

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
    try { await post('/api/ingest', { input, embApiKey: embKey }); setInput(''); await loadPapers() }
    catch (e) { setError(msg(e)) } finally { setBusy('') }
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
    try { setPAnswer(await post('/api/ask', { question: pQuestion, scope: 'paper', paperId: selected.id, embApiKey: embKey, ...llm() })) }
    catch (e) { setError(msg(e)) } finally { setBusy('') }
  }

  async function askLibrary() {
    if (!libQuestion.trim()) return
    setError(''); setBusy('lask'); setLibAnswer(null)
    try { setLibAnswer(await post('/api/ask', { question: libQuestion, scope: 'library', embApiKey: embKey, ...llm() })) }
    catch (e) { setError(msg(e)) } finally { setBusy('') }
  }

  async function runCompare() {
    if (!cmpInput.trim()) return
    setError(''); setBusy('cmp'); setCmpRows(null)
    try { setCmpRows((await post('/api/compare', { input: cmpInput, ...llm() })).rows) }
    catch (e) { setError(msg(e)) } finally { setBusy('') }
  }

  const oneKey = provider === 'google'

  return (
    <main className="wrap">
      <div className="topbar">
        <span className="brand">Research Copilot</span>
        <a className="live" href="https://arxiv.org" target="_blank" rel="noreferrer"><span className="dot" /> bring your own key · nothing stored</a>
      </div>

      <header className="hero">
        <h1>Read papers with receipts.</h1>
        <p>
          Summaries built from a paper&apos;s <b style={{ color: 'var(--text)' }}>full text</b>, answers grounded in the source with
          section-level citations, and a trust score that flags anything the paper doesn&apos;t back up. Everything a general
          chatbot can&apos;t: memory, citations, and a whole library you can question at once.
        </p>

        <div className="vs">
          <div className="vs-col dim">
            <div className="vs-tag">General chatbot</div>
            <ul>{VS.map((r, i) => <li key={i}><span className="mk no">✕</span>{r[0]}</li>)}</ul>
          </div>
          <div className="vs-col lit">
            <div className="vs-tag grad">Research Copilot</div>
            <ul>{VS.map((r, i) => <li key={i}><span className="mk yes">✓</span>{r[1]}</li>)}</ul>
          </div>
        </div>

        <div className="hero-actions">
          <button className="btn primary" onClick={loadDemo}>See a live demo — no key needed</button>
          <span className="help" style={{ margin: 0 }}>or add your keys below to run it for real.</span>
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      {/* Persistent keys */}
      <section className="panel">
        <h2>Your keys</h2>
        <p className="sub">Kept in this browser for the session only — never saved or sent anywhere but the model provider.</p>
        <div className="grid keys">
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
            <span className="lab">Model key — summaries &amp; answers{llmKey.trim() && <span className="set" />}</span>
            <input type="password" value={llmKey} onChange={(e) => setLlmKey(e.target.value)} placeholder={`${PROVIDERS[provider].label} API key`} autoComplete="off" />
          </div>
          <div className="field">
            <span className="lab">Gemini key — search &amp; library, free{embKey.trim() && <span className="set" />}</span>
            <input type="password" value={embKey} onChange={(e) => setEmbKey(e.target.value)} placeholder="Gemini API key" autoComplete="off" />
          </div>
        </div>
        <p className="help">
          The <b>model key</b> runs summaries and answers with the provider you pick. The <b>Gemini key</b> turns papers into searchable
          vectors — free from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">Google AI Studio</a>.
          {oneKey && ' You picked Gemini as your model too, so one key covers both.'}
        </p>
      </section>

      {/* Tabs */}
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className="tab" onClick={() => setTab(t.id)}>
            {t.label}{t.id === 'library' && <span className="count"> ({papers.length})</span>}
          </button>
        ))}
      </div>

      {/* LIBRARY */}
      {tab === 'library' && (
        <>
          <section className="panel">
            <h2>Add a paper</h2>
            <p className="sub">Paste a paper&apos;s identifier. We fetch its full text (or abstract, if that&apos;s all that&apos;s public), index it, and add it to your library.</p>
            <div className="row">
              <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && busy !== 'add' && addPaper()} placeholder="arXiv ID (e.g. 1706.03762), arXiv URL, DOI:10.…, or Semantic Scholar ID" />
              <button className="btn primary" onClick={addPaper} disabled={busy === 'add'}>{busy === 'add' ? 'Adding…' : 'Add to library'}</button>
            </div>
            <div className="examples">
              <span className="section-label" style={{ margin: 0, alignSelf: 'center' }}>Try one:</span>
              {EXAMPLES.map((e) => <button key={e.id} className="example" onClick={() => setInput(e.id)}>{e.label}</button>)}
            </div>
          </section>

          <section className="panel">
            <h2>Library <span style={{ color: 'var(--muted)', fontWeight: 400 }}>({papers.length})</span></h2>
            <p className="sub">Click a paper to summarize it and ask it questions.</p>
            <div className="grid" style={{ gap: '.6rem' }}>
              {(demoActive ? [DEMO_PAPER, ...papers] : papers).map((p) => (
                <button key={p.id} className={`paper-card${selected?.id === p.id ? ' active' : ''}`} onClick={() => (p.id === 'demo' ? loadDemo() : summarize(p))}>
                  <div className="t">{p.title}</div>
                  <div className="m">
                    {p.id === 'demo' && <><span className="badge demo">demo</span> · </>}
                    {p.year ?? '—'} · <span className={`badge ${p.fullTextAvailable ? 'full' : 'abs'}`}>{p.fullTextAvailable ? 'full text' : 'abstract only'}</span>
                    {p.citationCount != null ? ` · ${p.citationCount.toLocaleString()} citations` : ''}
                  </div>
                </button>
              ))}
              {!demoActive && papers.length === 0 && <div className="empty">Your library is empty. Add a paper above to get started.</div>}
            </div>
          </section>

          {selected && (
            <section className="panel">
              <h2>{selected.title}</h2>
              {selected.id === 'demo' && <p className="demo-banner">▸ Sample output — pre-computed, no API key used.</p>}
              {busy === 'sum' && <p className="spinner">Reading the full text, summarizing, and scoring faithfulness…</p>}
              {summary && (
                <>
                  <TrustMeter score={summary.trust} />
                  {summary.unsupported.length > 0 && (
                    <details className="claims">
                      <summary>{summary.unsupported.length} claim(s) the sources don&apos;t clearly support</summary>
                      <ul>{summary.unsupported.map((c, i) => <li key={i}>{c}</li>)}</ul>
                    </details>
                  )}
                  <div style={{ marginTop: '1rem' }}><Md>{summary.text}</Md></div>

                  <p className="section-label" style={{ marginTop: '1.6rem' }}>Ask this paper</p>
                  <div className="row">
                    <input value={pQuestion} onChange={(e) => setPQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && askPaper()} placeholder="What baseline did they compare against?" />
                    <button className="btn" onClick={askPaper} disabled={busy === 'pask'}>{busy === 'pask' ? '…' : 'Ask'}</button>
                  </div>
                  {pAnswer && <AnswerBlock a={pAnswer} />}
                </>
              )}
            </section>
          )}
        </>
      )}

      {/* ASK LIBRARY */}
      {tab === 'ask' && (
        <section className="panel">
          <h2>Ask across your library</h2>
          <p className="sub">One question, answered from every paper you&apos;ve added — with citations naming which paper each answer came from. A chatbot can&apos;t do this; it has no memory of what you&apos;ve read.</p>
          <div className="row">
            <input value={libQuestion} onChange={(e) => setLibQuestion(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && askLibrary()} placeholder="What do my papers say about positional encoding?" />
            <button className="btn primary" onClick={askLibrary} disabled={busy === 'lask'}>{busy === 'lask' ? 'Searching…' : 'Ask'}</button>
          </div>
          {papers.length === 0 && <p className="help">Your library is empty — add papers in the Library tab first.</p>}
          {libAnswer && <AnswerBlock a={libAnswer} />}
        </section>
      )}

      {/* COMPARE */}
      {tab === 'compare' && (
        <section className="panel">
          <h2>Compare against references</h2>
          <p className="sub">Give a paper&apos;s ID and we&apos;ll pull its most-cited references from Semantic Scholar and summarize each into one table of approaches and findings.</p>
          <div className="row">
            <input value={cmpInput} onChange={(e) => setCmpInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && runCompare()} placeholder="Paper ID (e.g. 1706.03762)" />
            <button className="btn primary" onClick={runCompare} disabled={busy === 'cmp'}>{busy === 'cmp' ? 'Comparing…' : 'Compare'}</button>
          </div>
          {cmpRows && (cmpRows.length ? (
            <div style={{ overflowX: 'auto', marginTop: '1rem' }}>
              <table className="data">
                <thead><tr><th>Paper</th><th>Approach</th><th>Finding</th></tr></thead>
                <tbody>{cmpRows.map((r, i) => <tr key={i}><td style={{ fontWeight: 600 }}>{r.title}</td><td>{r.approach}</td><td>{r.finding}</td></tr>)}</tbody>
              </table>
            </div>
          ) : <p className="help">No references with public abstracts were found for that paper.</p>)}
        </section>
      )}

      {/* METRICS */}
      {tab === 'metrics' && (
        <section className="panel">
          <h2>Metrics</h2>
          <p className="sub">What the copilot has done — indexed papers, summaries written, how faithful they were, and how long each step takes.</p>
          {!metrics && <p className="spinner">Loading…</p>}
          {metrics && (
            <>
              <div className="tiles">
                <div className="tile"><div className="v">{metrics.papers}</div><div className="k">papers indexed</div></div>
                <div className="tile"><div className="v">{metrics.summaries}</div><div className="k">summaries</div></div>
                <div className="tile"><div className="v">{metrics.avgTrust === null ? '—' : `${Math.round(metrics.avgTrust * 100)}%`}</div><div className="k">avg trust score</div></div>
              </div>
              <p className="section-label" style={{ marginTop: '1.8rem' }}>Latency by action</p>
              <table className="data">
                <thead><tr><th>Action</th><th>Count</th><th>Avg ms</th></tr></thead>
                <tbody>
                  {metrics.latency.map((l) => <tr key={l.action}><td>{l.action}</td><td>{l.n}</td><td>{l.avgMs ?? '—'}</td></tr>)}
                  {metrics.latency.length === 0 && <tr><td colSpan={3} style={{ color: 'var(--muted)' }}>No activity yet.</td></tr>}
                </tbody>
              </table>
            </>
          )}
        </section>
      )}

      <p className="footer">Bring your own key · nothing stored · built on arXiv &amp; Semantic Scholar</p>
    </main>
  )
}

function Md({ children }: { children: string }) {
  return <div className="md"><ReactMarkdown remarkPlugins={[remarkGfm]}>{children}</ReactMarkdown></div>
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
      <Md>{a.answer}</Md>
      {a.citations.length > 0 && (
        <div className="cites">
          {a.citations.map((c) => <span key={c.marker} className="cite"><b>[{c.marker}]</b> {c.paperTitle} · §{c.section} p{c.page}</span>)}
        </div>
      )}
    </div>
  )
}

function msg(e: unknown) { return e instanceof Error ? e.message : String(e) }

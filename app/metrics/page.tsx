'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

type Metrics = {
  papers: number
  summaries: number
  avgTrust: number | null
  latency: { action: string; avgMs: number | null; n: number }[]
}

export default function MetricsPage() {
  const [m, setM] = useState<Metrics | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    fetch('/api/metrics').then((r) => r.json()).then(setM).catch((e) => setErr(String(e)))
  }, [])

  return (
    <main className="wrap">
      <div className="topbar">
        <span className="brand">Research Copilot</span>
        <Link href="/" className="navlink">← Back</Link>
      </div>

      <header className="hero">
        <h1>Metrics.</h1>
        <p>A live read on what the copilot has done — papers indexed, summaries written, how faithful those summaries were, and how long each step takes.</p>
      </header>

      {err && <div className="error">{err}</div>}
      {!m && !err && <p className="spinner">Loading…</p>}

      {m && (
        <section className="panel">
          <div className="tiles">
            <div className="tile"><div className="v">{m.papers}</div><div className="k">papers indexed</div></div>
            <div className="tile"><div className="v">{m.summaries}</div><div className="k">summaries</div></div>
            <div className="tile"><div className="v">{m.avgTrust === null ? '—' : `${Math.round(m.avgTrust * 100)}%`}</div><div className="k">avg trust score</div></div>
          </div>

          <p className="section-label" style={{ marginTop: '1.8rem' }}>Latency by action</p>
          <table className="data">
            <thead><tr><th>Action</th><th>Count</th><th>Avg ms</th></tr></thead>
            <tbody>
              {m.latency.map((l) => (
                <tr key={l.action}><td>{l.action}</td><td>{l.n}</td><td>{l.avgMs ?? '—'}</td></tr>
              ))}
              {m.latency.length === 0 && <tr><td colSpan={3} style={{ color: 'var(--muted)' }}>No activity yet.</td></tr>}
            </tbody>
          </table>
        </section>
      )}
    </main>
  )
}

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

  const card = 'rounded-lg border border-neutral-200 p-4 dark:border-neutral-800'

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Metrics</h1>
        <Link href="/" className="text-sm text-neutral-500 underline">Back</Link>
      </div>
      {err && <p className="mt-4 text-sm text-red-700">{err}</p>}
      {!m && !err && <p className="mt-4 text-sm text-neutral-500">Loading… (requires the database to be provisioned)</p>}
      {m && (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className={card}><div className="text-2xl font-semibold">{m.papers}</div><div className="text-xs text-neutral-500">papers indexed</div></div>
            <div className={card}><div className="text-2xl font-semibold">{m.summaries}</div><div className="text-xs text-neutral-500">summaries</div></div>
            <div className={card}><div className="text-2xl font-semibold">{m.avgTrust === null ? '—' : `${Math.round(m.avgTrust * 100)}%`}</div><div className="text-xs text-neutral-500">avg trust score</div></div>
          </div>
          <h2 className="mt-8 text-sm font-semibold uppercase tracking-wide text-neutral-500">Latency by action</h2>
          <table className="mt-3 w-full text-sm">
            <thead><tr className="text-left text-neutral-500"><th className="p-1">Action</th><th className="p-1">Count</th><th className="p-1">Avg ms</th></tr></thead>
            <tbody>
              {m.latency.map((l) => (
                <tr key={l.action} className="border-t border-neutral-200 dark:border-neutral-800">
                  <td className="p-1">{l.action}</td><td className="p-1">{l.n}</td><td className="p-1">{l.avgMs ?? '—'}</td>
                </tr>
              ))}
              {m.latency.length === 0 && <tr><td className="p-1 text-neutral-500" colSpan={3}>No activity yet.</td></tr>}
            </tbody>
          </table>
        </>
      )}
    </main>
  )
}

import { useState, useEffect, useCallback } from 'react'

// ── Types ────────────────────────────────────────────────────────────────────

type Layer = 'bronze' | 'silver' | 'gold'
type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE' | 'UNKNOWN'
type AttackVector = 'NETWORK' | 'ADJACENT_NETWORK' | 'LOCAL' | 'PHYSICAL' | 'UNKNOWN'

type NvdCvss31 = {
  cvssData: { baseScore: number; baseSeverity: string; attackVector: string }
}

type NvdCve = {
  id: string
  published: string
  descriptions: Array<{ lang: string; value: string }>
  metrics?: {
    cvssMetricV40?: Array<{ cvssData: { baseScore: number; baseSeverity: string; attackVector: string } }>
    cvssMetricV31?: NvdCvss31[]
    cvssMetricV2?: Array<{ cvssData: { baseScore: number }; baseSeverity?: string }>
  }
  weaknesses?: Array<{ description: Array<{ lang: string; value: string }> }>
}

type NvdResponse = {
  totalResults: number
  vulnerabilities: Array<{ cve: NvdCve }>
}

type CveRecord = {
  id: string
  published: string
  ageDays: number
  description: string
  severity: Severity
  cvssScore: number | null
  attackVector: AttackVector
  cwe: string
}

type SecurityGold = {
  total: number
  criticalCount: number
  highCount: number
  avgCvss: number
  severityDist: Record<Severity, number>
  vectorDist: Record<AttackVector, number>
  topCwes: Array<{ cwe: string; count: number }>
  cvssHistogram: number[]
  topVector: AttackVector
}

// ── Data processing ───────────────────────────────────────────────────────────

function parseSeverity(s: string | undefined): Severity {
  const v = s?.toUpperCase()
  if (v === 'CRITICAL' || v === 'HIGH' || v === 'MEDIUM' || v === 'LOW' || v === 'NONE') return v
  return 'UNKNOWN'
}

function parseVector(s: string | undefined): AttackVector {
  const v = s?.toUpperCase()
  if (v === 'NETWORK') return 'NETWORK'
  if (v === 'LOCAL') return 'LOCAL'
  if (v === 'ADJACENT_NETWORK' || v === 'ADJACENT') return 'ADJACENT_NETWORK'
  if (v === 'PHYSICAL') return 'PHYSICAL'
  return 'UNKNOWN'
}

function toSilver(raw: NvdResponse): CveRecord[] {
  const now = Date.now()
  return raw.vulnerabilities.map(({ cve }) => {
    const m40 = cve.metrics?.cvssMetricV40?.[0]
    const m31 = cve.metrics?.cvssMetricV31?.[0]
    const m2  = cve.metrics?.cvssMetricV2?.[0]
    const cvssScore    = m40?.cvssData.baseScore ?? m31?.cvssData.baseScore ?? m2?.cvssData.baseScore ?? null
    const severity     = parseSeverity(m40?.cvssData.baseSeverity ?? m31?.cvssData.baseSeverity ?? m2?.baseSeverity)
    const attackVector = parseVector(m40?.cvssData.attackVector ?? m31?.cvssData.attackVector)
    const cwe          = cve.weaknesses?.[0]?.description.find(d => d.lang === 'en')?.value ?? 'N/A'
    const description  = cve.descriptions.find(d => d.lang === 'en')?.value ?? ''
    const published    = cve.published.slice(0, 10)
    const ageDays      = Math.floor((now - new Date(published).getTime()) / 86400000)
    return { id: cve.id, published, ageDays, description, severity, cvssScore, attackVector, cwe }
  })
}

function toGold(records: CveRecord[]): SecurityGold {
  const severityDist: Record<Severity, number>     = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0, NONE: 0, UNKNOWN: 0 }
  const vectorDist: Record<AttackVector, number>   = { NETWORK: 0, ADJACENT_NETWORK: 0, LOCAL: 0, PHYSICAL: 0, UNKNOWN: 0 }
  const cweCounts: Record<string, number>          = {}
  const cvssHistogram                              = new Array(10).fill(0)
  let cvssSum = 0, cvssCount = 0

  for (const r of records) {
    severityDist[r.severity]++
    vectorDist[r.attackVector]++
    if (r.cwe !== 'N/A') cweCounts[r.cwe] = (cweCounts[r.cwe] ?? 0) + 1
    if (r.cvssScore !== null) {
      cvssSum += r.cvssScore
      cvssCount++
      cvssHistogram[Math.min(9, Math.floor(r.cvssScore))]++
    }
  }

  const topCwes   = Object.entries(cweCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([cwe, count]) => ({ cwe, count }))
  const topVector = (['NETWORK', 'LOCAL', 'ADJACENT_NETWORK', 'PHYSICAL'] as AttackVector[])
    .reduce((a, b) => vectorDist[a] >= vectorDist[b] ? a : b)

  return {
    total: records.length,
    criticalCount: severityDist.CRITICAL,
    highCount: severityDist.HIGH,
    avgCvss: cvssCount > 0 ? cvssSum / cvssCount : 0,
    severityDist,
    vectorDist,
    topCwes,
    cvssHistogram,
    topVector,
  }
}

// ── Text-to-speech button ─────────────────────────────────────────────────────

function SpeakButton({ text, label = 'Read aloud' }: { text: string; label?: string }) {
  const [speaking, setSpeaking] = useState(false)

  const handle = useCallback(() => {
    if (!('speechSynthesis' in window)) return
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const utt = new SpeechSynthesisUtterance(text)
    utt.onend = () => setSpeaking(false)
    utt.onerror = () => setSpeaking(false)
    window.speechSynthesis.speak(utt)
    setSpeaking(true)
  }, [speaking, text])

  if (!('speechSynthesis' in window)) return null

  return (
    <button
      type="button"
      onClick={handle}
      aria-label={speaking ? 'Stop reading' : label}
      title={speaking ? 'Stop reading' : label}
      className="shrink-0 rounded-lg border border-zinc-600/50 bg-zinc-800/40 px-2.5 py-1 text-xs text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
    >
      {speaking ? '⏹' : '🔊'}
    </button>
  )
}

// ── Severity helpers ──────────────────────────────────────────────────────────

const SEV_BADGE: Record<Severity, string> = {
  CRITICAL: 'text-red-400 border-red-500/40 bg-red-900/20',
  HIGH:     'text-orange-400 border-orange-500/40 bg-orange-900/20',
  MEDIUM:   'text-yellow-400 border-yellow-500/40 bg-yellow-900/20',
  LOW:      'text-blue-400 border-blue-500/40 bg-blue-900/20',
  NONE:     'text-zinc-400 border-zinc-600/40 bg-zinc-800/20',
  UNKNOWN:  'text-zinc-500 border-zinc-700/40 bg-zinc-800/10',
}

const SEV_BAR: Record<Severity, string> = {
  CRITICAL: 'bg-red-500',
  HIGH:     'bg-orange-500',
  MEDIUM:   'bg-yellow-500',
  LOW:      'bg-blue-500',
  NONE:     'bg-zinc-500',
  UNKNOWN:  'bg-zinc-700',
}

// ── Gold view components ──────────────────────────────────────────────────────

function StatCard({ label, value, sub, ttsText }: { label: string; value: string; sub?: string; ttsText: string }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-zinc-700/50 bg-zinc-800/50 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
        <SpeakButton text={ttsText} label={`Read ${label}`} />
      </div>
      <p className="text-3xl font-bold text-zinc-100">{value}</p>
      {sub && <p className="text-sm text-zinc-400">{sub}</p>}
    </div>
  )
}

function SeverityBars({ dist }: { dist: Record<Severity, number> }) {
  const order: Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'NONE']
  const max = Math.max(...order.map(s => dist[s]), 1)
  return (
    <div className="space-y-3">
      {order.map(s => (
        <div key={s} className="flex items-center gap-3">
          <span className={`w-20 shrink-0 rounded border px-2 py-0.5 text-center text-xs font-semibold ${SEV_BADGE[s]}`}>{s}</span>
          <div className="flex-1 rounded-full bg-zinc-800/80">
            <div
              className={`h-3 rounded-full transition-all duration-500 ${SEV_BAR[s]}`}
              style={{ width: `${(dist[s] / max) * 100}%`, minWidth: dist[s] > 0 ? '4px' : '0' }}
            />
          </div>
          <span className="w-10 text-right text-sm font-semibold text-zinc-300">{dist[s]}</span>
        </div>
      ))}
    </div>
  )
}

function CvssHistogram({ histogram }: { histogram: number[] }) {
  const max = Math.max(...histogram, 1)
  const labels = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9+']
  const colors = ['#22c55e','#22c55e','#84cc16','#84cc16','#eab308','#eab308','#f97316','#f97316','#ef4444','#ef4444']
  return (
    <div className="flex items-end gap-1" style={{ height: '80px' }}>
      {histogram.map((count, i) => (
        <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
          <div
            className="w-full rounded-t transition-all duration-500"
            style={{
              height: `${(count / max) * 64}px`,
              backgroundColor: colors[i],
              opacity: 0.85,
              minHeight: count > 0 ? '4px' : '0',
            }}
          />
          <span className="text-[10px] text-zinc-500">{labels[i]}</span>
        </div>
      ))}
    </div>
  )
}

function AttackVectorBars({ dist }: { dist: Record<AttackVector, number> }) {
  const order: AttackVector[] = ['NETWORK', 'LOCAL', 'ADJACENT_NETWORK', 'PHYSICAL']
  const labels: Record<AttackVector, string> = {
    NETWORK: 'Network', LOCAL: 'Local', ADJACENT_NETWORK: 'Adjacent', PHYSICAL: 'Physical', UNKNOWN: 'Unknown',
  }
  const max = Math.max(...order.map(v => dist[v]), 1)
  return (
    <div className="space-y-3">
      {order.map(v => (
        <div key={v} className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-sm text-zinc-400">{labels[v]}</span>
          <div className="flex-1 rounded-full bg-zinc-800/80">
            <div
              className="h-3 rounded-full bg-sky-500 transition-all duration-500"
              style={{ width: `${(dist[v] / max) * 100}%`, opacity: 0.8, minWidth: dist[v] > 0 ? '4px' : '0' }}
            />
          </div>
          <span className="w-10 text-right text-sm font-semibold text-zinc-300">{dist[v]}</span>
        </div>
      ))}
    </div>
  )
}

function GoldView({ gold, windowDays }: { gold: SecurityGold; windowDays: number }) {
  const summary = `Security intelligence summary for the past ${windowDays} days. ${gold.total} vulnerabilities published. ${gold.criticalCount} critical severity. ${gold.highCount} high severity. Average CVSS score ${gold.avgCvss.toFixed(1)} out of 10. Top attack vector: ${gold.topVector.toLowerCase()}.`

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded border border-amber-600/40 bg-amber-900/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-amber-300">Aggregated</span>
        <span className="rounded border border-zinc-700/40 bg-zinc-800/40 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Analytics-ready</span>
        <span className="rounded border border-zinc-700/40 bg-zinc-800/40 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{gold.total} CVEs · {windowDays}d</span>
        <SpeakButton text={summary} label="Read full summary" />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Total CVEs"
          value={gold.total.toString()}
          sub={`Past ${windowDays} days`}
          ttsText={`${gold.total} vulnerabilities published in the last ${windowDays} days.`}
        />
        <StatCard
          label="Critical"
          value={gold.criticalCount.toString()}
          sub="CVSS ≥ 9.0"
          ttsText={`${gold.criticalCount} critical severity vulnerabilities with CVSS score 9 or above.`}
        />
        <StatCard
          label="Avg CVSS"
          value={gold.avgCvss.toFixed(1)}
          sub="Base score / 10"
          ttsText={`Average CVSS base score is ${gold.avgCvss.toFixed(1)} out of 10.`}
        />
        <StatCard
          label="Top vector"
          value={gold.topVector === 'ADJACENT_NETWORK' ? 'Adjacent' : gold.topVector.charAt(0) + gold.topVector.slice(1).toLowerCase()}
          sub="Attack origin"
          ttsText={`The most common attack vector is ${gold.topVector.toLowerCase().replace('_', ' ')}.`}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-4">
          <h3 className="mb-4 text-sm font-semibold text-zinc-300">Severity distribution</h3>
          <SeverityBars dist={gold.severityDist} />
        </div>
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-4">
          <h3 className="mb-4 text-sm font-semibold text-zinc-300">CVSS score histogram</h3>
          <CvssHistogram histogram={gold.cvssHistogram} />
          <p className="mt-2 text-center text-xs text-zinc-600">Score buckets 0 → 10</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-4">
          <h3 className="mb-4 text-sm font-semibold text-zinc-300">Attack vectors</h3>
          <AttackVectorBars dist={gold.vectorDist} />
        </div>
        <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-4">
          <h3 className="mb-4 text-sm font-semibold text-zinc-300">Top weakness types</h3>
          <div className="space-y-2">
            {gold.topCwes.length === 0
              ? <p className="text-sm text-zinc-600">No CWE data available.</p>
              : gold.topCwes.map(({ cwe, count }) => (
                <div key={cwe} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-zinc-400">{cwe}</span>
                  <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs font-semibold text-zinc-300">{count}</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Silver view ───────────────────────────────────────────────────────────────

function SilverView({ records }: { records: CveRecord[] }) {
  const [showAll, setShowAll] = useState(false)
  const LIMIT = 15
  const visible = showAll ? records : records.slice(0, LIMIT)

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <span className="rounded border border-zinc-500/40 bg-zinc-700/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-300">Parsed</span>
        <span className="rounded border border-zinc-700/40 bg-zinc-800/40 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">Typed · {records.length} records</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-800/60 bg-zinc-950">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800/60 text-left text-zinc-500">
              <th className="px-3 py-2.5 font-medium">CVE ID</th>
              <th className="px-3 py-2.5 font-medium">Severity</th>
              <th className="px-3 py-2.5 font-medium">CVSS</th>
              <th className="px-3 py-2.5 font-medium">Vector</th>
              <th className="px-3 py-2.5 font-medium">CWE</th>
              <th className="px-3 py-2.5 font-medium">Age</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {visible.map((r) => (
              <tr key={r.id} className="text-zinc-300 hover:bg-zinc-900/40">
                <td className="px-3 py-2 font-mono text-xs text-zinc-400">{r.id}</td>
                <td className="px-3 py-2">
                  <span className={`rounded border px-1.5 py-0.5 text-xs font-semibold ${SEV_BADGE[r.severity]}`}>
                    {r.severity}
                  </span>
                </td>
                <td className="px-3 py-2 font-mono">{r.cvssScore?.toFixed(1) ?? '–'}</td>
                <td className="px-3 py-2 text-xs text-zinc-400">{r.attackVector}</td>
                <td className="px-3 py-2 text-xs text-zinc-400">{r.cwe}</td>
                <td className="px-3 py-2 text-xs text-zinc-500">{r.ageDays}d</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {records.length > LIMIT && (
        <button onClick={() => setShowAll(v => !v)} className="mt-2 text-sm text-zinc-500 hover:text-zinc-300">
          {showAll ? '▲ collapse' : `▼ show all ${records.length} records`}
        </button>
      )}
    </div>
  )
}

// ── Bronze view ───────────────────────────────────────────────────────────────

function BronzeView({ raw }: { raw: NvdResponse }) {
  const preview = { ...raw, vulnerabilities: raw.vulnerabilities.slice(0, 2) }
  const text = JSON.stringify(preview, null, 2)
  const lines = text.split('\n')
  const LIMIT = 50
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? lines : lines.slice(0, LIMIT)

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <span className="rounded border border-orange-700/40 bg-orange-900/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-orange-300">Raw</span>
        <span className="rounded border border-zinc-700/40 bg-zinc-800/40 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">NVD API v2.0</span>
        <span className="rounded border border-zinc-700/40 bg-zinc-800/40 px-2.5 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">{raw.totalResults.toLocaleString()} total results</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-800/60 bg-zinc-950">
        <pre className="p-4 text-xs leading-relaxed text-zinc-300">
          {visible.join('\n')}
          {!showAll && lines.length > LIMIT && (
            <span className="text-zinc-600">{'\n'}… showing 2 of {raw.vulnerabilities.length} fetched records</span>
          )}
        </pre>
      </div>
      {lines.length > LIMIT && (
        <button onClick={() => setShowAll(v => !v)} className="mt-2 text-sm text-zinc-500 hover:text-zinc-300">
          {showAll ? '▲ collapse' : '▼ show full JSON'}
        </button>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const WINDOW_DAYS = 30

function buildNvdUrl() {
  const end   = new Date()
  const start = new Date(end.getTime() - WINDOW_DAYS * 86400000)
  const fmt   = (d: Date) => d.toISOString().replace(/\.\d{3}Z$/, '.000')
  return (
    'https://services.nvd.nist.gov/rest/json/cves/2.0' +
    `?resultsPerPage=100&pubStartDate=${fmt(start)}&pubEndDate=${fmt(end)}`
  )
}

const LAYERS: { id: Layer; label: string }[] = [
  { id: 'bronze', label: 'Bronze' },
  { id: 'silver', label: 'Silver' },
  { id: 'gold',   label: 'Gold'   },
]

export function MedallionDemo({ defaultLayer = 'gold' as Layer }: { defaultLayer?: Layer } = {}) {
  const [activeLayer, setActiveLayer] = useState<Layer>(defaultLayer)
  const [raw, setRaw] = useState<NvdResponse | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(buildNvdUrl(), { signal: AbortSignal.timeout(15000) })
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then((data: NvdResponse) => setRaw(data))
      .catch(() => setError(true))
  }, [])

  const silver = raw ? toSilver(raw) : []
  const gold   = toGold(silver)

  return (
    <section className="forge-panel overflow-hidden rounded-2xl border border-zinc-500/30 bg-zinc-900/80 backdrop-blur-xl">
      <div className="border-b border-zinc-700/40 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">Security Intelligence Pipeline</h2>
            <p className="mt-0.5 text-sm text-zinc-500">NVD CVE data · NIST API · Bronze → Silver → Gold</p>
            <p className="mt-2 max-w-md text-sm text-zinc-400">
              Live CVE feed from NIST — the same database security teams use to track software vulnerabilities.
              <span className="text-zinc-500"> Bronze</span> shows raw API records,
              <span className="text-zinc-500"> Silver</span> parses and classifies them,
              <span className="text-zinc-500"> Gold</span> aggregates into charts a security team would act on.
            </p>
          </div>
          <div className="flex gap-1 rounded-lg border border-zinc-700/40 bg-zinc-900/60 p-0.5">
            {LAYERS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveLayer(id)}
                className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                  activeLayer === id
                    ? 'border border-amber-400/50 bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-100'
                    : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="p-5">
        {error && <p className="text-sm text-zinc-500">Could not load data from NVD API. Try refreshing.</p>}
        {!raw && !error && (
          <div className="flex flex-col gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-6 animate-pulse rounded bg-zinc-800/60" style={{ width: `${60 + i * 9}%` }} />
            ))}
          </div>
        )}
        {raw && !error && (
          <>
            {activeLayer === 'bronze' && <BronzeView raw={raw} />}
            {activeLayer === 'silver' && <SilverView records={silver} />}
            {activeLayer === 'gold'   && <GoldView gold={gold} windowDays={WINDOW_DAYS} />}
          </>
        )}
      </div>
    </section>
  )
}

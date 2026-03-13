import { useState, useEffect } from 'react'

// ── Types ──────────────────────────────────────────────────────────────────

type Layer = 'bronze' | 'silver' | 'gold'

type OpenMeteoResponse = {
  latitude: number
  longitude: number
  timezone: string
  hourly_units: { time: string; temperature_2m: string; precipitation_probability: string; windspeed_10m: string }
  hourly: {
    time: string[]
    temperature_2m: (number | null)[]
    precipitation_probability: (number | null)[]
    windspeed_10m: (number | null)[]
  }
}

type HourlyRecord = {
  time: string
  temp: number
  precip: number
  wind: number
}

type DailyAggregate = {
  date: string
  min: number
  max: number
  avg: number
  maxPrecip: number
  avgWind: number
}

// ── Data processing ────────────────────────────────────────────────────────

function toSilver(raw: OpenMeteoResponse): HourlyRecord[] {
  const now = Date.now()
  return raw.hourly.time
    .map((t, i) => ({
      time: t,
      temp: raw.hourly.temperature_2m[i] ?? NaN,
      precip: raw.hourly.precipitation_probability[i] ?? 0,
      wind: raw.hourly.windspeed_10m[i] ?? 0,
    }))
    .filter((r) => !isNaN(r.temp) && new Date(r.time).getTime() <= now)
}

function toGold(records: HourlyRecord[]): DailyAggregate[] {
  const byDate = new Map<string, number[]>()
  const precipByDate = new Map<string, number>()
  const windByDate = new Map<string, number[]>()

  for (const r of records) {
    const date = r.time.slice(0, 10)
    if (!byDate.has(date)) {
      byDate.set(date, [])
      precipByDate.set(date, 0)
      windByDate.set(date, [])
    }
    byDate.get(date)!.push(r.temp)
    precipByDate.set(date, Math.max(precipByDate.get(date)!, r.precip))
    windByDate.get(date)!.push(r.wind)
  }

  return Array.from(byDate.entries()).map(([date, temps]) => {
    const winds = windByDate.get(date) ?? []
    return {
      date,
      min: Math.min(...temps),
      max: Math.max(...temps),
      avg: temps.reduce((a, b) => a + b, 0) / temps.length,
      maxPrecip: precipByDate.get(date) ?? 0,
      avgWind: winds.length > 0 ? winds.reduce((a, b) => a + b, 0) / winds.length : 0,
    }
  })
}

// ── Shared chart constants ─────────────────────────────────────────────────

const CHART_W = 560
const CHART_PAD = { top: 16, right: 12, bottom: 36, left: 36 }

function chartToX(i: number, total: number) {
  const inner = CHART_W - CHART_PAD.left - CHART_PAD.right
  return CHART_PAD.left + (i + 0.5) * (inner / total)
}

// ── TempChart ──────────────────────────────────────────────────────────────

function TempChart({
  days,
  hoveredIdx,
  onHover,
}: {
  days: DailyAggregate[]
  hoveredIdx: number | null
  onHover: (idx: number | null) => void
}) {
  if (days.length === 0) return null

  const W = CHART_W
  const H = 200
  const PAD = CHART_PAD
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  const allTemps = days.flatMap((d) => [d.min, d.max])
  const rawMin = Math.min(...allTemps)
  const rawMax = Math.max(...allTemps)
  const yMin = Math.floor((rawMin - 2) / 5) * 5
  const yMax = Math.ceil((rawMax + 2) / 5) * 5

  const toY = (v: number) => PAD.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH
  const barW = Math.min(32, (chartW / days.length) * 0.55)
  const toX = (i: number) => chartToX(i, days.length)

  const gridLines: number[] = []
  for (let t = yMin; t <= yMax; t += 5) gridLines.push(t)

  const fmt = (iso: string) => {
    const d = new Date(iso + 'T12:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full"
      aria-label="Daily temperature range chart"
      onMouseLeave={() => onHover(null)}
    >
      {/* Grid lines */}
      {gridLines.map((t) => (
        <g key={t}>
          <line
            x1={PAD.left} y1={toY(t)} x2={W - PAD.right} y2={toY(t)}
            stroke="#3f3f46" strokeWidth="1"
          />
          <text x={PAD.left - 4} y={toY(t) + 4} textAnchor="end" fontSize="9" fill="#71717a">
            {t}°
          </text>
        </g>
      ))}

      {/* Bars + dots */}
      {days.map((d, i) => {
        const x = toX(i)
        const y1 = toY(d.max)
        const y2 = toY(d.min)
        const yAvg = toY(d.avg)
        const isWarm = d.avg > 15
        const barColor = isWarm ? '#f59e0b' : '#38bdf8'
        const precipH = (d.maxPrecip / 100) * chartH * 0.18
        const dimmed = hoveredIdx !== null && hoveredIdx !== i
        return (
          <g
            key={d.date}
            style={{ opacity: dimmed ? 0.3 : 1, cursor: 'crosshair' }}
            onMouseEnter={() => onHover(i)}
          >
            {/* Wide transparent hit area */}
            <rect
              x={x - barW * 1.5} y={PAD.top}
              width={barW * 3} height={chartH}
              fill="transparent"
            />
            {/* Precipitation base */}
            <rect
              x={x - barW / 2} y={toY(yMin) - precipH}
              width={barW} height={precipH}
              fill="#818cf8" opacity={0.35}
              rx="2"
            />
            {/* Temp range bar */}
            <rect
              x={x - barW / 2} y={y1}
              width={barW} height={Math.max(y2 - y1, 2)}
              fill={barColor} opacity={hoveredIdx === i ? 1 : 0.7}
              rx="3"
            />
            {/* Avg dot */}
            <circle cx={x} cy={yAvg} r="3.5" fill={barColor} stroke="#18181b" strokeWidth="1.5" />
          </g>
        )
      })}

      {/* X-axis labels */}
      {days.map((d, i) => (
        <text key={d.date} x={toX(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#a1a1aa">
          {fmt(d.date)}
        </text>
      ))}

      {/* Legend */}
      <rect x={PAD.left} y={PAD.top - 10} width={8} height={8} fill="#f59e0b" opacity={0.7} rx="1" />
      <text x={PAD.left + 11} y={PAD.top - 3} fontSize="9" fill="#a1a1aa">warm</text>
      <rect x={PAD.left + 46} y={PAD.top - 10} width={8} height={8} fill="#38bdf8" opacity={0.7} rx="1" />
      <text x={PAD.left + 59} y={PAD.top - 3} fontSize="9" fill="#a1a1aa">cool</text>
      <rect x={PAD.left + 96} y={PAD.top - 10} width={8} height={8} fill="#818cf8" opacity={0.35} rx="1" />
      <text x={PAD.left + 109} y={PAD.top - 3} fontSize="9" fill="#a1a1aa">precip %</text>
    </svg>
  )
}

// ── WindChart ──────────────────────────────────────────────────────────────

function WindChart({ days }: { days: DailyAggregate[] }) {
  if (days.length === 0) return null

  const W = CHART_W
  const H = 90
  const PAD = { top: 20, right: CHART_PAD.right, bottom: 8, left: CHART_PAD.left }
  const chartH = H - PAD.top - PAD.bottom

  const maxWind = Math.max(...days.map((d) => d.avgWind), 10)
  const yMax = Math.ceil(maxWind / 10) * 10

  const toX = (i: number) => chartToX(i, days.length)
  const toY = (v: number) => PAD.top + chartH - (v / yMax) * chartH

  const gridLines: number[] = []
  for (let t = 0; t <= yMax; t += 10) gridLines.push(t)

  const points = days.map((d, i) => `${toX(i)},${toY(d.avgWind)}`).join(' ')

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Daily avg wind speed chart">
      {gridLines.map((t) => (
        <g key={t}>
          <line
            x1={PAD.left} y1={toY(t)} x2={W - PAD.right} y2={toY(t)}
            stroke="#3f3f46" strokeWidth="1"
          />
          <text x={PAD.left - 4} y={toY(t) + 4} textAnchor="end" fontSize="9" fill="#71717a">
            {t}
          </text>
        </g>
      ))}
      <text x={PAD.left} y={PAD.top - 6} fontSize="9" fill="#71717a">Avg wind km/h</text>
      <polyline
        points={points}
        fill="none"
        stroke="#38bdf8"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      {days.map((d, i) => (
        <circle
          key={d.date}
          cx={toX(i)} cy={toY(d.avgWind)}
          r="2.5"
          fill="#38bdf8"
          stroke="#18181b"
          strokeWidth="1"
        />
      ))}
    </svg>
  )
}

// ── Stat cards ─────────────────────────────────────────────────────────────

function StatCards({ days }: { days: DailyAggregate[] }) {
  if (days.length === 0) return null

  const coldest = days.reduce((a, b) => (a.min <= b.min ? a : b))
  const warmest = days.reduce((a, b) => (a.max >= b.max ? a : b))
  const wettest = days.reduce((a, b) => (a.maxPrecip >= b.maxPrecip ? a : b))

  const fmt = (iso: string) => {
    const d = new Date(iso + 'T12:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div className="mb-3 grid grid-cols-3 gap-2">
      <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-2.5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Coldest</p>
        <p className="mt-0.5 text-[11px] text-zinc-400">{fmt(coldest.date)}</p>
        <p className="text-sm font-semibold text-sky-400">{coldest.min.toFixed(1)}°C</p>
      </div>
      <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-2.5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Warmest</p>
        <p className="mt-0.5 text-[11px] text-zinc-400">{fmt(warmest.date)}</p>
        <p className="text-sm font-semibold text-amber-400">{warmest.max.toFixed(1)}°C</p>
      </div>
      <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-2.5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">Wettest</p>
        <p className="mt-0.5 text-[11px] text-zinc-400">{fmt(wettest.date)}</p>
        <p className="text-sm font-semibold text-indigo-400">{wettest.maxPrecip}%</p>
      </div>
    </div>
  )
}

// ── GoldView ───────────────────────────────────────────────────────────────

function GoldView({ days }: { days: DailyAggregate[] }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  const tooltipLeftPct =
    hoveredIdx !== null
      ? Math.min(92, Math.max(8, (chartToX(hoveredIdx, days.length) / CHART_W) * 100))
      : 50

  const hovered = hoveredIdx !== null ? days[hoveredIdx] : null

  const fmt = (iso: string) => {
    const d = new Date(iso + 'T12:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <span className="rounded border border-amber-600/40 bg-amber-900/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">Aggregated</span>
        <span className="rounded border border-zinc-700/40 bg-zinc-800/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Analytics-Ready</span>
        <span className="rounded border border-zinc-700/40 bg-zinc-800/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">{days.length} days</span>
      </div>
      <StatCards days={days} />
      <div className="rounded-xl border border-zinc-800/60 bg-zinc-950 p-4">
        <div className="relative">
          <TempChart days={days} hoveredIdx={hoveredIdx} onHover={setHoveredIdx} />
          {hovered && (
            <div
              className="pointer-events-none absolute top-3 z-10 rounded-lg border border-zinc-700/60 bg-zinc-900/95 px-3 py-2 text-xs shadow-xl backdrop-blur"
              style={{ left: `${tooltipLeftPct}%`, transform: 'translateX(-50%)' }}
            >
              <p className="mb-1 font-semibold text-zinc-100">{fmt(hovered.date)}</p>
              <p className="text-zinc-400">Min <span className="font-mono text-sky-400">{hovered.min.toFixed(1)}°C</span></p>
              <p className="text-zinc-400">Max <span className="font-mono text-amber-400">{hovered.max.toFixed(1)}°C</span></p>
              <p className="text-zinc-400">Avg <span className="font-mono text-zinc-200">{hovered.avg.toFixed(1)}°C</span></p>
              <p className="text-zinc-400">Precip <span className="font-mono text-indigo-300">{hovered.maxPrecip}%</span></p>
            </div>
          )}
        </div>
        <WindChart days={days} />
        <p className="mt-2 text-center text-[10px] text-zinc-600">
          Bars: daily temperature range (min→max) · Dot: avg °C · Indigo base: precip % · Line: avg wind km/h
        </p>
      </div>
    </div>
  )
}

// ── Layer content ──────────────────────────────────────────────────────────

function BronzeView({ raw }: { raw: unknown }) {
  const text = JSON.stringify(raw, null, 2)
  const lines = text.split('\n')
  const LIMIT = 42
  const [showAll, setShowAll] = useState(false)
  const visible = showAll ? lines : lines.slice(0, LIMIT)
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <span className="rounded border border-orange-700/40 bg-orange-900/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-300">Raw</span>
        <span className="rounded border border-zinc-700/40 bg-zinc-800/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">JSON</span>
        <span className="rounded border border-zinc-700/40 bg-zinc-800/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Unprocessed</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-800/60 bg-zinc-950">
        <pre className="p-4 text-[11px] leading-relaxed text-zinc-300">
          {visible.join('\n')}
          {!showAll && lines.length > LIMIT && (
            <span className="text-zinc-600">{'\n'}… {lines.length - LIMIT} more lines</span>
          )}
        </pre>
      </div>
      {lines.length > LIMIT && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 text-xs text-zinc-500 hover:text-zinc-300"
        >
          {showAll ? '▲ collapse' : `▼ show all ${lines.length} lines`}
        </button>
      )}
    </div>
  )
}

function SilverView({ records }: { records: HourlyRecord[] }) {
  const [showAll, setShowAll] = useState(false)
  const LIMIT = 24
  const visible = showAll ? records : records.slice(0, LIMIT)
  return (
    <div>
      <div className="mb-2 flex flex-wrap gap-1.5">
        <span className="rounded border border-zinc-500/40 bg-zinc-700/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-300">Parsed</span>
        <span className="rounded border border-zinc-700/40 bg-zinc-800/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Typed</span>
        <span className="rounded border border-zinc-700/40 bg-zinc-800/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">Filtered · {records.length} records</span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-zinc-800/60 bg-zinc-950">
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-zinc-800/60 text-left text-zinc-500">
              <th className="px-3 py-2 font-medium">Time</th>
              <th className="px-3 py-2 font-medium">Temp °C</th>
              <th className="px-3 py-2 font-medium">Precip %</th>
              <th className="px-3 py-2 font-medium">Wind km/h</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/40">
            {visible.map((r) => (
              <tr key={r.time} className="text-zinc-300 hover:bg-zinc-900/40">
                <td className="px-3 py-1.5 text-zinc-400">{r.time.replace('T', ' ')}</td>
                <td className="px-3 py-1.5 font-mono">{r.temp.toFixed(1)}</td>
                <td className="px-3 py-1.5 font-mono">{r.precip}</td>
                <td className="px-3 py-1.5 font-mono">{r.wind.toFixed(1)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {records.length > LIMIT && (
        <button
          onClick={() => setShowAll((v) => !v)}
          className="mt-2 text-xs text-zinc-500 hover:text-zinc-300"
        >
          {showAll ? '▲ collapse' : `▼ show all ${records.length} records`}
        </button>
      )}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

const OPEN_METEO_URL =
  'https://api.open-meteo.com/v1/forecast?latitude=40.71&longitude=-74.01' +
  '&hourly=temperature_2m,precipitation_probability,windspeed_10m' +
  '&past_days=7&forecast_days=1&timezone=America%2FNew_York'

const LAYERS: { id: Layer; label: string }[] = [
  { id: 'bronze', label: 'Bronze' },
  { id: 'silver', label: 'Silver' },
  { id: 'gold',   label: 'Gold' },
]

export function MedallionDemo({ defaultLayer = 'bronze' as Layer }: { defaultLayer?: Layer } = {}) {
  const [activeLayer, setActiveLayer] = useState<Layer>(defaultLayer)
  const [raw, setRaw] = useState<OpenMeteoResponse | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    fetch(OPEN_METEO_URL, { signal: AbortSignal.timeout(10000) })
      .then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((data: OpenMeteoResponse) => setRaw(data))
      .catch(() => setError(true))
  }, [])

  const silver = raw ? toSilver(raw) : []
  const gold = toGold(silver)

  return (
    <section className="forge-panel overflow-hidden rounded-2xl border border-zinc-500/30 bg-zinc-900/80 backdrop-blur-xl">
      {/* Header */}
      <div className="border-b border-zinc-700/40 px-5 py-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-white">Live Pipeline Demo</h2>
            <p className="mt-0.5 text-xs text-zinc-500">
              NYC weather · Open-Meteo API · Bronze → Silver → Gold
            </p>
          </div>
          {/* Layer tabs */}
          <div className="flex gap-1 rounded-lg border border-zinc-700/40 bg-zinc-900/60 p-0.5">
            {LAYERS.map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setActiveLayer(id)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition ${
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

      {/* Content */}
      <div className="p-5">
        {error && (
          <p className="text-sm text-zinc-500">Could not load data from Open-Meteo API.</p>
        )}
        {!raw && !error && (
          <div className="flex flex-col gap-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-5 animate-pulse rounded bg-zinc-800/60" style={{ width: `${70 + i * 8}%` }} />
            ))}
          </div>
        )}
        {raw && !error && (
          <>
            {activeLayer === 'bronze' && <BronzeView raw={raw} />}
            {activeLayer === 'silver' && <SilverView records={silver} />}
            {activeLayer === 'gold'   && <GoldView days={gold} />}
          </>
        )}
      </div>
    </section>
  )
}

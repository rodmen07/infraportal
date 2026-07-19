import { PageLayout } from './PageLayout'
import {
  GROUP_META,
  VERSIONS,
  type CompletionState,
  type Severity,
  type Version,
} from './patchNotesData'

const SEVERITY_STYLES: Record<Severity, string> = {
  'high':        'bg-red-500/15 text-red-300 border-red-500/30',
  'medium-high': 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  'medium':      'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  'low-medium':  'bg-zinc-500/15 text-zinc-300 border-zinc-500/30',
}

const COMPLETION_STYLES: Record<CompletionState, { badge: string; label: string }> = {
  planned:     { badge: 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/30',    label: 'Planned' },
  implemented: { badge: 'bg-blue-500/15 text-blue-300 ring-blue-500/30',    label: 'Implemented' },
  published:   { badge: 'bg-green-500/15 text-green-300 ring-green-500/30', label: 'Published' },
}

function SeverityBadge({ severity }: { severity: Severity }) {
  const label: Record<Severity, string> = {
    'high':        'HIGH',
    'medium-high': 'MED-HIGH',
    'medium':      'MED',
    'low-medium':  'LOW-MED',
  }
  return (
    <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold tracking-wide ${SEVERITY_STYLES[severity]}`}>
      {label[severity]}
    </span>
  )
}

function CompletionBadge({ state }: { state: CompletionState }) {
  const { badge, label } = COMPLETION_STYLES[state]
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${badge}`}>
      {label}
    </span>
  )
}

function GroupHeader({ group }: { group: string }) {
  const meta = GROUP_META[group]
  if (!meta) return null
  return (
    <div className="flex items-center gap-3 px-1">
      <span className="rounded-xl bg-amber-500/10 px-3 py-1 text-base font-bold text-amber-400 ring-1 ring-amber-500/20">
        {group}
      </span>
      <span className="text-sm font-semibold text-zinc-300">{meta.label}</span>
      <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-medium text-blue-300 ring-1 ring-blue-500/30">
        {meta.status}
      </span>
      <div className="flex-1 border-t border-zinc-700/40" />
    </div>
  )
}

function VersionCard({ version, isLatest }: { version: Version; isLatest: boolean }) {
  const isUpcoming = version.status === 'upcoming'

  return (
    <article className={`forge-panel surface-card-strong rounded-3xl p-6 shadow-2xl shadow-black/50 ${isUpcoming ? 'border border-dashed border-zinc-600/50' : ''}`}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-xl px-3 py-1 text-lg font-bold ring-1 ${isUpcoming ? 'bg-zinc-700/30 text-zinc-400 ring-zinc-600/40' : 'bg-amber-500/15 text-amber-300 ring-amber-500/30'}`}>
              {version.tag}
            </span>
            {isUpcoming && (
              <span className="rounded-full bg-blue-500/15 px-2.5 py-0.5 text-xs font-medium text-blue-300 ring-1 ring-blue-500/30">
                Upcoming
              </span>
            )}
            {isLatest && (
              <span className="rounded-full bg-green-500/15 px-2.5 py-0.5 text-xs font-medium text-green-300 ring-1 ring-green-500/30">
                Latest
              </span>
            )}
            <span className="text-sm font-semibold text-zinc-200">{version.label}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <p className="text-xs text-zinc-500">{version.date}</p>
            <CompletionBadge state={version.completionState} />
          </div>
        </div>
        <a
          href={`https://github.com/rodmen07/portfolio/releases/tag/${version.tag}`}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-neutral px-3 py-1.5 text-xs"
        >
          GitHub release ↗
        </a>
      </div>

      <p className="mt-4 text-sm leading-relaxed text-zinc-300">{version.summary}</p>

      {/* Change highlights */}
      <div className="mt-6 space-y-5">
        {version.highlights.map((group) => (
          <div key={group.heading}>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-amber-400/70">
              {group.heading}
            </h3>
            <ul className="space-y-1.5">
              {group.items.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-zinc-300">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-500/60" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Findings table (v0.2 only) */}
      {version.findings && (
        <div className="mt-6">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-amber-400/70">
            Findings Addressed
          </h3>
          <div className="overflow-x-auto rounded-xl border border-zinc-700/40">
            <table className="w-full min-w-[560px] text-xs">
              <thead>
                <tr className="border-b border-zinc-700/40 text-left text-zinc-500">
                  <th className="px-3 py-2 font-medium">ID</th>
                  <th className="px-3 py-2 font-medium">Finding</th>
                  <th className="px-3 py-2 font-medium">Severity</th>
                  <th className="px-3 py-2 font-medium">OWASP</th>
                  <th className="px-3 py-2 font-medium">Resolution</th>
                </tr>
              </thead>
              <tbody>
                {version.findings.map((f, i) => (
                  <tr
                    key={f.id}
                    className={`border-b border-zinc-700/20 ${i % 2 === 0 ? 'bg-zinc-800/20' : ''}`}
                  >
                    <td className="px-3 py-2 font-mono text-zinc-400">{f.id}</td>
                    <td className="px-3 py-2 text-zinc-200">{f.title}</td>
                    <td className="px-3 py-2"><SeverityBadge severity={f.severity} /></td>
                    <td className="px-3 py-2 text-zinc-400">{f.category}</td>
                    <td className="px-3 py-2 text-zinc-300">{f.resolution}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Positive controls (v0.1 only) */}
      {version.positive && (
        <div className="mt-6">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-widest text-green-400/70">
            Security Controls Already in Place
          </h3>
          <ul className="space-y-1.5">
            {version.positive.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-zinc-300">
                <span className="mt-1 text-green-400">✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}

export function PatchNotesPage() {
  const latestCompletedIndex = VERSIONS.findIndex(v => v.status !== 'upcoming')
  const completedCount = VERSIONS.filter(v => v.completionState === 'published').length

  // Build render list: inject a group header before the first card of each group
  const renderItems: Array<
    { type: 'header'; group: string } | { type: 'card'; version: Version; index: number }
  > = []
  let lastGroup: string | undefined = undefined

  VERSIONS.forEach((v, i) => {
    if (v.group && v.group !== lastGroup) {
      renderItems.push({ type: 'header', group: v.group })
      lastGroup = v.group
    } else if (!v.group) {
      lastGroup = undefined
    }
    renderItems.push({ type: 'card', version: v, index: i })
  })

  return (
    <PageLayout>
      {/* Header */}
      <section className="forge-panel surface-card-strong rounded-3xl p-6 shadow-2xl shadow-black/50">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <h1 className="text-2xl font-bold text-white">Patch Notes</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              Release history for the InfraPortal microservices platform and DynamoDB pipeline prototype.
              Each entry documents what changed, why, and, for security releases, every finding addressed.
            </p>
          </div>
          <div className="grid w-full max-w-xs grid-cols-3 gap-2 text-center sm:w-auto">
            <div className="surface-card rounded-xl px-3 py-2">
              <div className="text-base font-bold text-white">{completedCount}</div>
              <div className="text-[11px] text-zinc-400">Released</div>
            </div>
            <div className="surface-card rounded-xl px-3 py-2">
              <div className="text-base font-bold text-white">9</div>
              <div className="text-[11px] text-zinc-400">Findings</div>
            </div>
            <div className="surface-card rounded-xl px-3 py-2">
              <div className="text-base font-bold text-white">0</div>
              <div className="text-[11px] text-zinc-400">Open</div>
            </div>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <a
            href="https://github.com/rodmen07/portfolio/releases"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-accent px-4 py-2 text-sm"
          >
            View on GitHub
          </a>
          <a href="#/case-studies" className="btn-neutral px-4 py-2 text-sm">
            Case studies
          </a>
        </div>
      </section>

      {/* Version cards: newest first, with group headers */}
      {renderItems.map((item, i) =>
        item.type === 'header' ? (
          <GroupHeader key={`group-${item.group}-${i}`} group={item.group} />
        ) : (
          <VersionCard
            key={item.version.tag}
            version={item.version}
            isLatest={item.index === latestCompletedIndex}
          />
        )
      )}
    </PageLayout>
  )
}

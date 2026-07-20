import { PageLayout } from './PageLayout'
import { Badge, type BadgeTone } from '../components/ui/Badge'
import {
  GROUP_META,
  VERSIONS,
  type CompletionState,
  type Severity,
  type Version,
} from './patchNotesData'

// v1.18.4: severity/completion badges migrated onto the shared Badge
// primitive (src/components/ui/Badge.tsx). Previously each rendered its own
// `bg-*/15 text-*-300 border-*/30` combination with no [data-theme="light"]
// override for several of them, so this page's badges were a ghost-class
// contributor in light mode; Badge's tones already resolve in both themes.
const SEVERITY_TONE: Record<Severity, BadgeTone> = {
  'high': 'danger',
  'medium-high': 'caution',
  'medium': 'warning',
  'low-medium': 'neutral',
}

const SEVERITY_LABEL: Record<Severity, string> = {
  'high': 'HIGH',
  'medium-high': 'MED-HIGH',
  'medium': 'MED',
  'low-medium': 'LOW-MED',
}

const COMPLETION_META: Record<CompletionState, { tone: BadgeTone; label: string }> = {
  planned: { tone: 'neutral', label: 'Planned' },
  implemented: { tone: 'info', label: 'Implemented' },
  published: { tone: 'success', label: 'Published' },
}

function SeverityBadge({ severity }: { severity: Severity }) {
  return <Badge tone={SEVERITY_TONE[severity]}>{SEVERITY_LABEL[severity]}</Badge>
}

function CompletionBadge({ state }: { state: CompletionState }) {
  const { tone, label } = COMPLETION_META[state]
  return <Badge tone={tone}>{label}</Badge>
}

function GroupHeader({ group }: { group: string }) {
  const meta = GROUP_META[group]
  if (!meta) return null
  return (
    <div className="flex items-center gap-3 px-1">
      <span className="rounded-xl bg-accent-soft px-3 py-1 text-base font-bold text-accent-text ring-1 ring-accent-line">
        {group}
      </span>
      <span className="text-sm font-semibold text-text-secondary">{meta.label}</span>
      <Badge tone="info">{meta.status}</Badge>
      <div className="flex-1 border-t border-border-soft" />
    </div>
  )
}

function VersionCard({ version, isLatest }: { version: Version; isLatest: boolean }) {
  const isUpcoming = version.status === 'upcoming'

  return (
    <article className={`forge-panel surface-card-strong rounded-3xl p-6 shadow-2xl shadow-black/50 ${isUpcoming ? 'border border-dashed border-border-strong' : ''}`}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className={`rounded-xl px-3 py-1 text-lg font-bold ring-1 ${isUpcoming ? 'bg-neutral-bg text-text-muted ring-neutral-border' : 'bg-accent-soft text-accent-text ring-accent-line'}`}>
              {version.tag}
            </span>
            {isUpcoming && <Badge tone="info">Upcoming</Badge>}
            {isLatest && <Badge tone="success">Latest</Badge>}
            <span className="text-sm font-semibold text-text-primary">{version.label}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <p className="text-xs text-text-muted">{version.date}</p>
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

      <p className="mt-4 text-sm leading-relaxed text-text-secondary">{version.summary}</p>

      {/* Change highlights */}
      <div className="mt-6 space-y-5">
        {version.highlights.map((group) => (
          <div key={group.heading}>
            <h3 className="mb-2 text-scale-xs font-semibold uppercase tracking-widest text-accent">
              {group.heading}
            </h3>
            <ul className="space-y-1.5">
              {group.items.map((item, i) => (
                <li key={i} className="flex gap-2 text-sm text-text-secondary">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
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
          <h3 className="mb-3 text-scale-xs font-semibold uppercase tracking-widest text-accent">
            Findings Addressed
          </h3>
          <div className="overflow-x-auto rounded-xl border border-border-soft">
            <table className="w-full min-w-[560px] text-xs">
              <thead>
                <tr className="border-b border-border-soft text-left text-text-muted">
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
                    className={`border-b border-border-soft ${i % 2 === 0 ? 'bg-surface-hover' : ''}`}
                  >
                    <td className="px-3 py-2 font-mono text-text-muted">{f.id}</td>
                    <td className="px-3 py-2 text-text-primary">{f.title}</td>
                    <td className="px-3 py-2"><SeverityBadge severity={f.severity} /></td>
                    <td className="px-3 py-2 text-text-muted">{f.category}</td>
                    <td className="px-3 py-2 text-text-secondary">{f.resolution}</td>
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
          <h3 className="mb-2 text-scale-xs font-semibold uppercase tracking-widest text-success">
            Security Controls Already in Place
          </h3>
          <ul className="space-y-1.5">
            {version.positive.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-text-secondary">
                <span className="mt-1 text-success">✓</span>
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
            <h1 className="text-2xl font-bold text-text-primary">Patch Notes</h1>
            <p className="mt-2 text-sm leading-relaxed text-text-secondary">
              Release history for the InfraPortal microservices platform and DynamoDB pipeline prototype.
              Each entry documents what changed, why, and, for security releases, every finding addressed.
            </p>
          </div>
          <div className="grid w-full max-w-xs grid-cols-3 gap-2 text-center sm:w-auto">
            <div className="surface-card rounded-xl px-3 py-2">
              <div className="text-base font-bold text-text-primary">{completedCount}</div>
              <div className="text-scale-xs text-text-muted">Released</div>
            </div>
            <div className="surface-card rounded-xl px-3 py-2">
              <div className="text-base font-bold text-text-primary">9</div>
              <div className="text-scale-xs text-text-muted">Findings</div>
            </div>
            <div className="surface-card rounded-xl px-3 py-2">
              <div className="text-base font-bold text-text-primary">0</div>
              <div className="text-scale-xs text-text-muted">Open</div>
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

import { useState, useEffect } from 'react'
import { PageLayout } from './PageLayout'

// ---------------------------------------------------------------------------
// Release locations — keep in sync with CLAUDE.md § Release Locations
// ---------------------------------------------------------------------------
interface ChecklistItem {
  id: string
  label: string
  path: string
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { id: 'patch-notes',  label: 'Patch Notes page',          path: 'standalones/frontend-service/src/pages/PatchNotesPage.tsx' },
  { id: 'readme',       label: 'Portfolio README',           path: 'README.md (Portfolio repo root)' },
  { id: 'claude-md',   label: 'CLAUDE.md — Roadmap table',  path: 'microservices/CLAUDE.md' },
  { id: 'memory-todos', label: 'Memory — next session todos', path: 'memory/project_next_session_todos.md' },
  { id: 'memory-index', label: 'MEMORY.md index',            path: 'memory/MEMORY.md' },
  { id: 'github-tag',  label: 'GitHub release tag',          path: 'github.com/rodmen07/portfolio/releases' },
]

// ---------------------------------------------------------------------------
// Release versions — planned/in-progress/completed
// ---------------------------------------------------------------------------
type CompletionState = 'planned' | 'implemented' | 'published'

interface ReleaseVersion {
  tag: string
  label: string
  state: CompletionState
}

const RELEASES: ReleaseVersion[] = [
  { tag: 'v0.4.3', label: 'Go Service', state: 'planned' },
]

const STATE_STYLES: Record<CompletionState, { badge: string; label: string }> = {
  planned:     { badge: 'bg-zinc-500/15 text-zinc-400 ring-zinc-500/30',    label: 'Planned' },
  implemented: { badge: 'bg-blue-500/15 text-blue-300 ring-blue-500/30',    label: 'Implemented' },
  published:   { badge: 'bg-green-500/15 text-green-300 ring-green-500/30', label: 'Published' },
}

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------
function loadChecked(tag: string): Set<string> {
  try {
    const raw = localStorage.getItem(`admin-checklist-${tag}`)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch {
    return new Set()
  }
}

function saveChecked(tag: string, checked: Set<string>) {
  localStorage.setItem(`admin-checklist-${tag}`, JSON.stringify([...checked]))
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
const ADMIN_KEY = import.meta.env.VITE_ADMIN_KEY ?? 'dev-admin'

function AuthGate({ onAuth }: { onAuth: () => void }) {
  const [input, setInput] = useState('')
  const [error, setError] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (input === ADMIN_KEY) {
      sessionStorage.setItem('admin-authed', '1')
      onAuth()
    } else {
      setError(true)
    }
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="forge-panel surface-card-strong w-full max-w-sm rounded-3xl p-8 shadow-2xl shadow-black/50">
        <h2 className="text-lg font-bold text-white">Admin access</h2>
        <p className="mt-1 text-sm text-zinc-400">Enter your admin key to continue.</p>
        <form onSubmit={handleSubmit} className="mt-5 space-y-3">
          <input
            type="password"
            autoComplete="off"
            value={input}
            onChange={e => { setInput(e.target.value); setError(false) }}
            placeholder="Admin key"
            className="w-full rounded-xl border border-zinc-700 bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-500/60 focus:ring-1 focus:ring-amber-500/30"
          />
          {error && <p className="text-xs text-red-400">Incorrect key.</p>}
          <button type="submit" className="btn-accent w-full py-2.5 text-sm">
            Unlock
          </button>
        </form>
      </div>
    </div>
  )
}

function ReleaseChecklist({ release }: { release: ReleaseVersion }) {
  const [checked, setChecked] = useState<Set<string>>(() => loadChecked(release.tag))

  const allDone = CHECKLIST_ITEMS.every(item => checked.has(item.id))
  const doneCount = CHECKLIST_ITEMS.filter(item => checked.has(item.id)).length

  function toggle(id: string) {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      saveChecked(release.tag, next)
      return next
    })
  }

  function reset() {
    const empty = new Set<string>()
    saveChecked(release.tag, empty)
    setChecked(empty)
  }

  // Derive displayed completion state from checkbox progress
  const displayedState: CompletionState = allDone ? 'published' : doneCount > 0 ? 'implemented' : release.state
  const { badge, label } = STATE_STYLES[displayedState]

  return (
    <div className="forge-panel surface-card-strong rounded-3xl p-6 shadow-2xl shadow-black/50">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-xl bg-amber-500/15 px-3 py-1 text-base font-bold text-amber-300 ring-1 ring-amber-500/30">
              {release.tag}
            </span>
            <span className="text-sm font-semibold text-zinc-200">{release.label}</span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${badge}`}>
              {label}
            </span>
            <span className="text-xs text-zinc-500">{doneCount} / {CHECKLIST_ITEMS.length} locations updated</span>
          </div>
        </div>
        <button
          type="button"
          onClick={reset}
          className="btn-neutral px-3 py-1.5 text-xs"
        >
          Reset
        </button>
      </div>

      {/* Progress bar */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-zinc-700/50">
        <div
          className="h-full rounded-full bg-amber-500/70 transition-all duration-300"
          style={{ width: `${(doneCount / CHECKLIST_ITEMS.length) * 100}%` }}
        />
      </div>

      {/* Checklist */}
      <ul className="mt-5 space-y-2">
        {CHECKLIST_ITEMS.map(item => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-zinc-700/20">
              <input
                type="checkbox"
                checked={checked.has(item.id)}
                onChange={() => toggle(item.id)}
                className="mt-0.5 h-4 w-4 shrink-0 accent-amber-500"
              />
              <div>
                <p className={`text-sm font-medium ${checked.has(item.id) ? 'text-zinc-500 line-through' : 'text-zinc-200'}`}>
                  {item.label}
                </p>
                <p className="mt-0.5 font-mono text-[11px] text-zinc-500">{item.path}</p>
              </div>
            </label>
          </li>
        ))}
      </ul>

      {allDone && (
        <div className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          All locations updated — {release.tag} is ready to publish.
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export function AdminPage() {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin-authed') === '1')

  useEffect(() => {
    if (authed) sessionStorage.setItem('admin-authed', '1')
  }, [authed])

  if (!authed) return (
    <PageLayout>
      <AuthGate onAuth={() => setAuthed(true)} />
    </PageLayout>
  )

  return (
    <PageLayout>
      {/* Header */}
      <section className="forge-panel surface-card-strong rounded-3xl p-6 shadow-2xl shadow-black/50">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Admin</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Release checklists for upcoming versions. Tick every location once updated — completion state
              advances automatically: Planned → Implemented → Published.
            </p>
          </div>
          <div className="flex gap-2">
            <a href="#/patch-notes" className="btn-neutral px-3 py-1.5 text-xs">Patch notes</a>
            <a href="#/crm/admin" className="btn-neutral px-3 py-1.5 text-xs">CRM admin</a>
          </div>
        </div>

        {/* Release locations reference */}
        <details className="mt-5">
          <summary className="cursor-pointer text-xs font-semibold uppercase tracking-widest text-amber-400/70 hover:text-amber-400">
            Release Locations ({CHECKLIST_ITEMS.length} sources)
          </summary>
          <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-700/40">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-700/40 text-left text-zinc-500">
                  <th className="px-3 py-2 font-medium">#</th>
                  <th className="px-3 py-2 font-medium">Location</th>
                  <th className="px-3 py-2 font-medium">Path / URL</th>
                </tr>
              </thead>
              <tbody>
                {CHECKLIST_ITEMS.map((item, i) => (
                  <tr key={item.id} className={`border-b border-zinc-700/20 ${i % 2 === 0 ? 'bg-zinc-800/20' : ''}`}>
                    <td className="px-3 py-2 font-mono text-zinc-500">{i + 1}</td>
                    <td className="px-3 py-2 text-zinc-200">{item.label}</td>
                    <td className="px-3 py-2 font-mono text-zinc-400">{item.path}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      {/* Dev features — in-progress, not yet in public nav */}
      <section className="forge-panel surface-card-strong rounded-3xl p-6 shadow-2xl shadow-black/50">
        <h2 className="text-base font-semibold text-white">Dev Features</h2>
        <p className="mt-1 text-sm text-zinc-400">
          In-progress features — work here before releasing to the public nav.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {[
            { label: 'Search',        href: '#/search',       desc: 'Full-text search across CRM data' },
            { label: 'Reports',       href: '#/crm/reports',  desc: 'CRM analytics and reporting' },
            { label: 'Observaboard',  href: '#/observaboard', desc: 'Event monitoring dashboard' },
          ].map(({ label, href, desc }) => (
            <a
              key={href}
              href={href}
              className="block rounded-2xl border border-zinc-700/50 bg-zinc-800/40 p-4 transition hover:border-amber-500/40 hover:bg-zinc-800/70"
            >
              <p className="text-sm font-semibold text-zinc-100">{label}</p>
              <p className="mt-1 text-xs text-zinc-500">{desc}</p>
            </a>
          ))}
        </div>
      </section>

      {/* One checklist card per upcoming release */}
      {RELEASES.map(release => (
        <ReleaseChecklist key={release.tag} release={release} />
      ))}
    </PageLayout>
  )
}

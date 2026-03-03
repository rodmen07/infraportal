import { API_BASE_URL } from '../../config'
import type { SiteContent } from '../../types'

interface SiteHeaderProps {
  content: SiteContent
  isAuthenticated: boolean
  authLoading: boolean
  authBusy: boolean
  authError: string
  subjectInput: string
  currentSubject: string
  currentRoles: string[]
  onSubjectInputChange: (value: string) => void
  onSignIn: () => Promise<void>
  onSignInAdmin: () => Promise<void>
  onCreateUsername: () => Promise<void>
  onSignOut: () => void
}

export function SiteHeader({
  content,
  isAuthenticated,
  authLoading,
  authBusy,
  authError,
  subjectInput,
  currentSubject,
  currentRoles,
  onSubjectInputChange,
  onSignIn,
  onSignInAdmin,
  onCreateUsername,
  onSignOut,
}: SiteHeaderProps) {
  return (
    <header className="forge-panel rounded-3xl border border-amber-300/20 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-8">
      <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-4xl">{content.title}</h1>
      <p className="mt-3 max-w-3xl text-zinc-300">{content.subtitle}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        <a
          className="inline-flex items-center rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:opacity-90"
          href={content.ctaHref}
        >
          {content.ctaLabel}
        </a>
        <span className="rounded-xl border border-zinc-500/40 bg-zinc-800/80 px-3 py-2 text-xs text-zinc-300">
          API: {API_BASE_URL}
        </span>
      </div>

      <div className="mt-5 rounded-2xl border border-zinc-500/35 bg-zinc-950/50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">Session</p>

        {isAuthenticated ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              Signed in as {currentSubject}
            </span>
            <span className="rounded-lg border border-zinc-500/40 bg-zinc-800 px-3 py-2 text-xs text-zinc-300">
              Roles: {currentRoles.length > 0 ? currentRoles.join(', ') : 'none'}
            </span>
            <button
              type="button"
              className="rounded-lg border border-zinc-500/40 bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700"
              onClick={onSignOut}
            >
              Sign out
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              type="text"
              className="flex-1 rounded-xl border border-zinc-500/40 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 outline-none ring-amber-400 placeholder:text-zinc-500 focus:ring"
              placeholder="Enter username"
              value={subjectInput}
              onChange={(event) => onSubjectInputChange(event.target.value)}
              disabled={authBusy || authLoading}
            />
            <button
              type="button"
              className="rounded-xl bg-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={authBusy || authLoading}
              onClick={() => {
                void onSignIn()
              }}
            >
              {authBusy || authLoading ? 'Signing in…' : 'Sign in'}
            </button>
            <button
              type="button"
              className="rounded-xl border border-indigo-300/40 bg-indigo-500/10 px-4 py-2 text-sm font-semibold text-indigo-200 transition hover:bg-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={authBusy || authLoading}
              onClick={() => {
                void onSignInAdmin()
              }}
            >
              {authBusy || authLoading ? 'Signing in…' : 'Admin sign in'}
            </button>
            <button
              type="button"
              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={authBusy || authLoading}
              onClick={() => {
                void onCreateUsername()
              }}
            >
              {authBusy || authLoading ? 'Creating…' : 'Create username'}
            </button>
          </div>
        )}

        {authError && (
          <p className="mt-3 rounded-lg border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
            {authError}
          </p>
        )}
      </div>
    </header>
  )
}

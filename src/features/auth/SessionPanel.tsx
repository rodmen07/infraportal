interface SessionPanelProps {
  isAuthenticated: boolean
  authLoading: boolean
  authBusy: boolean
  authError: string
  subjectInput: string
  passwordInput: string
  currentSubject: string
  currentRoles: string[]
  onSubjectInputChange: (value: string) => void
  onPasswordInputChange: (value: string) => void
  onSignIn: () => Promise<void>
  onCreateUsername: () => Promise<void>
  onSignInWithGitHub: () => Promise<void>
  onSignInWithGoogle: () => Promise<void>
  onSignOut: () => void
}

export function SessionPanel({
  isAuthenticated,
  authLoading,
  authBusy,
  authError,
  subjectInput,
  passwordInput,
  currentSubject,
  currentRoles,
  onSubjectInputChange,
  onPasswordInputChange,
  onSignIn,
  onCreateUsername,
  onSignInWithGitHub,
  onSignInWithGoogle,
  onSignOut,
}: SessionPanelProps) {
  const busy = authBusy || authLoading

  const inputCls =
    'flex-1 rounded-xl border border-zinc-500/40 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 outline-none ring-amber-400 placeholder:text-zinc-500 focus:ring'

  return (
    <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
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
            className="btn-modern rounded-lg border border-zinc-500/40 bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700"
            onClick={onSignOut}
          >
            Sign out
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">

          {/* Shared credential inputs */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="email"
              name="email"
              autoComplete="email"
              className={inputCls}
              placeholder="Email address"
              value={subjectInput}
              onChange={(e) => onSubjectInputChange(e.target.value)}
              disabled={busy}
            />
            <input
              type="password"
              name="password"
              className={inputCls}
              placeholder="Password"
              value={passwordInput}
              onChange={(e) => onPasswordInputChange(e.target.value)}
              disabled={busy}
            />
          </div>

          {/* Sign-in form: autoComplete=current-password tells Chrome to offer saved credentials */}
          <form onSubmit={(e) => { e.preventDefault(); void onSignIn() }}>
            <input type="hidden" name="email" autoComplete="email" value={subjectInput} />
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              readOnly
              value={passwordInput}
            />
            <button
              type="submit"
              className="btn-modern w-full rounded-xl bg-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
            >
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* Register form: autoComplete=new-password tells Chrome to offer to save credentials */}
          <form onSubmit={(e) => { e.preventDefault(); void onCreateUsername() }}>
            <input type="hidden" name="email" autoComplete="email" value={subjectInput} />
            <input
              type="password"
              name="password"
              autoComplete="new-password"
              className="sr-only"
              tabIndex={-1}
              aria-hidden="true"
              readOnly
              value={passwordInput}
            />
            <button
              type="submit"
              className="btn-modern w-full rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
            >
              {busy ? 'Creating…' : 'Create account'}
            </button>
          </form>

          {/* OAuth buttons */}
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              className="btn-modern flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-500/40 bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
              onClick={() => { void onSignInWithGitHub() }}
            >
              <svg viewBox="0 0 16 16" className="h-4 w-4 fill-current" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
              </svg>
              Continue with GitHub
            </button>

            <button
              type="button"
              className="btn-modern flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-500/40 bg-zinc-800 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
              onClick={() => { void onSignInWithGoogle() }}
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </button>
          </div>
        </div>
      )}

      {authError && (
        <p className="mt-3 rounded-lg border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {authError}
        </p>
      )}
    </section>
  )
}

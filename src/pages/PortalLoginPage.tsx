import { useEffect, useState } from 'react'
import { PageLayout } from './PageLayout'
import { useAuth } from '../features/auth/useAuth'
import { AUTH_SERVICE_URL } from '../config'

const PORTAL_CALLBACK_URL = `${window.location.origin}${window.location.pathname}?#/portal`

function oauthUrl(provider: 'github' | 'google') {
  const redirect = encodeURIComponent(PORTAL_CALLBACK_URL)
  return `${AUTH_SERVICE_URL}/user/oauth/${provider}?scope=client_portal&redirect_uri=${redirect}`
}

export function PortalLoginPage() {
  const { isClient, login } = useAuth()
  const [tab, setTab] = useState<'oauth' | 'email'>('oauth')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (isClient) {
      window.location.hash = '#/portal'
    }
  }, [isClient])

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!AUTH_SERVICE_URL) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch(`${AUTH_SERVICE_URL}/auth/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail ?? 'Login failed. Please check your credentials.')
        return
      }
      if (data.access_token) {
        login(data.access_token)
      }
    } catch {
      setError('Unable to reach the auth service. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageLayout title="Client portal">
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="forge-panel surface-card-strong w-full max-w-sm space-y-5 p-8">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Welcome back</h2>
            <p className="mt-1 text-xs text-zinc-400">
              Sign in with the account associated with your project.
            </p>
          </div>

          {/* Tab switcher */}
          <div className="flex rounded-lg border border-zinc-700/50 bg-zinc-800/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setTab('oauth')}
              className={`flex-1 rounded-md py-1.5 font-medium transition ${tab === 'oauth' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Social sign-in
            </button>
            <button
              type="button"
              onClick={() => setTab('email')}
              className={`flex-1 rounded-md py-1.5 font-medium transition ${tab === 'email' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Email & password
            </button>
          </div>

          {tab === 'oauth' && (
            <div className="space-y-3">
              {AUTH_SERVICE_URL ? (
                <>
                  <a
                    href={oauthUrl('github')}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-zinc-500/60 hover:bg-zinc-700/60"
                  >
                    <GithubIcon />
                    Continue with GitHub
                  </a>
                  <a
                    href={oauthUrl('google')}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-4 py-2.5 text-sm font-medium text-zinc-100 transition hover:border-zinc-500/60 hover:bg-zinc-700/60"
                  >
                    <GoogleIcon />
                    Continue with Google
                  </a>
                </>
              ) : (
                <p className="text-xs text-amber-400">
                  Auth service URL is not configured (VITE_AUTH_SERVICE_URL).
                </p>
              )}
            </div>
          )}

          {tab === 'email' && (
            <form onSubmit={handleEmailLogin} className="space-y-3">
              {error && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {error}
                </p>
              )}
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  className="w-full rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400/50 focus:outline-none"
                  placeholder="you@example.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="w-full rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400/50 focus:outline-none"
                  placeholder="••••••••"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="btn-accent w-full disabled:opacity-50"
              >
                {submitting ? 'Signing in…' : 'Sign in'}
              </button>
              <div className="flex justify-center">
                <a href="#/portal/forgot-password" className="text-xs text-zinc-500 hover:text-amber-300 transition">
                  Forgot password?
                </a>
              </div>
            </form>
          )}

          <p className="text-center text-xs text-zinc-500">
            Have an invite?{' '}
            <a href="#/portal/register" className="text-amber-400 hover:text-amber-300">
              Create your account
            </a>
          </p>
        </div>
      </div>
    </PageLayout>
  )
}

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  )
}

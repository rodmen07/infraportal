import { useEffect, useState } from 'react'
import { PageLayout } from './PageLayout'
import { useAuth } from '../features/auth/useAuth'
import { AUTH_SERVICE_URL } from '../config'

export function PortalRegisterPage() {
  const { isClient, login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [inviteToken, setInviteToken] = useState<string | null>(null)

  useEffect(() => {
    if (isClient) {
      window.location.hash = '#/portal'
    }
  }, [isClient])

  useEffect(() => {
    // Extract invite token from URL: #/portal/register?token=...
    // Hash-based URLs produce a hash like: #/portal/register?token=abc
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
    const token = hashParams.get('token')
    if (token) {
      setInviteToken(token)
      // Pre-fill email if provided as a query param too
      const em = hashParams.get('email')
      if (em) setEmail(decodeURIComponent(em))
    }
  }, [])

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!AUTH_SERVICE_URL) return
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }
    if (!inviteToken) {
      setError('No invite token found. Please use the link from your invitation email.')
      return
    }

    setSubmitting(true)
    try {
      const url = `${AUTH_SERVICE_URL}/auth/register?token=${encodeURIComponent(inviteToken)}`
      const res = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email.trim(), password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail ?? 'Registration failed. Please try again.')
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
    <PageLayout title="Create your account">
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="forge-panel surface-card-strong w-full max-w-sm space-y-5 p-8">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Create your account</h2>
            <p className="mt-1 text-xs text-zinc-400">
              {inviteToken
                ? 'You have been invited to the client portal. Set your password to get started.'
                : 'A valid invite link is required to create an account.'}
            </p>
          </div>

          {!inviteToken ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <p className="text-xs text-amber-300">
                No invite token found. Please use the link from your invitation email, or{' '}
                <a href="#/contact" className="underline hover:text-amber-200">contact us</a> to request access.
              </p>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-3">
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
                  autoComplete="new-password"
                  minLength={6}
                  className="w-full rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400/50 focus:outline-none"
                  placeholder="Minimum 6 characters"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-400">Confirm password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  autoComplete="new-password"
                  className="w-full rounded-lg border border-zinc-600/50 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-amber-400/50 focus:outline-none"
                  placeholder="Re-enter your password"
                />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="btn-accent w-full disabled:opacity-50"
              >
                {submitting ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          )}

          <p className="text-center text-xs text-zinc-500">
            Already have an account?{' '}
            <a href="#/portal/login" className="text-amber-400 hover:text-amber-300">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </PageLayout>
  )
}

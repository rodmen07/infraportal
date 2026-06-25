import { useEffect, useState } from 'react'
import { PageLayout } from './PageLayout'
import { AUTH_SERVICE_URL } from '../config'

export function PortalResetPasswordPage() {
  const [resetToken, setResetToken] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
    const token = hashParams.get('token')
    setResetToken(token)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!AUTH_SERVICE_URL || !resetToken) return
    setError(null)

    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`${AUTH_SERVICE_URL}/auth/password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, password }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.detail ?? 'Reset failed. The link may have expired.')
        return
      }
      setDone(true)
    } catch {
      setError('Unable to reach the auth service. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageLayout title="Set new password">
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="forge-panel surface-card-strong w-full max-w-sm space-y-5 p-8">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Set new password</h2>
            <p className="mt-1 text-xs text-zinc-400">Choose a strong password for your account.</p>
          </div>

          {done ? (
            <div className="space-y-4">
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
                <p className="text-sm text-emerald-300">Password updated successfully!</p>
              </div>
              <a href="#/portal/login" className="btn-accent block w-full text-center">
                Sign in
              </a>
            </div>
          ) : !resetToken ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2">
              <p className="text-xs text-amber-300">
                No reset token found. Please use the link from your reset email.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-3">
              {error && (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                  {error}
                </p>
              )}
              <div>
                <label className="mb-1 block text-xs text-zinc-400">New password</label>
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
                {submitting ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}

          <p className="text-center text-xs text-zinc-500">
            <a href="#/portal/login" className="text-amber-400 hover:text-amber-300">
              Back to sign in
            </a>
          </p>
        </div>
      </div>
    </PageLayout>
  )
}

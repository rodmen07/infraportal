import { useState } from 'react'
import { PageLayout } from './PageLayout'
import { AUTH_SERVICE_URL } from '../config'

export function PortalForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!AUTH_SERVICE_URL) return
    setError(null)
    setSubmitting(true)
    try {
      await fetch(`${AUTH_SERVICE_URL}/auth/password/reset-request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      })
      // Always show success to prevent email enumeration
      setSubmitted(true)
    } catch {
      setError('Unable to reach the auth service. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <PageLayout title="Reset password">
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="forge-panel surface-card-strong w-full max-w-sm space-y-5 p-8">
          <div>
            <h2 className="text-base font-semibold text-zinc-100">Reset password</h2>
            <p className="mt-1 text-xs text-zinc-400">
              Enter your email and we'll send a reset link if an account exists.
            </p>
          </div>

          {submitted ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-3">
              <p className="text-sm text-emerald-300">
                If that email is registered, a reset link has been sent. Check your inbox.
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
              <button
                type="submit"
                disabled={submitting || !AUTH_SERVICE_URL}
                className="btn-accent w-full disabled:opacity-50"
              >
                {submitting ? 'Sending…' : 'Send reset link'}
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

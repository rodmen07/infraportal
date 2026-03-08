import { useState } from 'react'
import { confirmPasswordReset } from '../api/auth'

interface ResetPasswordPageProps {
  token: string
}

export function ResetPasswordPage({ token }: ResetPasswordPageProps) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const inputCls =
    'w-full rounded-xl border border-zinc-500/40 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 outline-none ring-amber-400 placeholder:text-zinc-500 focus:ring'

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    setBusy(true)
    try {
      await confirmPasswordReset(token, newPassword)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Reset failed. The link may have expired.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-4">
      <section className="w-full max-w-md rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-8 shadow-2xl shadow-black/50 backdrop-blur-xl">
        <h1 className="mb-6 text-xl font-bold text-zinc-100">Set a new password</h1>

        {success ? (
          <div className="flex flex-col gap-4">
            <p className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
              Password updated successfully.
            </p>
            <a
              href="#/"
              className="btn-modern w-full rounded-xl bg-zinc-200 px-4 py-2 text-center text-sm font-semibold text-zinc-900 transition hover:bg-white"
            >
              Back to home
            </a>
          </div>
        ) : (
          <form onSubmit={(e) => { void handleSubmit(e) }} className="flex flex-col gap-4">
            <input
              type="password"
              autoComplete="new-password"
              className={inputCls}
              placeholder="New password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={busy}
              required
            />
            <input
              type="password"
              autoComplete="new-password"
              className={inputCls}
              placeholder="Confirm new password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={busy}
              required
            />
            {error && (
              <p className="rounded-lg border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="btn-modern w-full rounded-xl bg-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
              disabled={busy}
            >
              {busy ? 'Saving…' : 'Save new password'}
            </button>
            <a href="#/" className="text-center text-xs text-zinc-400 hover:text-zinc-200">
              Cancel
            </a>
          </form>
        )}
      </section>
    </div>
  )
}

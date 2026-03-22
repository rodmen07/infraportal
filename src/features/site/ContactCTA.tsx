import { useState } from 'react'
import { MONITORING_URL } from '../../config'

type Phase = 'idle' | 'sending' | 'sent' | 'error'

export function ContactCTA() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPhase('sending')
    try {
      const res = await fetch(`${MONITORING_URL}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, message }),
      })
      if (!res.ok) throw new Error(`${res.status}`)
      setPhase('sent')
      setName('')
      setEmail('')
      setMessage('')
    } catch {
      setPhase('error')
    }
  }

  return (
    <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-8 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <h2 className="text-xl font-semibold text-white">Get in touch</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Send a message and I'll get back to you directly.
      </p>

      {phase === 'sent' ? (
        <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-300">
          Message sent — I'll be in touch soon.
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <input
              required
              type="text"
              placeholder="Name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="flex-1 rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20"
            />
            <input
              required
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="flex-1 rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20"
            />
          </div>
          <textarea
            required
            rows={4}
            placeholder="Message"
            value={message}
            onChange={e => setMessage(e.target.value)}
            maxLength={4000}
            className="resize-none rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20"
          />
          {phase === 'error' && (
            <p className="text-sm text-red-400">Something went wrong — please try again.</p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <a
                href="https://www.linkedin.com/in/roderick-mendoza-9133b7b5/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-zinc-500 transition hover:text-zinc-300"
              >
                LinkedIn →
              </a>
              <a
                href="https://www.upwork.com/freelancers/~01d4b41a81a0ae3ec6?mp_source=share"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-zinc-500 transition hover:text-zinc-300"
              >
                Upwork →
              </a>
            </div>
            <button
              type="submit"
              disabled={phase === 'sending'}
              className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-5 py-2.5 text-sm font-semibold text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-500/25 hover:text-amber-100 disabled:opacity-50"
            >
              {phase === 'sending' ? 'Sending…' : 'Send message →'}
            </button>
          </div>
        </form>
      )}
    </section>
  )
}

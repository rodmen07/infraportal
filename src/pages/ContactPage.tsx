import { useState } from 'react'
import { PageLayout } from './PageLayout'
import { MONITORING_URL } from '../config'

type Phase = 'idle' | 'sending' | 'sent' | 'error'

export function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')

  const handleSubmit = async (e: React.FormEvent) => {
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

  const fieldClass = 'w-full rounded-lg border border-zinc-700/60 bg-zinc-800/70 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-400/55 focus:ring-1 focus:ring-amber-400/35'
  const labelClass = 'mb-1.5 block text-xs font-medium text-zinc-400'

  return (
    <PageLayout>
      <section className="forge-panel surface-card-strong rounded-3xl p-8 shadow-2xl shadow-black/50 reveal sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-xl">
            <h1 className="text-2xl font-bold text-white">Get in touch</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              Every engagement starts with a free 30-minute discovery call. Share your current
              stack, timeline, and constraints so we can quickly shape the right implementation path.
            </p>
          </div>
          <div className="surface-card rounded-xl px-4 py-3 text-xs text-zinc-300">
            <p className="font-semibold text-white">Typical response time</p>
            <p className="mt-1 text-zinc-400">Within 1 business day</p>
          </div>
        </div>

        {phase === 'sent' ? (
          <div className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-300">
            Message sent — I'll be in touch within 1 business day.
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className={labelClass}>Your name</label>
              <input
                id="name"
                type="text"
                required
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="email" className={labelClass}>Email</label>
              <input
                id="email"
                type="email"
                required
                placeholder="jane@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="message" className={labelClass}>Message</label>
            <textarea
              id="message"
              required
              rows={5}
              placeholder="Tell me a bit about your stack, what you're trying to solve, and your rough timeline..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className={`${fieldClass} resize-none`}
            />
          </div>

          {phase === 'error' && (
            <p className="text-sm text-red-400">Something went wrong — please try again or reach out directly below.</p>
          )}

          <button
            type="submit"
            disabled={phase === 'sending'}
            className="btn-accent px-6 py-2.5 text-sm disabled:opacity-50"
          >
            {phase === 'sending' ? 'Sending…' : 'Send message →'}
          </button>
        </form>
        )}
      </section>

      <section className="forge-panel surface-card rounded-2xl p-6 reveal reveal-delay-1">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Or reach me directly</p>
        <div className="flex flex-wrap gap-3">
          <a
            href="mailto:rodmendoza07@gmail.com"
            className="btn-neutral px-4 py-2 text-sm"
          >
            rodmendoza07@gmail.com
          </a>
          <a
            href="https://www.linkedin.com/in/roderick-mendoza-9133b7b5/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-neutral px-4 py-2 text-sm"
          >
            LinkedIn →
          </a>
          <a
            href="https://www.upwork.com/freelancers/~01d4b41a81a0ae3ec6?mp_source=share"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-neutral px-4 py-2 text-sm"
          >
            Upwork →
          </a>
        </div>
        <p className="mt-4 text-xs text-zinc-600">Based in San Antonio, TX — open to remote worldwide.</p>
        <p className="mt-1 text-xs text-zinc-600">Email link opens your default mail client — works best on mobile.</p>
      </section>
    </PageLayout>
  )
}

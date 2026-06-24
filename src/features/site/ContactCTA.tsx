import { useEffect, useMemo, useState } from 'react'
import { getConsultationRequests, saveConsultationRequest, type ConsultationRequest } from '../consulting/consultationStore'

type Phase = 'idle' | 'sending' | 'sent' | 'error'

export function ContactCTA() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [projectType, setProjectType] = useState('Web app')
  const [timeline, setTimeline] = useState('Within 2 weeks')
  const [message, setMessage] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [savedRequests, setSavedRequests] = useState<ConsultationRequest[]>([])

  useEffect(() => {
    setSavedRequests(getConsultationRequests())
  }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPhase('sending')

    window.setTimeout(() => {
      const request: ConsultationRequest = {
        id: `req-${Date.now()}`,
        name: name.trim(),
        email: email.trim(),
        projectType,
        timeline,
        message: message.trim(),
        createdAt: new Date().toISOString(),
        status: 'new',
      }

      saveConsultationRequest(request)
      setSavedRequests(getConsultationRequests())
      setPhase('sent')
      setName('')
      setEmail('')
      setProjectType('Web app')
      setTimeline('Within 2 weeks')
      setMessage('')
    }, 400)
  }

  const latestRequest = useMemo(() => savedRequests[0], [savedRequests])

  return (
    <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-8 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <h2 className="text-xl font-semibold text-white">Book a consultation</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Tell us about your app and we will follow up with the right next steps for setup and support.
      </p>

      {phase === 'sent' ? (
        <div className="mt-6 space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-300">
          <p>Thanks — your consultation request is ready and we will reach out shortly.</p>
          {latestRequest && (
            <p className="text-xs text-emerald-200/90">
              Saved request for {latestRequest.name} with {latestRequest.projectType.toLowerCase()} planning.
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <input
              required
              type="text"
              placeholder="Your name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="flex-1 rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20"
            />
            <input
              required
              type="email"
              placeholder="Work email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="flex-1 rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20"
            />
          </div>
          <div className="flex flex-col gap-4 sm:flex-row">
            <select
              value={projectType}
              onChange={e => setProjectType(e.target.value)}
              className="flex-1 rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20"
            >
              <option>Web app</option>
              <option>Client portal</option>
              <option>Internal tool</option>
              <option>Other</option>
            </select>
            <select
              value={timeline}
              onChange={e => setTimeline(e.target.value)}
              className="flex-1 rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20"
            >
              <option>Within 2 weeks</option>
              <option>Next month</option>
              <option>Planning stage</option>
            </select>
          </div>
          <textarea
            required
            rows={4}
            placeholder="Tell us what you want hosted, maintained, or launched."
            value={message}
            onChange={e => setMessage(e.target.value)}
            maxLength={4000}
            className="resize-none rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20"
          />
          {phase === 'error' && (
            <p className="text-sm text-red-400">Something went wrong — please try again.</p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-500">We typically reply within one business day.</p>
            <button
              type="submit"
              disabled={phase === 'sending'}
              className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-5 py-2.5 text-sm font-semibold text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-500/25 hover:text-amber-100 disabled:opacity-50"
            >
              {phase === 'sending' ? 'Submitting…' : 'Request consultation →'}
            </button>
          </div>
        </form>
      )}

      {savedRequests.length > 0 && (
        <div className="mt-6 rounded-2xl border border-zinc-700/50 bg-zinc-800/40 p-4 text-sm text-zinc-300">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Recent requests</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {savedRequests.slice(0, 3).map((request) => (
              <span key={request.id} className="rounded-full border border-zinc-700/50 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-300">
                {request.name} · {request.projectType}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

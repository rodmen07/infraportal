import { useMemo, useState } from 'react'
import { SCHEDULING_URL } from '../../config'
import { getConsultationRequests, saveConsultationRequest, type ConsultationRequest } from '../consulting/consultationStore'
import { calculateLeadScore, getLeadPriority } from '../consulting/leadScoring'
import { submitPublicLead } from '../consulting/leadIntake'
import { trackPortfolioEvent } from '../../utils/analytics'

type Phase = 'idle' | 'sending' | 'sent' | 'error'

export function ContactCTA() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [engagement, setEngagement] = useState('Architecture review')
  const [budget, setBudget] = useState('Under $5k')
  const [timeline, setTimeline] = useState('Within 2 weeks')
  const [message, setMessage] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [savedRequests, setSavedRequests] = useState<ConsultationRequest[]>(() => getConsultationRequests())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPhase('sending')

    const trimmedMessage = message.trim()
    const leadScore = calculateLeadScore({
      engagement,
      budget,
      timeline,
      message: trimmedMessage,
    })

    const request: ConsultationRequest = {
      id: `req-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      projectType: engagement,
      budget,
      timeline,
      message: trimmedMessage,
      createdAt: new Date().toISOString(),
      status: 'new',
      leadScore,
      leadPriority: getLeadPriority(leadScore),
    }

    saveConsultationRequest(request)
    // Best-effort server-side intake; no-ops until VITE_LEAD_INTAKE_URL is set.
    await submitPublicLead(request)
    trackPortfolioEvent('consultation_form_submit', {
      engagement,
      budget,
      timeline,
      leadPriority: getLeadPriority(leadScore),
    })

    setSavedRequests(getConsultationRequests())
    setPhase('sent')
    setName('')
    setEmail('')
    setEngagement('Architecture review')
    setBudget('Under $5k')
    setTimeline('Within 2 weeks')
    setMessage('')
  }

  const latestRequest = useMemo(() => savedRequests[0], [savedRequests])

  return (
    <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-8 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <h2 className="text-xl font-semibold text-white">Start a paid engagement</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Choose the type of work you want and we will follow up with the right scope, timeline, and next step.
      </p>

      {SCHEDULING_URL && (
        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-zinc-200">
          <p className="font-medium text-amber-100">Want to skip the form?</p>
          <p className="mt-1 text-zinc-300">Book a 30-minute call directly and we can scope the right engagement on the spot.</p>
          <a
            href={SCHEDULING_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackPortfolioEvent('consulting_cta_click', { location: 'contact-cta', label: 'Book 30-minute call' })}
            className="mt-3 inline-flex rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-500/25 hover:text-amber-100"
          >
            Book 30-minute call →
          </a>
        </div>
      )}

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
              value={engagement}
              onChange={e => setEngagement(e.target.value)}
              className="flex-1 rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20"
            >
              <option>Architecture review</option>
              <option>Launch sprint</option>
              <option>Monthly retainer</option>
              <option>Security review</option>
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
          <div className="flex flex-col gap-4 sm:flex-row">
            <select
              value={budget}
              onChange={e => setBudget(e.target.value)}
              className="flex-1 rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-2.5 text-sm text-zinc-100 outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20"
            >
              <option>Under $5k</option>
              <option>$5k–$15k</option>
              <option>$15k+</option>
              <option>Need guidance</option>
            </select>
            <div className="rounded-xl border border-zinc-700/50 bg-zinc-800/40 px-4 py-2.5 text-sm text-zinc-400 sm:flex-1">
              Productized offers are scoped quickly, so you get a concrete proposal instead of a vague estimate.
            </div>
          </div>
          <textarea
            required
            rows={4}
            placeholder="Tell us what you want reviewed, built, or launched."
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
              {phase === 'sending' ? 'Submitting…' : 'Request proposal →'}
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

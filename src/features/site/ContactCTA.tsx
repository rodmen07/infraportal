import { useMemo, useState } from 'react'
import { SCHEDULING_URL } from '../../config'
import { getConsultationRequests, saveConsultationRequest, type ConsultationRequest } from '../consulting/consultationStore'
import { calculateLeadScore, getLeadPriority } from '../consulting/leadScoring'
import { submitPublicLead } from '../consulting/leadIntake'
import { trackPortfolioEvent } from '../../utils/analytics'
import { PORTFOLIO_EVENTS } from '../../utils/analyticsEvents'
import { DEFAULT_TIMELINE, WHAT_YOU_NEED_OPTIONS } from './contactFormDefaults'

type Phase = 'idle' | 'sending' | 'sent' | 'error'

// v1.18.3 (D9, contact-form shortening; F8): this used to collect seven
// fields (name, email, engagement, budget, timeline, referral source,
// message). Per D9 the form keeps name, email, message, and one optional
// "what do you need" select; budget and timeline move into the call
// instead, so calculateLeadScore/ConsultationRequest get a fixed neutral
// default for them (leadScoring.ts already treats a missing budget and an
// unmatched timeline as neutral inputs, so nothing there needed to change).
// The "Recent requests" strip (localStorage submissions echoed back to any
// visitor on a public page) is deleted outright, it read as fake social
// proof (finding F8). The $500 referral panel is demoted to ContactPage's
// footer, the highest-intent page, instead of repeating on every page this
// component appears on; see ContactPage.tsx for its new home and the
// `referral_lead_captured` event, which still fires from there.
export function ContactCTA() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [whatYouNeed, setWhatYouNeed] = useState(WHAT_YOU_NEED_OPTIONS[0])
  const [message, setMessage] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [savedRequests, setSavedRequests] = useState<ConsultationRequest[]>(() => getConsultationRequests())

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setPhase('sending')

    const trimmedMessage = message.trim()
    const engagement = whatYouNeed === WHAT_YOU_NEED_OPTIONS[0] ? 'General inquiry' : whatYouNeed
    const leadScore = calculateLeadScore({
      engagement,
      timeline: DEFAULT_TIMELINE,
      message: trimmedMessage,
    })
    const leadPriority = getLeadPriority(leadScore)

    const request: ConsultationRequest = {
      id: `req-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      projectType: engagement,
      timeline: DEFAULT_TIMELINE,
      message: trimmedMessage,
      createdAt: new Date().toISOString(),
      status: 'new',
      leadScore,
      leadPriority,
    }

    saveConsultationRequest(request)
    // Best-effort server-side intake; no-ops until VITE_LEAD_INTAKE_URL is set.
    await submitPublicLead(request)
    trackPortfolioEvent(PORTFOLIO_EVENTS.consultation_form_submit, {
      engagement,
      budget: DEFAULT_TIMELINE,
      timeline: DEFAULT_TIMELINE,
      leadPriority,
      referral_source: 'none',
    })

    setSavedRequests(getConsultationRequests())
    setPhase('sent')
    setName('')
    setEmail('')
    setWhatYouNeed(WHAT_YOU_NEED_OPTIONS[0])
    setMessage('')
  }

  const latestRequest = useMemo(() => savedRequests[0], [savedRequests])

  return (
    <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-8 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <h2 className="text-xl font-semibold text-white">Tell me what you need</h2>
      <p className="mt-2 text-sm text-text-muted">
        Share a few details and I will follow up with the right scope and next step, or skip the form and book
        a free 30-minute discovery call directly.
      </p>

      {SCHEDULING_URL && (
        <div className="mt-4 rounded-2xl border border-amber-400/20 bg-amber-500/10 px-4 py-3 text-sm text-zinc-200">
          <p className="font-medium text-amber-100">Want to skip the form?</p>
          <p className="mt-1 text-text-secondary">Book a 30-minute call directly and I can scope the right engagement on the spot.</p>
          <a
            href={SCHEDULING_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackPortfolioEvent(PORTFOLIO_EVENTS.consulting_cta_click, { location: 'contact-cta', label: 'Book a 30-minute call' })}
            className="mt-3 inline-flex rounded-xl border border-amber-400/40 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-500/25 hover:text-amber-100"
          >
            Book a 30-minute call →
          </a>
        </div>
      )}

      {phase === 'sent' ? (
        <div className="mt-6 space-y-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-success-text">
          <p>Thanks, your request is in and I will reach out shortly.</p>
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
              className="field-input flex-1 px-4 py-2.5 text-sm"
            />
            <input
              required
              type="email"
              placeholder="Work email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="field-input flex-1 px-4 py-2.5 text-sm"
            />
          </div>
          <select
            value={whatYouNeed}
            onChange={e => setWhatYouNeed(e.target.value)}
            aria-label="What do you need? (optional)"
            className="field-input px-4 py-2.5 text-sm"
          >
            {WHAT_YOU_NEED_OPTIONS.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
          <textarea
            required
            rows={4}
            placeholder="Tell me what you want reviewed, built, or launched."
            value={message}
            onChange={e => setMessage(e.target.value)}
            maxLength={4000}
            className="field-input resize-none px-4 py-2.5 text-sm"
          />
          {phase === 'error' && (
            <p className="text-sm text-danger-text">Something went wrong, please try again.</p>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-text-subtle">I typically reply within one business day.</p>
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
    </section>
  )
}

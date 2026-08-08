import { useState } from 'react'
import { PageLayout } from './PageLayout'
import { PageHeader } from '../features/site/PageHeader'
import { SCHEDULING_URL } from '../config'
import { saveConsultationRequest, type ConsultationRequest } from '../features/consulting/consultationStore'
import { submitPublicLead } from '../features/consulting/leadIntake'
import { trackPortfolioEvent } from '../utils/analytics'
import { PORTFOLIO_EVENTS } from '../utils/analyticsEvents'
import { PricingTrustStrip } from '../features/consulting/PricingTrustStrip'
import { PricingFaq } from '../features/consulting/PricingFaq'

type Phase = 'idle' | 'sending' | 'sent'

// v1.25.1 (ROADMAP decision D-17): the same three-state delivery vocabulary
// LeadMagnetPage already derives from `LeadIntakeResult`, adopted verbatim
// rather than redesigned. Before this slice `submitPublicLead`'s result was
// discarded here in statement position and `phase` went to 'sent' on every
// path, so a relay outage rendered "✓ Message sent" (LEAD-SILENT-DROP-1).
type DeliveryStatus = 'sent' | 'not-configured' | 'failed'

export function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [deliveryStatus, setDeliveryStatus] = useState<DeliveryStatus>('sent')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const sending = phase === 'sending'
  const messageLength = message.trim().length

  // v1.18.3 (D9, F8): the $500 referral panel used to appear on ContactCTA,
  // repeated on every page it is embedded in (Home, About, Services,
  // Pricing, Case Studies, Retainers). It is demoted here, to the highest-
  // intent page's footer, instead. The referral_lead_captured event this
  // used to fire from ContactCTA's form on submit now fires from this
  // standalone capture, same event name and payload shape, just relocated.
  const [referralSource, setReferralSource] = useState('')
  const [referralNoted, setReferralNoted] = useState(false)

  const noteReferral = () => {
    const trimmed = referralSource.trim()
    if (!trimmed) return
    trackPortfolioEvent(PORTFOLIO_EVENTS.referral_lead_captured, { referrer: trimmed })
    setReferralNoted(true)
  }

  const validate = () => {
    const errors: Record<string, string> = {}
    if (!name.trim()) errors.name = 'Required'
    if (!email.trim()) errors.email = 'Required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email'
    if (!message.trim()) errors.message = 'Required'
    else if (message.trim().length < 10) errors.message = 'At least 10 characters'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setPhase('sending')

    const request: ConsultationRequest = {
      id: `req-${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      projectType: 'General inquiry',
      timeline: 'Not specified',
      message: message.trim(),
      createdAt: new Date().toISOString(),
      status: 'new',
    }

    // Persist locally first. This copy lives in the VISITOR's localStorage,
    // which the owner can never read, so it is not a delivery guarantee — the
    // bound result below is what decides what the visitor is told (v1.25.1).
    saveConsultationRequest(request)
    const intakeResult = await submitPublicLead(request)
    const delivery: DeliveryStatus = intakeResult.ok
      ? 'sent'
      : intakeResult.reason === 'not-configured'
        ? 'not-configured'
        : 'failed'
    setDeliveryStatus(delivery)

    trackPortfolioEvent(PORTFOLIO_EVENTS.contact_form_submit, {
      hasSchedulingLink: Boolean(SCHEDULING_URL),
      delivery_status: delivery,
    })

    setPhase('sent')
    setName('')
    setEmail('')
    setMessage('')
  }

  // v1.18.1 PR2: the shared, token-built `.field-input` recipe (defined in
  // src/styles/tokens.css) carries fill, border, text, and placeholder for
  // both themes. Only the per-instance error state and the size utilities
  // stay here; tokens.css is imported before Tailwind's utilities, so the
  // error border/fill below still win the cascade.
  const fieldClass = (hasError: boolean) =>
    `field-input ${hasError ? 'border-red-500/60 bg-red-500/8' : ''} px-4 py-2.5 text-sm outline-none`
  const labelClass = 'mb-1.5 block text-sm font-medium text-text-muted'

  return (
    <PageLayout>
      <PageHeader
        title="Get in touch"
        subtitle="Every engagement starts with a free 30-minute discovery call. Share your current stack, timeline, and constraints so I can quickly shape the right implementation path."
        aside={
          <div className="surface-card rounded-xl px-4 py-3 text-xs text-text-secondary">
            <p className="font-semibold text-white">Typical response time</p>
            <p className="mt-1 text-text-muted">Within 1 business day</p>
            {SCHEDULING_URL && (
              <a
                href={SCHEDULING_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackPortfolioEvent(PORTFOLIO_EVENTS.consulting_cta_click, { location: 'contact-page', label: 'Book a 30-minute call' })}
                className="mt-3 inline-flex rounded-lg border border-amber-400/30 bg-amber-500/15 px-3 py-2 text-scale-xs font-semibold text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-500/25 hover:text-amber-100"
              >
                Book a 30-minute call →
              </a>
            )}
          </div>
        }
      />

      <section className="forge-panel surface-card-strong rounded-3xl p-8 shadow-2xl shadow-black/50 sm:p-10">
        {phase === 'sent' ? (
          <div className="space-y-4">
            {deliveryStatus === 'sent' ? (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-success-text">
                ✓ Message sent — I'll be in touch within 1 business day.
              </div>
            ) : deliveryStatus === 'failed' ? (
              <div className="space-y-2 rounded-xl border border-danger-line bg-danger-soft px-5 py-4 text-sm text-danger-text">
                <p className="font-medium">Your message did not reach my inbox.</p>
                <p className="text-xs">
                  The delivery service refused it, so I have not received this note. Please email me directly at
                  rodmendoza07@gmail.com, or book a call, and I will pick it up from there.
                </p>
              </div>
            ) : (
              <div className="space-y-2 rounded-xl border border-warning-line bg-warning-soft px-5 py-4 text-sm text-warning-text">
                <p className="font-medium">This message was not delivered.</p>
                <p className="text-xs">
                  Message delivery is not configured on this site yet, so nothing was sent to my inbox. Please email
                  me directly at rodmendoza07@gmail.com, or book a call, and I will pick it up from there.
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setPhase('idle')}
              className="btn-neutral px-5 py-2 text-sm"
            >
              Send another message
            </button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-5" noValidate>
          <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/40 px-4 py-3 text-sm text-text-secondary">
            <p className="font-medium text-text-primary">Helpful context to include</p>
            <p className="mt-1 text-text-muted">Project type, current stack, target timeline, and the main blocker you want solved first.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className={labelClass}>Your name <span className="text-danger-text">*</span></label>
              <input
                id="name"
                type="text"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => { setName(e.target.value); setFieldErrors(fe => ({ ...fe, name: '' })) }}
                className={fieldClass(!!fieldErrors.name)}
              />
              {fieldErrors.name && <p className="mt-1 text-xs text-danger-text">{fieldErrors.name}</p>}
            </div>
            <div>
              <label htmlFor="email" className={labelClass}>Email <span className="text-danger-text">*</span></label>
              <input
                id="email"
                type="email"
                placeholder="jane@company.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors(fe => ({ ...fe, email: '' })) }}
                className={fieldClass(!!fieldErrors.email)}
              />
              {fieldErrors.email && <p className="mt-1 text-xs text-danger-text">{fieldErrors.email}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="message" className={labelClass}>Message <span className="text-danger-text">*</span></label>
            <textarea
              id="message"
              rows={5}
              maxLength={4000}
              placeholder="Tell me a bit about your stack, what you're trying to solve, and your rough timeline..."
              value={message}
              onChange={(e) => { setMessage(e.target.value); setFieldErrors(fe => ({ ...fe, message: '' })) }}
              className={`${fieldClass(!!fieldErrors.message)} resize-none`}
              aria-invalid={!!fieldErrors.message}
              aria-describedby="message-help"
            />
            <div className="mt-1 flex items-center justify-between gap-3 text-xs text-text-subtle" id="message-help">
              <span>Minimum 10 characters</span>
              <span>{messageLength} / 4000</span>
            </div>
            {fieldErrors.message && <p className="mt-1 text-xs text-danger-text">{fieldErrors.message}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={sending}
              className="btn-accent inline-flex items-center gap-2 px-6 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {sending && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden="true" />}
              <span>{sending ? 'Sending your note…' : 'Send message →'}</span>
            </button>
            <span className="text-xs text-text-subtle">Best for project scoping, audits, and architecture reviews.</span>
          </div>
        </form>
        )}
      </section>

      <section className="forge-panel surface-card rounded-2xl p-6">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-text-subtle">Or reach me directly</p>
        <div className="flex flex-wrap gap-3">
          <a href="mailto:rodmendoza07@gmail.com" className="btn-neutral px-4 py-2 text-sm">
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

      <section className="surface-card rounded-2xl p-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl" aria-hidden="true">🎁</span>
          <div className="flex-1">
            <p className="font-semibold text-success-text">Refer a friend, earn $500</p>
            <p className="mt-2 text-sm text-emerald-200/80">
              Know another team that needs infrastructure help? Refer them for a successful project or retainer,
              and I will send you a $500 credit toward your next engagement. No limit on referrals.
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <input
                type="text"
                placeholder="Their name or company (optional)"
                value={referralSource}
                onChange={(e) => { setReferralSource(e.target.value); setReferralNoted(false) }}
                maxLength={200}
                aria-label="Who referred you (optional)"
                className="field-input min-w-[200px] flex-1 px-3 py-2 text-sm"
              />
              <button type="button" onClick={noteReferral} className="btn-neutral px-4 py-2 text-sm">
                Note referral
              </button>
            </div>
            {referralNoted && (
              <p className="mt-2 text-xs text-emerald-200/70">Noted, mention this when you reach out and I will track it.</p>
            )}
          </div>
        </div>
      </section>

      <PricingTrustStrip />

      <PricingFaq />
    </PageLayout>
  )
}

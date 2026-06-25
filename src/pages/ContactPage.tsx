import { useState } from 'react'
import { PageLayout } from './PageLayout'
import { FocusCard } from '../features/layout/FocusCard'
import { HowItWorksSection } from '../features/site/HowItWorksSection'
import { SCHEDULING_URL } from '../config'
import { saveConsultationRequest, type ConsultationRequest } from '../features/consulting/consultationStore'
import { submitPublicLead } from '../features/consulting/leadIntake'
import { trackPortfolioEvent } from '../utils/analytics'
import { PricingTrustStrip } from '../features/consulting/PricingTrustStrip'
import { PricingFaq } from '../features/consulting/PricingFaq'

type Phase = 'idle' | 'sending' | 'sent'

export function ContactPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const sending = phase === 'sending'
  const messageLength = message.trim().length

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

    // Always persist locally so the lead is never lost.
    saveConsultationRequest(request)
    // Best-effort server delivery — no-ops when VITE_LEAD_INTAKE_URL is unset.
    await submitPublicLead(request)
    trackPortfolioEvent('contact_form_submit', {
      hasSchedulingLink: Boolean(SCHEDULING_URL),
    })

    setPhase('sent')
    setName('')
    setEmail('')
    setMessage('')
  }

  const fieldClass = (hasError: boolean) =>
    `w-full rounded-lg border ${hasError ? 'border-red-500/60 bg-red-500/8' : 'border-zinc-700/60 bg-zinc-800/70'} px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition hover:border-zinc-600 focus:border-amber-400/55 focus:ring-2 focus:ring-amber-400/35`
  const labelClass = 'mb-1.5 block text-sm font-medium text-zinc-400'

  return (
    <PageLayout>
      <FocusCard>
      <section className="forge-panel surface-card-strong rounded-3xl p-8 shadow-2xl shadow-black/50 sm:p-10">
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
            {SCHEDULING_URL && (
              <a
                href={SCHEDULING_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackPortfolioEvent('consulting_cta_click', { location: 'contact-page', label: 'Book 30-minute call' })}
                className="mt-3 inline-flex rounded-lg border border-amber-400/30 bg-amber-500/15 px-3 py-2 text-[11px] font-semibold text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-500/25 hover:text-amber-100"
              >
                Book 30-minute call →
              </a>
            )}
          </div>
        </div>

        {phase === 'sent' ? (
          <div className="mt-8 space-y-4">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4 text-sm text-emerald-300">
              ✓ Message sent — I'll be in touch within 1 business day.
            </div>
            <button
              type="button"
              onClick={() => setPhase('idle')}
              className="btn-neutral px-5 py-2 text-sm"
            >
              Send another message
            </button>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
          <div className="rounded-xl border border-zinc-700/50 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-300">
            <p className="font-medium text-zinc-100">Helpful context to include</p>
            <p className="mt-1 text-zinc-400">Project type, current stack, target timeline, and the main blocker you want solved first.</p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className={labelClass}>Your name <span className="text-red-400">*</span></label>
              <input
                id="name"
                type="text"
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => { setName(e.target.value); setFieldErrors(fe => ({ ...fe, name: '' })) }}
                className={fieldClass(!!fieldErrors.name)}
              />
              {fieldErrors.name && <p className="mt-1 text-xs text-red-400">{fieldErrors.name}</p>}
            </div>
            <div>
              <label htmlFor="email" className={labelClass}>Email <span className="text-red-400">*</span></label>
              <input
                id="email"
                type="email"
                placeholder="jane@company.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors(fe => ({ ...fe, email: '' })) }}
                className={fieldClass(!!fieldErrors.email)}
              />
              {fieldErrors.email && <p className="mt-1 text-xs text-red-400">{fieldErrors.email}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="message" className={labelClass}>Message <span className="text-red-400">*</span></label>
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
            <div className="mt-1 flex items-center justify-between gap-3 text-xs text-zinc-500" id="message-help">
              <span>Minimum 10 characters</span>
              <span>{messageLength} / 4000</span>
            </div>
            {fieldErrors.message && <p className="mt-1 text-xs text-red-400">{fieldErrors.message}</p>}
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
            <span className="text-xs text-zinc-500">Best for project scoping, audits, and architecture reviews.</span>
          </div>
        </form>
        )}
      </section>
      </FocusCard>

      <FocusCard>
        <section className="forge-panel surface-card rounded-2xl p-6">
          <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Or reach me directly</p>
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
      </FocusCard>

      <FocusCard>
        <HowItWorksSection />
      </FocusCard>

      <FocusCard>
        <PricingTrustStrip />
      </FocusCard>

      <FocusCard>
        <PricingFaq />
      </FocusCard>
    </PageLayout>
  )
}

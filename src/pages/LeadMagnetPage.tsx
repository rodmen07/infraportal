import { useState } from 'react'
import { PageLayout } from './PageLayout'
import { FocusCard } from '../features/layout/FocusCard'
import { trackPortfolioEvent } from '../utils/analytics'
import { submitLeadMagnetLead } from '../features/consulting/leadIntake'

interface ChecklistSection {
  category: string
  items: string[]
}

interface LeadMagnetContent {
  title: string
  subtitle: string
  description: string
  sections: ChecklistSection[]
  cta: string
  followUp: string
}

export function LeadMagnetPage() {
  const [email, setEmail] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [deliveryStatus, setDeliveryStatus] = useState<'sent' | 'not-configured' | 'failed'>('not-configured')

  const magnetSlug = 'infrastructure-audit-checklist'
  const checklistWebUrl = '#/lead-magnet'
  const checklistPrintableUrl = `${import.meta.env.BASE_URL}downloads/infrastructure-audit-checklist.html`

  const content: LeadMagnetContent = {
    title: 'Infrastructure Audit Checklist',
    subtitle: 'Self-assess your cloud setup for security, cost, and reliability',
    description:
      'A practical 20-point checklist to audit your production infrastructure against DevSecOps best practices. Identifies gaps in auto-scaling, security hardening, CI/CD maturity, and cost optimization.',
    sections: [
      {
        category: 'Security & Compliance',
        items: [
          'All services authenticate with short-lived credentials (no long-lived API keys)',
          'Secrets are rotated and not stored in code or environment variables',
          'Network access is restricted by default (deny-all ingress, allow-list egress)',
          'All data in transit is encrypted (TLS 1.2+)',
          'Logging captures authentication attempts, deployments, and config changes',
        ],
      },
      {
        category: 'Reliability & Scaling',
        items: [
          'Services auto-scale based on CPU, memory, or custom metrics',
          'Databases have automated backups with tested restore procedures',
          'Load balancers distribute traffic across multiple availability zones',
          'Health checks actively monitor service readiness',
          'Critical services have fallback/failover strategies',
        ],
      },
      {
        category: 'Operations & Monitoring',
        items: [
          'Real-time dashboards show CPU, memory, error rates, and request latency',
          'Alerting triggers on errors, latency spikes, or deployment failures',
          'Logs are centralized and searchable (not scattered across servers)',
          'Deployment rollback is tested and documented',
          'On-call runbooks exist for common incidents',
        ],
      },
      {
        category: 'Cost Optimization',
        items: [
          'Reserved capacity or commit discounts are used for baseline load',
          'Unused resources (orphaned disks, old snapshots) are regularly cleaned up',
          'Spot/preemptible instances are used for fault-tolerant workloads',
          'Storage tiers match access patterns (hot/warm/cold)',
          'Resource tagging enables cost allocation by team or project',
        ],
      },
    ],
    cta: "Answer 15+ of these checks? Solid foundation. Answer <10? Let's talk about strengthening your infrastructure.",
    followUp:
      "After you download, I'll send a 3-email sequence over the next week with specific recommendations for your stack.",
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanedEmail = email.trim()
    if (!cleanedEmail) return

    setIsLoading(true)

    try {
      // Track lead magnet capture
      trackPortfolioEvent('lead_magnet_email_capture', {
        magnet: magnetSlug,
        email_domain: cleanedEmail.split('@')[1] || 'unknown',
      })

      const intakeResult = await submitLeadMagnetLead({
        email: cleanedEmail,
        magnet: magnetSlug,
        source: 'lead-magnet-page',
        checklistWebUrl,
        checklistPrintableUrl,
      })

      const intakeStatus = intakeResult.ok
        ? 'sent'
        : intakeResult.reason === 'not-configured'
          ? 'not-configured'
          : 'failed'

      setDeliveryStatus(intakeStatus)

      trackPortfolioEvent('lead_magnet_submit_result', {
        magnet: magnetSlug,
        delivery_status: intakeStatus,
      })

      setIsSubmitted(true)

      // Track nurture sequence started
      trackPortfolioEvent('nurture_sequence_started', {
        sequence: 'infrastructure-audit-3-email',
        email_domain: cleanedEmail.split('@')[1] || 'unknown',
        delivery_status: intakeStatus,
      })
    } catch (error) {
      console.error('Failed to capture email:', error)
      setDeliveryStatus('failed')
      setIsSubmitted(true)
      trackPortfolioEvent('lead_magnet_submit_result', {
        magnet: magnetSlug,
        delivery_status: 'failed',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <PageLayout>
      <FocusCard>
        <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-8 shadow-2xl shadow-black/50 sm:p-10">
          <div className="max-w-3xl">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-amber-300/90">
              Free Resource
            </p>
            <h1 className="mt-2 text-3xl font-bold text-white">{content.title}</h1>
            <p className="mt-2 text-lg text-amber-200/80">{content.subtitle}</p>
            <p className="mt-4 text-sm leading-relaxed text-zinc-300">{content.description}</p>

            {!isSubmitted ? (
              <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-3 sm:flex-row">
                <input
                  type="email"
                  placeholder="your@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="flex-1 rounded-xl border border-zinc-700/60 bg-zinc-800/60 px-4 py-3 text-sm text-zinc-100 placeholder-zinc-500 outline-none focus:border-amber-400/50 focus:ring-1 focus:ring-amber-400/20"
                />
                <button
                  type="submit"
                  disabled={isLoading || !email.trim()}
                  className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-6 py-3 text-sm font-semibold text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-500/25 hover:text-amber-100 disabled:opacity-50"
                >
                  {isLoading ? 'Sending...' : 'Download Checklist →'}
                </button>
              </form>
            ) : (
              <div className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-4">
                <p className="text-sm font-medium text-emerald-300">
                  ✓ Checklist is ready to download!
                </p>
                {deliveryStatus === 'sent' ? (
                  <p className="mt-2 text-sm text-emerald-200/80">
                    Day 0 email has been queued to {email.trim()} with your checklist and next-step guidance.
                  </p>
                ) : (
                  <p className="mt-2 text-sm text-emerald-200/80">
                    Download it now below. Email automation is being finalized, so the checklist is delivered instantly on this page.
                  </p>
                )}
                <p className="mt-3 text-xs text-emerald-200/60">
                  {content.followUp}
                </p>
                <div className="mt-4 flex flex-wrap gap-3">
                  <a
                    href={checklistWebUrl}
                    onClick={() => trackPortfolioEvent('lead_magnet_artifact_click', { artifact: 'web_checklist' })}
                    className="inline-block rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400/60 hover:bg-emerald-500/25"
                  >
                    Open web checklist
                  </a>
                  <a
                    href={checklistPrintableUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={() => trackPortfolioEvent('lead_magnet_artifact_click', { artifact: 'printable_checklist' })}
                    className="inline-block rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400/60 hover:bg-emerald-500/25"
                  >
                    Printable checklist (save as PDF)
                  </a>
                </div>
                <a
                  href="#/"
                  className="mt-4 inline-block rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400/60 hover:bg-emerald-500/25"
                >
                  Back to home →
                </a>
              </div>
            )}
          </div>
        </section>
      </FocusCard>

      {!isSubmitted && (
        <FocusCard>
          <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-8 shadow-2xl shadow-black/50">
            <h2 className="text-xl font-semibold text-white">Checklist Preview</h2>
            <p className="mt-2 text-sm text-zinc-400">
              {content.sections.length} categories, {content.sections.reduce((sum, s) => sum + s.items.length, 0)}{' '}
              items to assess
            </p>

            <div className="mt-6 space-y-6">
              {content.sections.map((section) => (
                <div key={section.category}>
                  <h3 className="text-base font-semibold text-amber-200">{section.category}</h3>
                  <ul className="mt-3 space-y-2">
                    {section.items.map((item, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-zinc-300">
                        <span className="mt-1 shrink-0 text-emerald-400">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-8 rounded-xl border border-zinc-700/40 bg-zinc-800/40 p-5">
              <p className="text-sm text-zinc-300">{content.cta}</p>
            </div>
          </section>
        </FocusCard>
      )}

      {!isSubmitted && (
        <FocusCard>
          <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-8 shadow-2xl shadow-black/50">
            <h2 className="text-xl font-semibold text-white">What Happens Next</h2>
            <div className="mt-6 space-y-4">
              <div className="flex gap-4">
                <span className="shrink-0 rounded-full bg-amber-500/20 px-3 py-1 text-sm font-bold text-amber-200">
                  Day 0
                </span>
                <div>
                  <p className="font-medium text-zinc-100">Instant download</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Get immediate access to the web checklist and a printable version you can save as PDF.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="shrink-0 rounded-full bg-amber-500/20 px-3 py-1 text-sm font-bold text-amber-200">
                  Day 3
                </span>
                <div>
                  <p className="font-medium text-zinc-100">First deep dive</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Email 1: Common gaps I see (and quick fixes) for teams in your situation.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="shrink-0 rounded-full bg-amber-500/20 px-3 py-1 text-sm font-bold text-amber-200">
                  Day 7
                </span>
                <div>
                  <p className="font-medium text-zinc-100">Custom recommendations</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Email 2: Based on your stack, a prioritized roadmap to tighten security and cut costs.
                  </p>
                </div>
              </div>
              <div className="flex gap-4">
                <span className="shrink-0 rounded-full bg-amber-500/20 px-3 py-1 text-sm font-bold text-amber-200">
                  Day 14
                </span>
                <div>
                  <p className="font-medium text-zinc-100">Office hours offer</p>
                  <p className="mt-1 text-sm text-zinc-400">
                    Email 3: Free 30-minute session to walk through next steps and answer questions.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </FocusCard>
      )}
    </PageLayout>
  )
}

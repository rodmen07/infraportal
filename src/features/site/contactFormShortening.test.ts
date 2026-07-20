/**
 * D9 regression test (v1.18.3): contact-form shortening.
 *
 * Before this milestone (docs/design/V1_18_UX_THEME.md finding F8, section
 * 7 D9), ContactCTA (the closer embedded on Home, About, Services, Pricing,
 * Case Studies, and Retainers) collected seven fields, echoed the visitor's
 * own localStorage submission history back at them as a "Recent requests"
 * strip (fake-looking social proof), and pitched a $500 referral credit to
 * every visitor regardless of intent. D9's shape: name, email, message,
 * plus one optional "what do you need" select; budget/timeline move into
 * the call. The referral panel is demoted to ContactPage's footer.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { calculateLeadScore, getLeadPriority } from '../consulting/leadScoring'
import { DEFAULT_TIMELINE, WHAT_YOU_NEED_OPTIONS } from './contactFormDefaults'

const ROOT = process.cwd()
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const read = (rel: string) => readFileSync(path.join(ROOT, rel), 'utf-8')

// ContactCTA.tsx's header comment deliberately names `referral_lead_captured`
// (documenting where it moved to), so the "no longer fires from here"
// assertion below strips comments first or it would fail on that very
// documentation.
const CONTACT_CTA_SRC = stripComments(read('src/features/site/ContactCTA.tsx'))
const CONTACT_PAGE_SRC = read('src/pages/ContactPage.tsx')

describe('D9: ContactCTA keeps only the four-field shape', () => {
  it('collects name, email, one optional select, and message, no separate budget/timeline/referral inputs', () => {
    expect(CONTACT_CTA_SRC).toMatch(/placeholder="Your name"/)
    expect(CONTACT_CTA_SRC).toMatch(/placeholder="Work email"/)
    expect((CONTACT_CTA_SRC.match(/<select/g) ?? []).length).toBe(1)
    expect(CONTACT_CTA_SRC).not.toMatch(/setBudget/)
    expect(CONTACT_CTA_SRC).not.toMatch(/setTimeline/)
    expect(CONTACT_CTA_SRC).not.toMatch(/setReferralSource/)
    expect(CONTACT_CTA_SRC).not.toMatch(/Who referred you/)
  })

  it('the optional select defaults to a neutral, non-committal option', () => {
    expect(WHAT_YOU_NEED_OPTIONS[0]).toBe('Not sure yet')
  })

  it('the "Recent requests" strip is deleted, not just hidden', () => {
    expect(CONTACT_CTA_SRC).not.toMatch(/Recent requests/)
  })

  it('the $500 referral panel no longer renders from ContactCTA', () => {
    expect(CONTACT_CTA_SRC).not.toMatch(/Refer a friend/)
    expect(CONTACT_CTA_SRC).not.toMatch(/referral_lead_captured/)
  })

  it('still fires consultation_form_submit with every original payload key present (values may default, keys are frozen)', () => {
    const call = /trackPortfolioEvent\('consultation_form_submit',\s*\{([\s\S]*?)\}\)/.exec(CONTACT_CTA_SRC)
    expect(call, 'consultation_form_submit call should still exist').not.toBeNull()
    const body = call![1]
    for (const key of ['engagement', 'budget', 'timeline', 'leadPriority', 'referral_source']) {
      expect(body).toMatch(new RegExp(key))
    }
  })
})

describe('D9: lead scoring keeps working with defaults for the removed fields', () => {
  it('a submission with the neutral default engagement still produces a bounded, valid score', () => {
    const score = calculateLeadScore({
      engagement: 'General inquiry',
      timeline: DEFAULT_TIMELINE,
      message: 'Need help launching a new product.',
    })
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
    expect(['hot', 'warm', 'nurture']).toContain(getLeadPriority(score))
  })

  it('picking a real engagement option still scores higher than leaving the neutral default', () => {
    const message = 'Need ongoing platform support across our stack.'
    const withPick = calculateLeadScore({ engagement: 'Monthly retainer', timeline: DEFAULT_TIMELINE, message })
    const withDefault = calculateLeadScore({ engagement: 'General inquiry', timeline: DEFAULT_TIMELINE, message })
    expect(withPick).toBeGreaterThan(withDefault)
  })
})

describe('D9: the referral panel is demoted to the Contact page footer, not deleted', () => {
  it('ContactPage renders the $500 referral panel and can still fire referral_lead_captured', () => {
    expect(CONTACT_PAGE_SRC).toMatch(/Refer a friend/)
    expect(CONTACT_PAGE_SRC).toMatch(/trackPortfolioEvent\('referral_lead_captured'/)
  })
})

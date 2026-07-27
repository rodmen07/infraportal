// ---------------------------------------------------------------------------
// Portfolio analytics event registry (v1.22.1, ROADMAP decision D-9).
//
// Every event name `trackPortfolioEvent` can emit lives HERE and nowhere
// else. Before this module the vocabulary was 17 names scattered as string
// literals across 13 files, which meant no test could state "these are the
// events the funnel emits" and a typo minted a new event silently.
//
// The RUNTIME names are unchanged by this module's introduction: call sites
// swapped `'footer_link_click'` for `PORTFOLIO_EVENTS.footer_link_click`, so
// any downstream consumer keyed on the historical strings keeps working.
//
// TWO RULES, both enforced by src/features/site/conversionInstrumentation.test.ts:
//   1. No call site passes a string literal - the compiler narrows the
//      argument to `PortfolioEventName`, and the guard bans quoted first
//      arguments in source, so the vocabulary cannot fork.
//   2. No dead vocabulary - every key below must be referenced from at least
//      one non-test source file, so a retired surface takes its event name
//      with it instead of leaving a phantom entry here.
// ---------------------------------------------------------------------------

export const PORTFOLIO_EVENTS = {
  // Consulting funnel CTAs (hero, proof strip, contact surfaces, crates row).
  consulting_cta_click: 'consulting_cta_click',
  how_it_works_cta_click: 'how_it_works_cta_click',
  footer_link_click: 'footer_link_click',

  // Lead capture and contact forms.
  consultation_form_submit: 'consultation_form_submit',
  contact_form_submit: 'contact_form_submit',
  referral_lead_captured: 'referral_lead_captured',
  lead_magnet_email_capture: 'lead_magnet_email_capture',
  lead_magnet_submit_result: 'lead_magnet_submit_result',
  lead_magnet_artifact_click: 'lead_magnet_artifact_click',
  nurture_sequence_started: 'nurture_sequence_started',

  // Pricing and checkout.
  pricing_page_view: 'pricing_page_view',
  pricing_tier_impression: 'pricing_tier_impression',
  pricing_tier_view: 'pricing_tier_view',
  pricing_checkout_click: 'pricing_checkout_click',
  pricing_cta_click: 'pricing_cta_click',
  retainers_contact_cta: 'retainers_contact_cta',
  checkout_thank_you_view: 'checkout_thank_you_view',

  // Diagnostics.
  route_not_found: 'route_not_found',
} as const

/** Union of every registered event name. `trackPortfolioEvent` accepts only
 * this type, so an unregistered name is a compile error, not a silent fork. */
export type PortfolioEventName = (typeof PORTFOLIO_EVENTS)[keyof typeof PORTFOLIO_EVENTS]

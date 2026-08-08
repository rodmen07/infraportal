// @vitest-environment jsdom
/**
 * v1.25.1 delivery-truth guard (ROADMAP "v1.25 - The funnel never confirms
 * what it did not deliver", decisions D-17 and D-18).
 *
 * WHAT WENT WRONG (LEAD-SILENT-DROP-1, MED, data-losing on the money path).
 * `submitPublicLead` returns a discriminated `LeadIntakeResult`, and its
 * failure branch has ALWAYS been covered by a passing test —
 * `src/features/consulting/leadIntake.test.ts`, `it('reports a failed
 * request')`. The module was correct. Nobody read it: `ContactCTA.tsx` and
 * `ContactPage.tsx` both called it in statement position (`await
 * submitPublicLead(request)`) and then set `phase = 'sent'` on every path, so
 * a relay outage rendered "Thanks, your request is in..." / "✓ Message sent —
 * I'll be in touch within 1 business day." with the lead's only surviving
 * copy sitting in the VISITOR's own localStorage, which the owner can never
 * read. This is not hypothetical: `config.ts` falls back to the third-party
 * `https://formsubmit.co/ajax/…` relay whenever the repo variable is empty
 * (`actions/variables` total_count = 0), so `request-failed` — a relay 5xx or
 * a client-side blocker — is the reachable branch in production today.
 *
 * WHY THIS SHAPE AND NOT A GREP. A source scan for `deliveryStatus` is
 * satisfied by a comment, a dead binding, or a state variable nothing renders
 * (L-033), and coverage on the PRODUCER is exactly what made this class
 * survive for months (L-047). So this suite renders the two REAL components
 * under jsdom and drives their real submit handlers against a stubbed relay,
 * asserting the rendered text and the emitted analytics payload in BOTH
 * directions. The behaviour difference it proves (L-001): restore either call
 * site to a bare `await submitPublicLead(request)` and the "failure" cases
 * below go red while `leadIntake.test.ts` stays green.
 *
 * The `intakeCalls` assertion exists so a stub that is never reached cannot
 * make a direction pass vacuously, and the fetch stub throws on any URL other
 * than the intake endpoint so a future component fetch cannot be silently
 * absorbed by it.
 */
import { act, createElement, type ReactElement, type ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LEAD_INTAKE_URL, SCHEDULING_URL } from '../../config'
import { OWNER_EMAIL } from '../consulting/leadRecovery'
import { ContactCTA } from './ContactCTA'
import { ContactPage } from '../../pages/ContactPage'
import { ThemeProvider } from '../layout/ThemeContext'
import { AuthProvider } from '../auth/AuthContext'
import { NotificationProvider } from '../notifications/NotificationContext'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

interface CapturedEvent {
  eventName: string
  params: Record<string, unknown>
}

/** How the stubbed relay answers the intake POST. */
type Relay = 'accepts' | 'refuses' | 'unreachable'

const FAILURE_COPY = 'did not reach my inbox'

let container: HTMLDivElement
let root: Root
let captured: CapturedEvent[]
let intakeCalls: number
let otherFetches: string[]
let relay: Relay

const realFetch = globalThis.fetch

/** The notification provider opens an SSE connection on mount; jsdom has no
 *  EventSource, and this suite is not about the feed. Same stand-in
 *  `src/pages/pricingViewAnalytics.test.ts` uses to mount a real page. */
class InertEventSource {
  close() {}
  addEventListener() {}
  removeEventListener() {}
  onmessage: unknown = null
  onerror: unknown = null
  onopen: unknown = null
}

function onAnalytics(event: Event): void {
  captured.push((event as CustomEvent).detail as CapturedEvent)
}

/** Minimal `Response` shape — `submitPublicLead` reads only these four. */
function fakeResponse(ok: boolean, status: number, statusText: string, body: string): Response {
  return { ok, status, statusText, text: async () => body } as unknown as Response
}

beforeEach(() => {
  window.localStorage.clear()
  captured = []
  intakeCalls = 0
  otherFetches = []
  relay = 'accepts'
  window.addEventListener('portfolio:analytics', onAnalytics)
  vi.stubGlobal('EventSource', InertEventSource)

  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input)
    if (!url.startsWith(LEAD_INTAKE_URL)) {
      // Recorded, not silently absorbed: every test asserts this stayed empty,
      // so a future component fetch cannot borrow the relay's answer.
      otherFetches.push(url)
      return fakeResponse(false, 599, 'Not stubbed', '')
    }
    intakeCalls += 1
    if (relay === 'unreachable') throw new TypeError('Failed to fetch')
    if (relay === 'refuses') return fakeResponse(false, 502, 'Bad Gateway', 'relay refused the message')
    return fakeResponse(true, 200, 'OK', '{"success":"true"}')
  }) as typeof fetch

  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  window.removeEventListener('portfolio:analytics', onAnalytics)
  globalThis.fetch = realFetch
  vi.unstubAllGlobals()
})

/** The provider stack `main.tsx` mounts around every route. */
function withProviders(child: ReactNode): ReactElement {
  return createElement(
    ThemeProvider,
    null,
    createElement(AuthProvider, null, createElement(NotificationProvider, null, child)),
  ) as ReactElement
}

function render(element: ReactElement): void {
  act(() => {
    root.render(withProviders(element))
  })
}

/** Set a React-controlled field the way a real keystroke does. */
function type(field: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const proto =
    field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')!.set!
  act(() => {
    setter.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function submit(form: HTMLFormElement): Promise<void> {
  await act(async () => {
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  })
}

function paramsFor(eventName: string): Record<string, unknown> {
  const match = captured.filter((e) => e.eventName === eventName)
  expect(match, `expected exactly one ${eventName} event, saw ${captured.map((e) => e.eventName).join(', ')}`)
    .toHaveLength(1)
  return match[0].params
}

/** What the visitor types. Asserted back out of the DOM by the v1.25.2
 *  block below, so these must stay distinctive enough to find. */
const TYPED_NAME = 'Jane Smith'
const TYPED_EMAIL = 'jane@company.com'
const TYPED_MESSAGE = 'We need an infrastructure review before launch.'

interface Surface {
  name: string
  event: string
  successCopy: string
  /** The word the surface uses for what was submitted (v1.25.2 copy). */
  noun: 'request' | 'message'
  render: () => void
  fillAndSubmit: () => Promise<void>
  /** The live name/email/message controls, read back after a submit. */
  typedValues: () => string[]
}

const CONTACT_CTA: Surface = {
  name: 'ContactCTA (the closer embedded on Home, About, Services, Pricing, Case Studies, Retainers)',
  event: 'consultation_form_submit',
  successCopy: 'your request is in',
  noun: 'request',
  render: () => render(createElement(ContactCTA)),
  fillAndSubmit: async () => {
    const inputs = [...container.querySelectorAll('input')]
    type(inputs[0], TYPED_NAME)
    type(inputs[1], TYPED_EMAIL)
    type(container.querySelector('textarea')!, TYPED_MESSAGE)
    await submit(container.querySelector('form')!)
  },
  typedValues: () => {
    const inputs = [...container.querySelectorAll('input')]
    const textarea = container.querySelector('textarea')
    return [inputs[0]?.value ?? '', inputs[1]?.value ?? '', textarea?.value ?? '']
  },
}

const CONTACT_PAGE: Surface = {
  name: 'ContactPage (#/contact)',
  event: 'contact_form_submit',
  successCopy: 'Message sent',
  noun: 'message',
  render: () => render(createElement(ContactPage)),
  fillAndSubmit: async () => {
    type(container.querySelector('#name')!, TYPED_NAME)
    type(container.querySelector('#email')!, TYPED_EMAIL)
    type(container.querySelector('#message')!, TYPED_MESSAGE)
    await submit(container.querySelector('#message')!.closest('form')!)
  },
  typedValues: () =>
    ['#name', '#email', '#message'].map(
      (sel) => (container.querySelector(sel) as HTMLInputElement | HTMLTextAreaElement | null)?.value ?? '',
    ),
}

const SURFACES = [CONTACT_CTA, CONTACT_PAGE]

describe.each(SURFACES)('$name', (surface: Surface) => {
  it('renders the success copy and reports delivery_status "sent" when the relay accepts', async () => {
    relay = 'accepts'
    surface.render()
    await surface.fillAndSubmit()

    expect(intakeCalls, 'the intake relay must actually have been called').toBe(1)
    expect(otherFetches, 'no other fetch may borrow the relay stub').toEqual([])
    expect(container.textContent).toContain(surface.successCopy)
    expect(container.textContent).not.toContain(FAILURE_COPY)
    expect(paramsFor(surface.event).delivery_status).toBe('sent')
  })

  it('withholds the success copy and reports delivery_status "failed" when the relay refuses', async () => {
    relay = 'refuses'
    surface.render()
    await surface.fillAndSubmit()

    expect(intakeCalls, 'the intake relay must actually have been called').toBe(1)
    expect(otherFetches, 'no other fetch may borrow the relay stub').toEqual([])
    expect(
      container.textContent,
      'a lead the relay refused must never render as delivered',
    ).not.toContain(surface.successCopy)
    expect(container.textContent).toContain(FAILURE_COPY)
    expect(paramsFor(surface.event).delivery_status).toBe('failed')
  })

  it('withholds the success copy and reports delivery_status "failed" when the relay is unreachable', async () => {
    // The ad-blocker / offline repro from LEAD-SILENT-DROP-1: fetch rejects
    // rather than answering, which `submitPublicLead` maps to request-failed.
    relay = 'unreachable'
    surface.render()
    await surface.fillAndSubmit()

    expect(intakeCalls, 'the intake relay must actually have been called').toBe(1)
    expect(otherFetches, 'no other fetch may borrow the relay stub').toEqual([])
    expect(container.textContent).not.toContain(surface.successCopy)
    expect(container.textContent).toContain(FAILURE_COPY)
    expect(paramsFor(surface.event).delivery_status).toBe('failed')
  })
})

/**
 * v1.25.2 (ROADMAP decision D-19): a failed lead is RECOVERABLE.
 *
 * v1.25.1 stopped the lie; it did not stop the loss. Both handlers still ran
 * `setName('') / setEmail('') / setMessage('')` on every path, so the honest
 * failure panel it shipped was painted over an emptied form: the visitor was
 * told their request never arrived, and the text they would have had to
 * retype had already been destroyed. The panel's own remedy was prose — an
 * email address to copy by hand.
 *
 * These cases are the behaviour difference (L-001) for that slice. They are
 * rendering assertions on the REAL components for the same reason the block
 * above is: `grep buildRecoveryMailtoHref` is satisfied by an import nothing
 * renders, and a `setDraft`-style ordering fix is invisible to any source
 * scan (L-033). Restore either handler's unconditional clear, or drop the
 * notice from either surface, and these go red while the v1.25.1 cases above
 * and `leadIntake.test.ts` both stay green.
 */
describe.each(SURFACES)('$name — v1.25.2 recovery (D-19)', (surface: Surface) => {
  it('keeps every typed value when the relay refuses, so nothing must be retyped', async () => {
    relay = 'refuses'
    surface.render()
    await surface.fillAndSubmit()

    expect(intakeCalls, 'the intake relay must actually have been called').toBe(1)
    expect(
      surface.typedValues(),
      'a refused submit must leave the visitor with what they typed',
    ).toEqual([TYPED_NAME, TYPED_EMAIL, TYPED_MESSAGE])
  })

  it('offers a mailto carrying the same payload the relay was handed', async () => {
    relay = 'refuses'
    surface.render()
    await surface.fillAndSubmit()

    // Scoped to the notice itself: ContactPage's page footer carries a plain
    // `mailto:` all the time, so a container-wide search would pass on that
    // one and never notice the recovery link was missing.
    const notice = container.querySelector('[role="alert"]')
    expect(notice, 'the failure state must render the recovery notice').toBeTruthy()
    const mailto = [...notice!.querySelectorAll('a')].find((a) =>
      a.getAttribute('href')?.startsWith('mailto:'),
    )
    expect(mailto, 'the failure state must offer a working mail escape hatch').toBeTruthy()

    const href = mailto!.getAttribute('href')!
    expect(href.startsWith(`mailto:${OWNER_EMAIL}?`), `unexpected recipient in ${href}`).toBe(true)
    // Decoded, because the body is percent-encoded: an assertion on the raw
    // href would pass on a link no mail client could open.
    const body = decodeURIComponent(new URL(href).searchParams.get('body') ?? '')
    for (const typed of [TYPED_NAME, TYPED_EMAIL, TYPED_MESSAGE]) {
      expect(body, `the recovery mail must carry "${typed}"`).toContain(typed)
    }
  })

  it('offers the booking link as the second recovery path', async () => {
    relay = 'refuses'
    surface.render()
    await surface.fillAndSubmit()

    const notice = container.querySelector('[role="alert"]')
    expect(notice, 'the failure state must render the recovery notice').toBeTruthy()
    const booking = [...notice!.querySelectorAll('a')].filter(
      (a) => a.getAttribute('href') === SCHEDULING_URL,
    )
    expect(
      booking.length,
      'the failure state must reach the same booking URL the page already trusts',
    ).toBeGreaterThan(0)
  })

  it('shows no recovery notice when the relay accepts, so it is failure-only', async () => {
    relay = 'accepts'
    surface.render()
    await surface.fillAndSubmit()

    expect(container.textContent).toContain(surface.successCopy)
    expect(
      container.querySelector('[role="alert"]'),
      'a delivered lead must not be offered a recovery path',
    ).toBeNull()
  })

  it("names what failed using the surface's own noun", async () => {
    relay = 'refuses'
    surface.render()
    await surface.fillAndSubmit()
    expect(container.textContent).toContain(`Your ${surface.noun} did not reach my inbox.`)
  })
})

describe('v1.25.2: a DELIVERED lead really does clear the form', () => {
  it('ContactPage empties every field behind "Send another message"', async () => {
    // The success path unmounts the form, so "the fields are empty" can only
    // be observed by walking back to it — otherwise the assertion would pass
    // on a form that is merely absent, which is also true of a crash.
    relay = 'accepts'
    CONTACT_PAGE.render()
    await CONTACT_PAGE.fillAndSubmit()
    expect(container.textContent).toContain('Message sent')

    const again = [...container.querySelectorAll('button')].find(
      (b) => b.textContent === 'Send another message',
    )
    expect(again, 'the success panel must offer a way back to the form').toBeTruthy()
    await act(async () => {
      again!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(CONTACT_PAGE.typedValues()).toEqual(['', '', ''])
  })
})

describe('D-18: the widening adds to the existing series rather than replacing it', () => {
  it('the existing consultation_form_submit payload keys are preserved, not replaced', async () => {
    relay = 'accepts'
    CONTACT_CTA.render()
    await CONTACT_CTA.fillAndSubmit()
    const params = paramsFor('consultation_form_submit')
    for (const key of ['engagement', 'budget', 'timeline', 'leadPriority', 'referral_source']) {
      expect(Object.keys(params), `${key} must survive the D-18 widening`).toContain(key)
    }
  })
})

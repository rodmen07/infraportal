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
import { LEAD_INTAKE_URL } from '../../config'
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

interface Surface {
  name: string
  event: string
  successCopy: string
  render: () => void
  fillAndSubmit: () => Promise<void>
}

const CONTACT_CTA: Surface = {
  name: 'ContactCTA (the closer embedded on Home, About, Services, Pricing, Case Studies, Retainers)',
  event: 'consultation_form_submit',
  successCopy: 'your request is in',
  render: () => render(createElement(ContactCTA)),
  fillAndSubmit: async () => {
    const inputs = [...container.querySelectorAll('input')]
    type(inputs[0], 'Jane Smith')
    type(inputs[1], 'jane@company.com')
    type(container.querySelector('textarea')!, 'We need an infrastructure review before launch.')
    await submit(container.querySelector('form')!)
  },
}

const CONTACT_PAGE: Surface = {
  name: 'ContactPage (#/contact)',
  event: 'contact_form_submit',
  successCopy: 'Message sent',
  render: () => render(createElement(ContactPage)),
  fillAndSubmit: async () => {
    type(container.querySelector('#name')!, 'Jane Smith')
    type(container.querySelector('#email')!, 'jane@company.com')
    type(container.querySelector('#message')!, 'We need an infrastructure review before launch.')
    await submit(container.querySelector('#message')!.closest('form')!)
  },
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

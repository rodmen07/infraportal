// @vitest-environment jsdom
/**
 * v1.23.1: the five remaining CRM tabs on the `useResource` seam.
 *
 * The done-when this file encodes: the first rendered frame of a tab is its
 * loading (or refusal) state and NEVER its empty state. The old loaders ran
 * their guards and `setLoading(true)` inside the mount effect, i.e. after the
 * first commit, so every one of these tabs painted a "nothing here" card for
 * one frame before correcting itself.
 *
 * The first-frame proof works by SPYING ON THE EMPTY-STATE COMPONENT rather
 * than reading the final DOM: `CustomEmptyState` is wrapped in a `vi.fn`, so
 * if any render pass -- including the corrected-away first frame the old
 * shape produced -- ever mounts the empty state while a fetch is pending or a
 * load is refused, the spy records it and the assertion reddens. Restoring
 * any tab's pre-v1.23.1 version from origin/main fails its pending-fetch case
 * here (and fails `eslint .` outright, since the tab is no longer on
 * `SET_STATE_IN_EFFECT_LEGACY`).
 *
 * Harness: the `react-dom/client` + `act` precedent from
 * `useResource.test.ts`, whose contract C covers `ActivitiesTab` the same way.
 */
import { act, createElement } from 'react'
import type { ReactElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AccountsTab } from './AccountsTab'
import { ContactsTab } from './ContactsTab'
import { OpportunitiesTab } from './OpportunitiesTab'
import { ProjectsTab } from './ProjectsTab'
import { SpendTab } from './SpendTab'
import { CustomEmptyState, NO_TOKEN_MSG } from './ui'

vi.mock('./ui', async (importOriginal) => {
  const original = await importOriginal<typeof import('./ui')>()
  return { ...original, CustomEmptyState: vi.fn(original.CustomEmptyState) }
})

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const emptyStateSpy = vi.mocked(CustomEmptyState)

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  localStorage.clear()
  emptyStateSpy.mockClear()
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  vi.unstubAllGlobals()
  localStorage.clear()
})

/** A never-expiring token in the shape `resolveAdminToken` accepts. */
function validToken(): string {
  const body = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  return `${btoa(JSON.stringify({ alg: 'HS256' }))}.${body}.sig`
}

/** Flush the mount effect plus the microtask its promise settles on. */
async function flush(): Promise<void> {
  await act(async () => {})
  await act(async () => {})
}

function stubFetch(respond: (url: string) => unknown) {
  const stub = vi.fn(async (url: string) => ({
    ok: true,
    status: 200,
    statusText: 'OK',
    json: async () => respond(url),
  }))
  vi.stubGlobal('fetch', stub)
  return stub
}

function stubPendingFetch() {
  const stub = vi.fn(() => new Promise(() => {}))
  vi.stubGlobal('fetch', stub)
  return stub
}

const stamps = { created_at: '2026-08-01T10:00:00Z', updated_at: '2026-08-01T10:00:00Z' }

type TabCase = {
  name: string
  element: () => ReactElement
  loadingLabel: string
  emptyTitle: string
  rowText: string
  /** Body for the loaded case, keyed off the requested URL. */
  respond: (url: string) => unknown
  /** Body for the loaded-but-empty case. */
  respondEmpty: (url: string) => unknown
  /** Tabs whose load is refused without an admin token. */
  tokenGated: boolean
}

const spendSummaryEmpty = { total_usd: 0, by_platform: [], by_month: [] }

const TABS: TabCase[] = [
  {
    name: 'AccountsTab',
    element: () => createElement(AccountsTab),
    loadingLabel: 'Loading accounts…',
    emptyTitle: 'No accounts yet',
    rowText: 'Acme Systems',
    respond: () => ({ data: [{ id: 'acc-1', name: 'Acme Systems', domain: 'acme.io', status: 'active', ...stamps }], total: 1, limit: 100, offset: 0 }),
    respondEmpty: () => ({ data: [], total: 0, limit: 100, offset: 0 }),
    tokenGated: true,
  },
  {
    name: 'ContactsTab',
    element: () => createElement(ContactsTab, {}),
    loadingLabel: 'Loading contacts…',
    emptyTitle: 'No contacts yet',
    rowText: 'Ada Lovelace',
    respond: () => ({ data: [{ id: 'con-1', first_name: 'Ada', last_name: 'Lovelace', email: 'ada@acme.io', lifecycle_stage: 'lead', ...stamps }], total: 1, limit: 100, offset: 0 }),
    respondEmpty: () => ({ data: [], total: 0, limit: 100, offset: 0 }),
    tokenGated: true,
  },
  {
    name: 'OpportunitiesTab',
    element: () => createElement(OpportunitiesTab),
    loadingLabel: 'Loading opportunities…',
    emptyTitle: 'No opportunities yet',
    rowText: 'Q3 renewal',
    respond: () => [{ id: 'opp-1', account_id: 'acc-1', name: 'Q3 renewal', stage: 'proposal', amount: 4500, ...stamps }],
    respondEmpty: () => [],
    tokenGated: true,
  },
  {
    name: 'ProjectsTab',
    element: () => createElement(ProjectsTab),
    loadingLabel: 'Loading projects…',
    emptyTitle: 'No projects yet',
    rowText: 'Portal revamp',
    respond: () => [{
      id: 'proj-1', account_id: 'acc-1', client_user_id: null, name: 'Portal revamp',
      description: null, status: 'active', budget: null, start_date: null,
      target_end_date: null, ...stamps,
    }],
    respondEmpty: () => [],
    tokenGated: false,
  },
  {
    name: 'SpendTab',
    element: () => createElement(SpendTab),
    loadingLabel: 'Loading spend data…',
    emptyTitle: 'No spend records found',
    rowText: 'Cloud Run',
    respond: (url) =>
      url.includes('/spend/summary')
        ? { total_usd: 12.34, by_platform: [{ platform: 'gcp', total_usd: 12.34 }], by_month: [] }
        : { data: [{ id: 'sp-1', platform: 'gcp', date: '2026-07-31', amount_usd: 12.34, granularity: 'daily', service_label: 'Cloud Run', source: 'manual', ...stamps }], total: 1, limit: 200, offset: 0 },
    respondEmpty: (url) => (url.includes('/spend/summary') ? spendSummaryEmpty : { data: [], total: 0, limit: 200, offset: 0 }),
    tokenGated: true,
  },
]

describe.each(TABS)('$name on the seam', (tab) => {
  it('first frame is the loading state; the empty state never renders while the fetch is pending', async () => {
    localStorage.setItem('portal_token', validToken())
    stubPendingFetch()

    await act(async () => {
      root.render(tab.element())
    })

    expect(container.textContent).toContain(tab.loadingLabel)
    expect(container.textContent).not.toContain(tab.emptyTitle)
    // The first-frame proof: the old loader shape MOUNTED the empty state on
    // the pre-effect frame and corrected it afterwards; the spy sees every
    // render pass, so that flash cannot hide behind the final DOM.
    expect(emptyStateSpy).not.toHaveBeenCalled()
  })

  it('renders the rows once they have loaded', async () => {
    localStorage.setItem('portal_token', validToken())
    stubFetch(tab.respond)

    await act(async () => {
      root.render(tab.element())
    })
    await flush()

    expect(container.textContent).toContain(tab.rowText)
    expect(container.textContent).not.toContain(tab.loadingLabel)
  })

  it('renders the empty state only once an empty list has actually loaded', async () => {
    localStorage.setItem('portal_token', validToken())
    stubFetch(tab.respondEmpty)

    await act(async () => {
      root.render(tab.element())
    })
    await flush()

    expect(container.textContent).toContain(tab.emptyTitle)
  })

  if (tab.tokenGated) {
    it('paints the refusal on the first frame, never calls fetch, and never mounts the empty state', async () => {
      const stub = stubPendingFetch()

      await act(async () => {
        root.render(tab.element())
      })
      await flush()

      expect(container.textContent).toContain(NO_TOKEN_MSG)
      expect(container.textContent).not.toContain(tab.emptyTitle)
      expect(stub).not.toHaveBeenCalled()
      expect(emptyStateSpy).not.toHaveBeenCalled()
    })
  }
})

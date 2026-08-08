// @vitest-environment jsdom
/**
 * Deep-link wiring tests for the API docs explorer (v1.17.3): a cold load of
 * #/api-docs?service=X&op=Y selects the service and expands the requested
 * operation card; selecting a service keeps the address bar sharable; and
 * in-page hash navigation re-targets the explorer.
 */

import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { POLL_INTERVAL_MS, waitForSelector } from '../../lib/waitForSelector'
import { ApiSpecExplorer } from './ApiSpecExplorer'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
  window.history.replaceState(null, '', '#/api-docs')
})

function render(): void {
  act(() => {
    root.render(createElement(ApiSpecExplorer))
  })
}

/**
 * Waits until the lazily loaded spec chunk has rendered the selector.
 *
 * This used to carry its own `attempt < 40` bound, a second liveness budget
 * that nothing measured and the repo's guarded per-test timeout could not see;
 * under contention the cold chunk load costs up to 1801ms against that bound's
 * nominal 400ms, and it flaked the required "Unit Tests" context twice in two
 * days (ASPECEXPLORER-WAITFOR-1). The budget now comes from `ctx.task.timeout`,
 * the value the runner is enforcing on the calling test.
 */
async function waitFor(ctx: { task: { timeout: number } }, selector: string): Promise<Element> {
  return waitForSelector(container, selector, {
    testTimeoutMs: ctx.task.timeout,
    tick: () =>
      act(async () => {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))
      }),
  })
}

function serviceButton(name: string): HTMLButtonElement {
  const match = [...container.querySelectorAll('button')].find((button) =>
    button.textContent?.includes(name),
  )
  expect(match, `service button "${name}" not found`).toBeDefined()
  return match!
}

describe('ApiSpecExplorer deep links', () => {
  it('cold-loads a deep link: selects the service and expands the operation card', async (ctx) => {
    window.location.hash = '#/api-docs?service=accounts&op=updateAccount'
    render()

    const card = await waitFor(ctx, 'details[data-op-card="updateAccount"]')
    expect((card as HTMLDetailsElement).open).toBe(true)

    // Sibling operations stay collapsed; the accounts service is selected.
    const other = container.querySelector('details[data-op-card="getAccount"]')
    expect(other).not.toBeNull()
    expect((other as HTMLDetailsElement).open).toBe(false)
    expect(serviceButton('Accounts').getAttribute('aria-pressed')).toBe('true')
  })

  it('falls back to the first service for an unknown service id', async (ctx) => {
    window.location.hash = '#/api-docs?service=nope&op=whatever'
    render()
    await waitFor(ctx, 'details[data-op-card]')
    expect(serviceButton('Accounts').getAttribute('aria-pressed')).toBe('true')
    expect(container.querySelector('details[open]')).toBeNull()
  })

  it('keeps the address bar sharable when a service is selected', async (ctx) => {
    window.location.hash = '#/api-docs'
    render()
    await waitFor(ctx, 'details[data-op-card]')

    act(() => {
      serviceButton('Contacts').dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    expect(window.location.hash).toBe('#/api-docs?service=contacts')
    await waitFor(ctx, 'details[data-op-card="listContacts"]')
  })

  it('follows in-page hash navigation to another operation', async (ctx) => {
    window.location.hash = '#/api-docs?service=accounts'
    render()
    await waitFor(ctx, 'details[data-op-card="deleteAccount"]')
    expect(
      (container.querySelector('details[data-op-card="deleteAccount"]') as HTMLDetailsElement).open,
    ).toBe(false)

    act(() => {
      window.history.replaceState(null, '', '#/api-docs?service=accounts&op=deleteAccount')
      window.dispatchEvent(new Event('hashchange'))
    })
    const card = await waitFor(ctx, 'details[data-op-card="deleteAccount"]')
    expect((card as HTMLDetailsElement).open).toBe(true)
  })
})

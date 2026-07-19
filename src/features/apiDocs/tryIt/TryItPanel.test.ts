// @vitest-environment jsdom
/**
 * End-to-end wiring test for the Try it panel: renders the real component
 * against the shared demo adapter (module singleton stores), drives the demo
 * id chips and Execute button through DOM events, and asserts the simulated
 * response renders. Complements the node-env adapter and form-model suites.
 */

import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { loadSpec } from '../../../api-specs'
import { extractOperations, type OperationView } from '../specModel'
import { TryItPanel } from './TryItPanel'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let accountsOps: Map<string, OperationView>
let searchOps: Map<string, OperationView>

beforeAll(async () => {
  accountsOps = new Map(
    extractOperations(await loadSpec('accounts')).map((op) => [op.operationId, op]),
  )
  searchOps = new Map(extractOperations(await loadSpec('search')).map((op) => [op.operationId, op]))
})

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
})

function render(serviceId: string, operation: OperationView): void {
  act(() => {
    root.render(createElement(TryItPanel, { serviceId, operation }))
  })
}

function click(button: HTMLButtonElement): void {
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
  })
}

function buttonByText(text: string): HTMLButtonElement {
  const match = [...container.querySelectorAll('button')].find(
    (b) => b.textContent?.trim() === text,
  )
  expect(match, `button "${text}" not found`).toBeDefined()
  return match!
}

describe('TryItPanel wiring', () => {
  it('executes a read operation via a demo id chip and renders the simulated 200', () => {
    render('accounts', accountsOps.get('getAccount')!)
    expect(container.textContent).toContain('in-browser demo')

    // The demo id chips come from the live store; clicking one fills the path
    // param, and Execute renders the simulated response for that record.
    click(buttonByText('acc-001'))
    click(buttonByText('Execute'))

    expect(container.textContent).toContain('200 OK')
    expect(container.textContent).toContain('Acme Corp')
    expect(container.textContent).toContain('X-RateLimit-Limit')
    expect(container.textContent).toContain('simulated')
  })

  it('blocks execution client-side while a required path parameter is blank', () => {
    render('accounts', accountsOps.get('getAccount')!)
    click(buttonByText('Execute'))
    expect(container.textContent).toContain('required path parameter')
    expect(container.textContent).not.toContain('200 OK')
  })

  it('renders the honest disabled state for a service without a demo dataset', () => {
    render('search', searchOps.get('healthCheck')!)
    expect(container.textContent).toContain('no in-browser demo dataset')
    const execute = buttonByText('Execute')
    expect(execute.disabled).toBe(true)
  })
})

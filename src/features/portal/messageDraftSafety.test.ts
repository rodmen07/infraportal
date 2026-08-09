// @vitest-environment jsdom
/**
 * v1.25.2 draft-safety guard (ROADMAP "v1.25 - The funnel never confirms what
 * it did not deliver", decision D-19; closes PORTAL-DRAFT-LOSS-1).
 *
 * WHAT WENT WRONG. `MessageThread.submit` ran `setDraft('')` BEFORE `await
 * onSend(body)`. `PortalPage.sendMessage` catches its own errors and renders
 * `sendError`, so the await resolved identically whether the POST landed or
 * 500'd — and by then the visitor's typed message had already been erased
 * from the only place it existed. The error banner rendered correctly above
 * an empty box: the failure was VISIBLE and the data was gone anyway, which
 * is why an eyeball review of the error state never caught it.
 *
 * WHY THIS SHAPE. The ordering is invisible to every source scan the repo
 * already runs (L-033) and the component had NO test of any kind before this
 * file, so the first coverage goes on the oldest untested surface rather than
 * deepening the new one. The two directions are driven through the real
 * component with a real form submit; the sender's answer is the only thing
 * that varies between them, which is exactly the contract the fix introduced.
 *
 * WHAT THIS DOES NOT PROVE. It gates the CONSUMER (`MessageThread`), not the
 * producer: `PortalPage.sendMessage` returning the right boolean on each of
 * its four paths is held by `tsc` alone (a `Promise<boolean>` rejects every
 * bare `return`), not by a rendering test — mounting PortalPage needs a
 * configured API base URL, a token and a snapshot fetch. Filed as
 * PORTAL-SENDER-UNTESTED-1 rather than claimed here (L-046).
 */
import { act, createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { MessageThread } from './projectDetail'
import type { Message } from './types'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const DRAFT = 'Can you re-run the migration on staging?'

let container: HTMLDivElement
let root: Root
/** Every body the component handed to the sender, in order. */
let sentBodies: string[]

beforeEach(() => {
  // The thread scrolls its bottom sentinel into view on every message change;
  // jsdom ships no scrollIntoView at all, so the real effect would throw.
  Element.prototype.scrollIntoView = function scrollIntoView() {}
  sentBodies = []
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

/** Mounts the real thread with a sender that answers `answer`. */
function renderThread(answer: boolean, messages: Message[] = []): void {
  act(() => {
    root.render(
      createElement(MessageThread, {
        messages,
        currentUserId: 'user-1',
        sending: false,
        sendError: answer ? null : 'Failed to send message.',
        onSend: async (body: string) => {
          sentBodies.push(body)
          return answer
        },
      }),
    )
  })
}

function draftField(): HTMLInputElement {
  const field = container.querySelector('input[type="text"]') as HTMLInputElement | null
  expect(field, 'the thread must render a draft field').toBeTruthy()
  return field!
}

/** Set a React-controlled field the way a real keystroke does. */
function type(field: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
  act(() => {
    setter.call(field, value)
    field.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

async function submitDraft(): Promise<void> {
  await act(async () => {
    container.querySelector('form')!.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    )
  })
}

describe('MessageThread draft safety (PORTAL-DRAFT-LOSS-1)', () => {
  it('keeps the draft when the send fails', async () => {
    renderThread(false)
    type(draftField(), DRAFT)
    await submitDraft()

    expect(sentBodies, 'the sender must actually have been called').toEqual([DRAFT])
    expect(
      draftField().value,
      'a message the API refused must still be in the box, not destroyed',
    ).toBe(DRAFT)
  })

  it('clears the draft when the send succeeds', async () => {
    renderThread(true)
    type(draftField(), DRAFT)
    await submitDraft()

    expect(sentBodies).toEqual([DRAFT])
    expect(draftField().value, 'a delivered message must not be left in the box').toBe('')
  })

  it('trims before sending and does not send a whitespace-only draft', async () => {
    renderThread(true)
    type(draftField(), `  ${DRAFT}  `)
    await submitDraft()
    expect(sentBodies, 'the sender receives the trimmed body').toEqual([DRAFT])

    type(draftField(), '   ')
    await submitDraft()
    expect(sentBodies, 'whitespace alone must never reach the API').toEqual([DRAFT])
    expect(draftField().value, 'and the whitespace draft is left alone').toBe('   ')
  })

  it('renders the send error the failing path produces', async () => {
    renderThread(false)
    type(draftField(), DRAFT)
    await submitDraft()
    expect(container.textContent).toContain('Failed to send message.')
  })
})

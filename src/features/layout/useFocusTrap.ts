// ---------------------------------------------------------------------------
// useFocusTrap (v1.18.2 PR1): shared overlay keyboard behaviour for finding
// F11 of the v1.18 UX audit (docs/design/V1_18_UX_THEME.md section 2). It
// gives an open overlay three things it lacked:
//   1. Escape closes it (calls onClose).
//   2. Tab / Shift+Tab are trapped inside the overlay, so keyboard focus
//      cannot wander behind the modal into the page underneath.
//   3. Focus moves to the first focusable element on open, and returns to
//      whatever element opened the overlay (the trigger) on close/unmount.
//
// Usage: attach the returned ref to the overlay's outermost element and pass
// `active` (the open flag) plus the same `onClose` the overlay already uses.
// The overlay may unmount when it closes (SlideOver returns null); the effect
// cleanup still restores focus because it captured the trigger on open.
//
// onClose is read through a ref so a fresh inline `() => setOpen(false)` from
// the caller does not re-run the effect on every render (which would re-steal
// focus and re-capture the "previously focused" element). The effect depends
// only on `active`.
// ---------------------------------------------------------------------------
import { useEffect, useRef } from 'react'

// Exported so a test can compute the SAME ordered focusable set the trap uses
// (v1.24.1); a private copy in the test would be a second source of truth for
// what "the last focusable element" means.
export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

export function useFocusTrap<T extends HTMLElement>(
  active: boolean,
  onClose: () => void,
) {
  const containerRef = useRef<T>(null)
  const onCloseRef = useRef(onClose)

  // Keep the latest onClose without re-running the trap effect (a fresh
  // inline `() => setOpen(false)` from the caller would otherwise re-steal
  // focus on every render). Synced in an effect, never during render.
  useEffect(() => {
    onCloseRef.current = onClose
  })

  useEffect(() => {
    if (!active) return
    if (typeof document === 'undefined') return

    const container = containerRef.current
    const previouslyFocused = document.activeElement as HTMLElement | null

    const focusableElements = () => {
      if (!container) return [] as HTMLElement[]
      return Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute('disabled') && el.tabIndex !== -1)
    }

    // Move focus into the overlay so the next Tab keeps the user inside it.
    focusableElements()[0]?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== 'Tab') return

      const items = focusableElements()
      if (items.length === 0) {
        event.preventDefault()
        return
      }

      const first = items[0]
      const last = items[items.length - 1]
      const activeEl = document.activeElement

      if (event.shiftKey && activeEl === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && activeEl === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      // Return focus to the trigger that opened the overlay.
      previouslyFocused?.focus?.()
    }
  }, [active])

  return containerRef
}

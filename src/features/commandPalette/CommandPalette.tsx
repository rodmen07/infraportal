import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { COMMANDS, type Command } from './commands'
import { filterCommands } from './search'
import { PALETTE_OPEN_EVENT } from './paletteEvents'
import { useFocusTrap } from '../layout/useFocusTrap'

// A Cmd/Ctrl-K command palette for fast keyboard navigation across the site.
// All matching/data lives in the tested pure modules (commands.ts, search.ts);
// this component owns only the overlay, focus management, and key handling.
//
// v1.24.2 (D-14): this overlay declares aria-modal="true", so it owes the
// keyboard the whole modal contract. It used to hand-roll three quarters of it
// (Escape on the input only, focus-in, and a private restoreFocusRef) and had
// no Tab trap at all, so Tab off the last result walked straight into the page
// the aria-modal had just told assistive technology was inert. It now adopts
// the shared `useFocusTrap` seam, and the two hand-rolled halves the hook
// subsumes are DELETED rather than left to drift beside it:
//   - Escape: the hook listens on document, so Escape now closes the palette
//     from a result row too, not only while focus sits in the search input.
//   - focus restore: the hook captures the trigger when it opens and restores
//     it on close, which is exactly what restoreFocusRef did by hand.
// The input-focus effect below is KEPT, because "focus the search box" is the
// palette's own behaviour and is more specific than "focus the first focusable".

function navigate(command: Command) {
  if (command.external) {
    window.open(command.href, '_blank', 'noopener,noreferrer')
    return
  }
  window.location.hash = command.href
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const results = useMemo(() => filterCommands(COMMANDS, query), [query])

  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
    setSelected(0)
  }, [])

  const openPalette = useCallback(() => {
    setOpen(true)
  }, [])

  // Escape, the Tab/Shift+Tab trap, focus-in and focus-return-to-trigger, all
  // from the one shared implementation. `open` (not a literal `true`) is the
  // active flag because this component stays mounted for the app's whole life
  // and renders null while closed: an always-active trap would swallow Tab and
  // Escape across the entire site.
  const containerRef = useFocusTrap<HTMLDivElement>(open, close)

  // Global shortcut: Cmd/Ctrl-K toggles the palette from anywhere.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (open) close()
        else openPalette()
      }
    }
    const onOpenRequest = () => {
      if (!open) openPalette()
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener(PALETTE_OPEN_EVENT, onOpenRequest)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener(PALETTE_OPEN_EVENT, onOpenRequest)
    }
  }, [open, close, openPalette])

  // Focus the input and lock body scroll while open.
  useEffect(() => {
    if (!open) return
    inputRef.current?.focus()
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prevOverflow
    }
  }, [open])

  // Keep the highlighted row scrolled into view.
  useEffect(() => {
    if (!open) return
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${selected}"]`)
    el?.scrollIntoView({ block: 'nearest' })
  }, [selected, open])

  if (!open) return null

  // Escape is deliberately absent here: useFocusTrap owns it at the document
  // level, so it closes the palette wherever focus sits, not just in the input.
  const onInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelected((i) => (results.length === 0 ? 0 : (i + 1) % results.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelected((i) => (results.length === 0 ? 0 : (i - 1 + results.length) % results.length))
    } else if (e.key === 'Home') {
      e.preventDefault()
      setSelected(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      setSelected(Math.max(0, results.length - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const command = results[selected]
      if (command) {
        close()
        navigate(command)
      }
    }
  }

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-[100] flex items-start justify-center p-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 h-full w-full cursor-default bg-black/60"
        onClick={close}
        tabIndex={-1}
      />

      <div className="forge-panel surface-card-strong relative z-10 flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden p-0">
        <div className="border-b border-border-soft p-3">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              // Reset the highlight to the top as the result set changes; done
              // here rather than in an effect to avoid a cascading render.
              setSelected(0)
            }}
            onKeyDown={onInputKeyDown}
            placeholder="Search pages, case studies, the platform…"
            aria-label="Search"
            aria-controls="command-palette-list"
            autoComplete="off"
            spellCheck={false}
            className="w-full bg-transparent px-2 py-1.5 text-sm text-text-primary placeholder-text-subtle focus:outline-none"
          />
        </div>

        <ul
          id="command-palette-list"
          ref={listRef}
          role="listbox"
          aria-label="Results"
          className="flex-1 overflow-y-auto p-2"
        >
          {results.length === 0 && (
            <li className="px-3 py-6 text-center text-sm text-text-subtle">No matches for “{query}”</li>
          )}
          {results.map((command, i) => {
            const showHeader = query.trim() === '' && (i === 0 || results[i - 1].group !== command.group)
            return (
              <li key={command.id}>
                {showHeader && (
                  <div className="px-3 pb-1 pt-3 text-scale-xs font-semibold uppercase tracking-wider text-text-subtle">
                    {command.group}
                  </div>
                )}
                <button
                  type="button"
                  data-index={i}
                  role="option"
                  aria-selected={i === selected}
                  onClick={() => {
                    close()
                    navigate(command)
                  }}
                  onMouseMove={() => setSelected(i)}
                  className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                    i === selected
                      ? 'bg-accent-soft text-text-primary'
                      : 'text-text-secondary hover:bg-surface-hover'
                  }`}
                >
                  <span className="truncate">{command.label}</span>
                  <span className="flex-shrink-0 text-xs text-text-subtle">{command.group}</span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="flex items-center justify-between border-t border-border-soft px-3 py-2 text-scale-xs text-text-subtle">
          <span>
            <kbd className="rounded border border-border-soft px-1">↑</kbd>{' '}
            <kbd className="rounded border border-border-soft px-1">↓</kbd> to navigate
          </span>
          <span>
            <kbd className="rounded border border-border-soft px-1">↵</kbd> to open ·{' '}
            <kbd className="rounded border border-border-soft px-1">esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  )
}

import { useState, useCallback, useRef, useEffect, ReactNode } from 'react'
import { ShortcutsContext } from './ShortcutsContext'
import { ShortcutsHelp } from './ShortcutsHelp'
import type { RegisteredShortcut, ShortcutsContextType } from '../../types'

interface ShortcutProviderProps {
  children: ReactNode
}

export function ShortcutProvider({ children }: ShortcutProviderProps) {
  const [shortcuts, setShortcuts] = useState<RegisteredShortcut[]>([])
  const [showHelp, setShowHelp] = useState(false)
  const shortcutsRef = useRef<RegisteredShortcut[]>([])
  const keySequenceRef = useRef<string>('')
  const sequenceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const registerShortcut = useCallback((shortcut: RegisteredShortcut) => {
    shortcutsRef.current = [...shortcutsRef.current, shortcut]
    setShortcuts([...shortcutsRef.current])

    return () => {
      shortcutsRef.current = shortcutsRef.current.filter(s => s !== shortcut)
      setShortcuts([...shortcutsRef.current])
    }
  }, [])

  const contextValue: ShortcutsContextType = {
    shortcuts,
    registerShortcut,
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't capture shortcuts in input, textarea, or contenteditable unless explicitly allowed
      const target = e.target as HTMLElement
      const isEditableElement =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.contentEditable === 'true'

      // Always handle Shift+/ for help overlay
      if (e.shiftKey && e.key === '?') {
        e.preventDefault()
        setShowHelp(prev => !prev)
        return
      }

      // Build current key event representation
      let keyStr = ''
      if (e.ctrlKey || e.metaKey) keyStr += 'mod+'
      if (e.altKey) keyStr += 'alt+'
      if (e.shiftKey) keyStr += 'shift+'
      keyStr += e.key.toLowerCase()

      // Check for modifier-only shortcuts (e.g., mod+k)
      const matchingModShortcut = shortcutsRef.current.find(s => s.keys === keyStr)

      if (isEditableElement && !matchingModShortcut?.allowInInput) {
        return
      }

      if (matchingModShortcut) {
        e.preventDefault()
        matchingModShortcut.callback()
        keySequenceRef.current = ''
        if (sequenceTimeoutRef.current) clearTimeout(sequenceTimeoutRef.current)
        return
      }

      // Handle chord sequences (e.g., "g h", "g d")
      // Only for letter keys without modifiers
      if (!e.ctrlKey && !e.metaKey && !e.altKey && e.key.length === 1) {
        keySequenceRef.current += e.key.toLowerCase()

        // Clear previous timeout
        if (sequenceTimeoutRef.current) clearTimeout(sequenceTimeoutRef.current)

        // Look for matching sequences
        const matchingSeqShortcut = shortcutsRef.current.find(
          s => s.keys === keySequenceRef.current
        )

        if (matchingSeqShortcut) {
          e.preventDefault()
          matchingSeqShortcut.callback()
          keySequenceRef.current = ''
          return
        }

        // Check if we're on a valid path
        const hasValidPrefix = shortcutsRef.current.some(s =>
          s.keys.startsWith(keySequenceRef.current)
        )

        if (!hasValidPrefix) {
          keySequenceRef.current = e.key.toLowerCase()
        }

        // Reset sequence after 1 second of inactivity
        sequenceTimeoutRef.current = setTimeout(() => {
          keySequenceRef.current = ''
        }, 1000)

        e.preventDefault()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (sequenceTimeoutRef.current) clearTimeout(sequenceTimeoutRef.current)
    }
  }, [])

  return (
    <ShortcutsContext.Provider value={contextValue}>
      {children}
      {showHelp && <ShortcutsHelp onClose={() => setShowHelp(false)} shortcuts={shortcuts} />}
    </ShortcutsContext.Provider>
  )
}

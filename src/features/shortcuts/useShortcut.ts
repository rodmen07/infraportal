import { useContext, useEffect } from 'react'
import { ShortcutsContext } from './ShortcutsContext'
import type { RegisteredShortcut } from '../../types'

export function useShortcut(
  keys: string,
  description: string,
  scope: string,
  callback: () => void,
  allowInInput = false
): void {
  const context = useContext(ShortcutsContext)

  useEffect(() => {
    if (!context) {
      console.warn('useShortcut must be used within ShortcutProvider')
      return
    }

    const shortcut: RegisteredShortcut = {
      keys,
      description,
      scope,
      callback,
      allowInInput,
    }

    const unregister = context.registerShortcut(shortcut)

    return () => {
      unregister()
    }
  }, [keys, description, scope, callback, allowInInput, context])
}



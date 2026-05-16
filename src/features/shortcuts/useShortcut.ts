import { useContext, useEffect } from 'react'
import { ShortcutsContext } from './ShortcutProvider'
import type { RegisteredShortcut } from '../../types'

export function useShortcut(
  keys: string,
  description: string,
  scope: string,
  callback: () => void,
  allowInInput = false
): void {
  const context = useContext(ShortcutsContext)

  if (!context) {
    console.warn('useShortcut must be used within ShortcutProvider')
    return
  }

  useEffect(() => {
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

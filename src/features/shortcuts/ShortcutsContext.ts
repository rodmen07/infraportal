import { createContext } from 'react'
import type { ShortcutsContextType } from '../../types'

export const ShortcutsContext = createContext<ShortcutsContextType | null>(null)

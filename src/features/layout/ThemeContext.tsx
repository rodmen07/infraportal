import { createContext, useEffect, useState, type ReactNode } from 'react'

export type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
}

// Default theme is 'dark' (v1.18.1 D1): index.html hardcodes
// data-theme="dark" and its pre-mount script only overrides it from a saved
// localStorage value, so this fallback must match exactly. A mismatch here
// was F3 from the v1.18 UX audit (docs/design/V1_18_UX_THEME.md section 2):
// first-time visitors booted dark, then flipped to light once React mounted.
const DEFAULT_THEME: Theme = 'dark'

const ThemeContext = createContext<ThemeContextValue>({ theme: DEFAULT_THEME, toggle: () => {} })

export { ThemeContext, DEFAULT_THEME }

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    return (localStorage.getItem('theme') as Theme | null) ?? DEFAULT_THEME
  })

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return <ThemeContext.Provider value={{ theme, toggle }}>{children}</ThemeContext.Provider>
}

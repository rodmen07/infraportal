/**
 * F3 regression test (v1.18.1 PR1): default theme + first-load flash.
 *
 * Before this fix (docs/design/V1_18_UX_THEME.md section 2, finding F3):
 * index.html hardcoded data-theme="dark" and its inline pre-mount script
 * only ever applied a *saved* theme, but ThemeProvider defaulted to 'light'
 * whenever localStorage was empty. A first-time visitor's browser therefore
 * painted dark, then React mounted and flipped the page to light. Per D1
 * (docs/design/V1_18_UX_THEME.md section 7), the one binding default is
 * dark. This test locks index.html's hardcoded attribute, its pre-mount
 * script, and ThemeContext's DEFAULT_THEME constant to the same value, so a
 * future edit to any one of the three fails CI instead of reintroducing the
 * boot flash.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { DEFAULT_THEME } from './ThemeContext'

const INDEX_HTML = readFileSync(path.join(process.cwd(), 'index.html'), 'utf-8')

describe('theme boot sequence agrees on one default (F3)', () => {
  it('index.html hardcodes the same default theme as ThemeContext.DEFAULT_THEME', () => {
    const htmlMatch = /<html[^>]*\bdata-theme="([^"]+)"/.exec(INDEX_HTML)
    expect(htmlMatch, 'index.html <html> tag should hardcode a data-theme attribute').not.toBeNull()
    expect(htmlMatch![1]).toBe(DEFAULT_THEME)
  })

  it('DEFAULT_THEME is dark, per D1 (docs/design/V1_18_UX_THEME.md section 7)', () => {
    expect(DEFAULT_THEME).toBe('dark')
  })

  it('the pre-mount script only overrides data-theme from a saved value, never a hardcoded opposite default', () => {
    const scriptMatch = /<script>([\s\S]*?)<\/script>/.exec(INDEX_HTML)
    expect(scriptMatch, 'index.html should have an inline pre-mount script').not.toBeNull()
    const script = scriptMatch![1]

    // It must read localStorage and gate the override on the saved value
    // being a real theme, so an empty/first-time visit leaves the
    // hardcoded default (and DEFAULT_THEME) in effect rather than forcing a
    // different one.
    expect(script).toMatch(/localStorage\.getItem\(['"]theme['"]\)/)
    expect(script).toMatch(/t===['"]light['"]\s*\|\|\s*t===['"]dark['"]/)

    // It must not unconditionally set a theme that would fight the
    // hardcoded <html> default before a saved value is confirmed.
    expect(script).not.toMatch(/setAttribute\(['"]data-theme['"],\s*['"](?:light|dark)['"]\)/)
  })
})

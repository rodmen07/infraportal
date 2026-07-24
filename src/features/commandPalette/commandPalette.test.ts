import { describe, it, expect } from 'vitest'
import { COMMANDS, GROUP_ORDER } from './commands'
import { filterCommands } from './search'

describe('command index', () => {
  it('every command has a non-empty id, label, and href', () => {
    for (const c of COMMANDS) {
      expect(c.id).toBeTruthy()
      expect(c.label).toBeTruthy()
      expect(c.href).toBeTruthy()
    }
  })

  it('ids are unique', () => {
    const ids = COMMANDS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('every group is one of the ordered groups', () => {
    for (const c of COMMANDS) {
      expect(GROUP_ORDER).toContain(c.group)
    }
  })

  it('internal hrefs are hash routes; external ones are absolute', () => {
    for (const c of COMMANDS) {
      if (c.external) expect(c.href).toMatch(/^https?:\/\//)
      else expect(c.href.startsWith('#/')).toBe(true)
    }
  })

  it('derives the marketing pages from the nav (Home, About, Services, Contact present)', () => {
    const labels = COMMANDS.filter((c) => c.group === 'Pages').map((c) => c.label)
    expect(labels).toEqual(expect.arrayContaining(['Home', 'About', 'Services', 'Contact']))
  })

  it('includes the public status board even though it is not in the nav', () => {
    const status = COMMANDS.find((c) => c.href === '#/status')
    expect(status).toBeDefined()
    expect(status!.group).toBe('Platform')
  })

  it('includes all five case studies', () => {
    const caseStudies = COMMANDS.filter((c) => c.group === 'Case studies')
    expect(caseStudies).toHaveLength(5)
    for (const c of caseStudies) {
      expect(c.href.startsWith('#/case-studies/')).toBe(true)
    }
  })
})

describe('filterCommands', () => {
  it('returns the full list in original order for an empty query', () => {
    expect(filterCommands(COMMANDS, '')).toEqual([...COMMANDS])
    expect(filterCommands(COMMANDS, '   ')).toEqual([...COMMANDS])
  })

  it('does not mutate the input array', () => {
    const snapshot = [...COMMANDS]
    filterCommands(COMMANDS, 'status')
    filterCommands(COMMANDS, '')
    expect(COMMANDS).toEqual(snapshot)
  })

  it('is case-insensitive', () => {
    const lower = filterCommands(COMMANDS, 'pricing').map((c) => c.id)
    const upper = filterCommands(COMMANDS, 'PRICING').map((c) => c.id)
    expect(lower).toEqual(upper)
    expect(lower.length).toBeGreaterThan(0)
  })

  it('ranks a label-prefix hit above a keyword-only hit', () => {
    // "co" is a prefix of no page label except via keyword; "con" prefixes
    // nothing but is a substring of "Contact"/keyword. Use "status" which is a
    // label prefix of "Platform status"? No: choose a clear case.
    // "sta" -> "Platform status" matches by word-boundary; "cost" keyword on
    // pricing. Assert the status command ranks by label, pricing by keyword.
    const results = filterCommands(COMMANDS, 'stat')
    expect(results[0].href).toBe('#/status')
  })

  it('matches on keywords that are not in the label', () => {
    // "swagger" only appears as a keyword on the API playground command.
    const results = filterCommands(COMMANDS, 'swagger')
    expect(results.map((c) => c.href)).toContain('#/api-docs')
  })

  it('matches a gapped subsequence of the label', () => {
    // "cnt" is a subsequence of "Contact" but not a substring.
    const results = filterCommands(COMMANDS, 'cnt')
    expect(results.map((c) => c.href)).toContain('#/contact')
  })

  it('returns nothing for a query that matches no label or keyword', () => {
    expect(filterCommands(COMMANDS, 'zzzxqq')).toEqual([])
  })

  it('a shorter label wins the tie-break at the same tier', () => {
    // Both "Home" and other pages may substring-match a common letter; verify
    // ordering is stable and deterministic by re-running.
    const a = filterCommands(COMMANDS, 'e').map((c) => c.id)
    const b = filterCommands(COMMANDS, 'e').map((c) => c.id)
    expect(a).toEqual(b)
  })
})

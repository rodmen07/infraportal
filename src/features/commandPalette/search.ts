// Pure ranking/filtering for the command palette. Kept separate from the
// command data and the React component so the matching behaviour is fully
// unit-testable: given a query and the command list, the ordered result is a
// deterministic function of its inputs.

import type { Command } from './commands'

export interface Match {
  command: Command
  /** Lower is better. Used only for ordering; not shown to the user. */
  score: number
}

// Match tiers, best first. A label hit always outranks a keyword-only hit at the
// same tier so typing part of the visible label never gets buried under an alias
// match on another command.
const TIER = {
  labelPrefix: 0,
  labelWord: 1,
  labelSubstring: 2,
  keyword: 3,
  labelSubsequence: 4,
} as const

/** True when `query` appears in `text` as an ordered (possibly gapped) subsequence. */
function isSubsequence(query: string, text: string): boolean {
  if (query.length === 0) return true
  let qi = 0
  for (let ti = 0; ti < text.length && qi < query.length; ti += 1) {
    if (text[ti] === query[qi]) qi += 1
  }
  return qi === query.length
}

/** Score one command against a normalised (lowercased, trimmed) query, or null for no match. */
function scoreCommand(command: Command, query: string): number | null {
  const label = command.label.toLowerCase()

  if (label.startsWith(query)) return TIER.labelPrefix
  // Word-boundary hit: query starts a word inside the label.
  if (label.split(/[^a-z0-9]+/).some((word) => word.startsWith(query))) return TIER.labelWord
  if (label.includes(query)) return TIER.labelSubstring
  if (command.keywords?.some((k) => k.toLowerCase().includes(query))) return TIER.keyword
  if (isSubsequence(query, label)) return TIER.labelSubsequence
  return null
}

/**
 * Filter and rank commands for a query.
 *
 * An empty (or whitespace-only) query returns every command in its original
 * index order, so opening the palette shows the full menu. A non-empty query
 * returns only matches, ordered by tier, then by shorter label (a tie-break
 * that favours the more specific command), then alphabetically for stability.
 */
export function filterCommands(commands: readonly Command[], rawQuery: string): Command[] {
  const query = rawQuery.trim().toLowerCase()
  if (query === '') return [...commands]

  const matches: Match[] = []
  for (const command of commands) {
    const score = scoreCommand(command, query)
    if (score !== null) matches.push({ command, score })
  }

  matches.sort(
    (a, b) =>
      a.score - b.score ||
      a.command.label.length - b.command.label.length ||
      a.command.label.localeCompare(b.command.label),
  )

  return matches.map((m) => m.command)
}

/**
 * Unit tests for the v1.18.4 shared UI primitives (Badge, Button, Card).
 *
 * The repo's vitest config runs `environment: 'node'` globally with no
 * react-testing-library dependency and only collects `src/**\/*.test.ts`
 * (not `.test.tsx`), so these primitives are tested through their exported
 * pure class-name helpers rather than by rendering JSX, matching the
 * existing test suite's established pattern (see docs on v1.18.2's axe-core
 * skip: "used source-scan assertions matching the repo's established
 * tokens.test.ts pattern instead").
 */
import { describe, expect, it } from 'vitest'
import { badgeToneClassName, type BadgeTone } from './Badge'
import { buttonClassName, type ButtonSize, type ButtonVariant } from './Button'
import { cardClassName, type CardPadding, type CardVariant } from './Card'

describe('Badge tone recipes', () => {
  const TONES: BadgeTone[] = ['accent', 'info', 'success', 'warning', 'caution', 'danger', 'neutral']

  it.each(TONES)('%s tone resolves to a non-empty class string', (tone) => {
    expect(badgeToneClassName(tone).length).toBeGreaterThan(0)
  })

  it('every tone resolves to a distinct class string', () => {
    const classNames = TONES.map(badgeToneClassName)
    expect(new Set(classNames).size).toBe(TONES.length)
  })

  it.each(TONES.filter((t) => t !== 'neutral'))('%s tone reads its own token triple (soft/line/text)', (tone) => {
    const cls = badgeToneClassName(tone)
    expect(cls).toContain(`border-${tone}-line`)
    expect(cls).toContain(`bg-${tone}-soft`)
    expect(cls).toContain(`text-${tone}-text`)
  })

  it('neutral tone reuses the existing btn-neutral roles, not a new token triple', () => {
    // neutral has no dedicated status hue - it reuses the pre-existing
    // --neutral-bg/--neutral-border/--text-secondary roles .btn-neutral
    // already relies on, so this tone adds zero new tokens.
    const cls = badgeToneClassName('neutral')
    expect(cls).toBe('border-neutral-border bg-neutral-bg text-text-secondary')
  })
})

describe('Button variant/size recipes', () => {
  const VARIANTS: ButtonVariant[] = ['accent', 'neutral']
  const SIZES: ButtonSize[] = ['md', 'sm']

  it.each(VARIANTS)('%s variant is built on the existing tokenized .btn-* recipe', (variant) => {
    const cls = buttonClassName(variant, 'md')
    expect(cls).toContain(`btn-${variant}`)
  })

  it.each(SIZES)('%s size resolves to a non-empty class string for every variant', (size) => {
    for (const variant of VARIANTS) {
      expect(buttonClassName(variant, size).length).toBeGreaterThan(0)
    }
  })

  it('sm size uses the existing .btn-sm modifier (18 pre-existing call sites, v1.18.1 PR2)', () => {
    expect(buttonClassName('accent', 'sm')).toContain('btn-sm')
  })

  it('md size does not add btn-sm', () => {
    expect(buttonClassName('accent', 'md')).not.toContain('btn-sm')
  })

  it('an extra className is preserved and trimmed cleanly', () => {
    expect(buttonClassName('accent', 'md', 'w-full')).toMatch(/w-full$/)
  })
})

describe('Card variant/padding recipes', () => {
  const VARIANTS: CardVariant[] = ['default', 'strong', 'interactive']
  const PADDINGS: CardPadding[] = ['none', 'sm', 'md', 'lg']

  it.each(VARIANTS)('%s variant maps to a real token-built surface class from tokens.css', (variant) => {
    const cls = cardClassName(variant, 'md')
    const expected = variant === 'default' ? 'surface-card' : variant === 'strong' ? 'surface-card-strong' : 'interactive-card'
    expect(cls.split(' ')).toContain(expected)
  })

  it.each(PADDINGS)('%s padding does not throw and returns a string', (padding) => {
    expect(typeof cardClassName('default', padding)).toBe('string')
  })

  it('none padding adds no padding utility', () => {
    expect(cardClassName('default', 'none')).not.toMatch(/\bp-\d/)
  })
})

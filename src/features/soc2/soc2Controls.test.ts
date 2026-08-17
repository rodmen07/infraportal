/**
 * The SOC 2 coverage matrix model (SOC2-MATRIX-1): integrity of the committed
 * cells, the honesty rule for gaps, and the L-001 wiring proving the page
 * renders the model rather than a hand-typed twin.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CONTROL_COUNT, COVERED_CELLS, SOC2_CONTROLS, TOTAL_CELLS } from './soc2Controls'
import { Soc2ControlMatrix } from './Soc2ControlMatrix'

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf-8')

describe('matrix integrity', () => {
  it('has unique control ids and a plausible row count', () => {
    const ids = SOC2_CONTROLS.map((c) => c.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(CONTROL_COUNT).toBeGreaterThanOrEqual(9)
  })

  it('every covered cell cites an evidence file inside the right cloud module', () => {
    for (const control of SOC2_CONTROLS) {
      for (const [cloud, cell] of [['gcp', control.gcp], ['aws', control.aws]] as const) {
        if (!cell.covered) continue
        expect(cell.impl.length, `${control.id} ${cloud} impl is empty`).toBeGreaterThan(0)
        // CC8.1's AWS half genuinely lives in audit.tf, so the path is pinned
        // to the cloud, not to a file naming convention.
        expect(
          cell.evidence.startsWith(`modules/${cloud}/`),
          `${control.id} cites ${cell.evidence}, which is not a modules/${cloud}/ path`,
        ).toBe(true)
      }
    }
  })

  it('records exactly the two verified gaps, never implying symmetry', () => {
    // CC9.2 has no AWS twin (only modules/gcp/cc9_2_vendor_risk.tf exists),
    // and A1.2's GCP cell is a README claim with no backing resource — both
    // verified against the terraform-soc2-baseline tree on 2026-08-16.
    const gapCells = SOC2_CONTROLS.flatMap((c) =>
      ([['gcp', c.gcp], ['aws', c.aws]] as const)
        .filter(([, cellValue]) => !cellValue.covered)
        .map(([cloud]) => `${c.id}/${cloud}`),
    )
    expect(gapCells.sort()).toEqual(['A1.2/gcp', 'CC9.2/aws'])
    expect(COVERED_CELLS).toBe(TOTAL_CELLS - gapCells.length)
  })
})

describe('the page renders the model (L-001)', () => {
  it('Soc2CaseStudyPage renders the matrix and keeps no tuple table of its own', () => {
    const source = read('src/pages/Soc2CaseStudyPage.tsx')
    expect(source).toContain('<Soc2ControlMatrix')
    expect(
      source.includes('const CONTROLS'),
      'the hand-typed CONTROLS tuple array must stay deleted; the model is the source',
    ).toBe(false)
  })

  it('the rendered matrix shows every control id, the gap, and only derived counts', () => {
    const html = renderToStaticMarkup(createElement(Soc2ControlMatrix))
    for (const control of SOC2_CONTROLS) {
      expect(html).toContain(control.id)
    }
    expect(html).toContain('gap')
    expect(html).toContain(`${COVERED_CELLS} of ${TOTAL_CELLS}`)
  })
})

/**
 * The API surface chart model (API-SURFACE-1): rows derive from the committed
 * manifest, sort as a ranking, and the page renders the derived chart.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import manifest from '../../api-specs/manifest.json'
import { API_SURFACE_SERVICE_COUNT, API_SURFACE_TOTAL, apiSurfaceRows } from './apiSurface'
import { ApiSurfaceChart } from './ApiSurfaceChart'

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), 'utf-8')

describe('the derived rows', () => {
  const rows = apiSurfaceRows()

  it('cover every manifest service exactly once, summing to the manifest total', () => {
    expect(rows.map((r) => r.id).sort()).toEqual(manifest.services.map((s) => s.id).sort())
    expect(rows.reduce((sum, r) => sum + r.operationCount, 0)).toBe(API_SURFACE_TOTAL)
    expect(API_SURFACE_SERVICE_COUNT).toBe(manifest.services.length)
  })

  it('rank largest-first with the top bar at full width', () => {
    for (let i = 1; i < rows.length; i += 1) {
      expect(rows[i].operationCount).toBeLessThanOrEqual(rows[i - 1].operationCount)
    }
    expect(rows[0].percentOfMax).toBe(100)
    for (const row of rows) {
      expect(row.percentOfMax).toBeGreaterThan(0)
      expect(row.percentOfMax).toBeLessThanOrEqual(100)
    }
  })
})

describe('the rendered chart (L-001)', () => {
  it('ApiDocsPage renders the chart', () => {
    expect(read('src/pages/ApiDocsPage.tsx')).toContain('<ApiSurfaceChart')
  })

  it('labels every bar with its service name and count, and hides bars from AT', () => {
    const html = renderToStaticMarkup(createElement(ApiSurfaceChart))
    for (const row of apiSurfaceRows()) {
      expect(html).toContain(row.name)
      expect(html).toContain(`>${row.operationCount}</span>`)
    }
    expect(html).toContain('aria-hidden="true"')
    // The totals line is derived, never hand-typed.
    expect(html).toContain(`${API_SURFACE_TOTAL} documented operations`)
  })
})

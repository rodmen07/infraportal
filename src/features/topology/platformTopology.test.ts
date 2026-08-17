/**
 * Static render of the topology diagram (TOPOLOGY-1), in the repo's cheap
 * node-env pattern (renderToStaticMarkup, no jsdom pragma — same as
 * specCatalog.test.ts). Effects never run under static render, so the
 * component renders its 'loading' phase: structure complete, no dots, no
 * numeric claim — which is itself the PROOF-COST-1 property worth pinning.
 */
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { PlatformTopology } from './PlatformTopology'
import { DOMAIN_SERVICE_IDS, TOPOLOGY_NODES } from './topologyModel'

const html = renderToStaticMarkup(createElement(PlatformTopology))

describe('the rendered diagram', () => {
  it('draws every node box and every domain chip', () => {
    for (const node of TOPOLOGY_NODES) {
      expect(html, `missing node label: ${node.label}`).toContain(node.label)
    }
    for (const id of DOMAIN_SERVICE_IDS) {
      expect(html, `missing domain chip: ${id}`).toContain(`>${id}</text>`)
    }
  })

  it('is announced as a labeled image with a description', () => {
    expect(html).toContain('role="img"')
    expect(html).toContain('aria-labelledby="ptopo-title ptopo-desc"')
    expect(html).toContain('InfraPortal platform architecture')
  })

  it('states no measured number and no health verdict before the aggregate is read', () => {
    expect(html).toContain('Checking live service health')
    expect(html, 'no dot legend may render without a measurement').not.toContain('Operational')
    expect(html, 'no health ratio may render without a measurement').not.toMatch(/\d+\/\d+ upstreams/)
  })

  it('always offers the status board where the overlay can be checked', () => {
    expect(html).toContain('href="#/status"')
  })

  it('scrolls horizontally instead of squeezing the drawing below the 12px type floor', () => {
    expect(html).toContain('overflow-x-auto')
    // min-width must be >= the viewBox width: below it the SVG scales down and
    // its 12px labels render under the repo's type floor (D5/F10) through a
    // channel typeScaleFloor.test.ts cannot see (fontSize attrs, not classes).
    expect(html).toContain('min-w-[920px]')
  })
})

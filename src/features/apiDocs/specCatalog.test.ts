/**
 * Walk-every-operation test over the 11 committed OpenAPI snapshots
 * (src/api-specs/). If a resync ever introduces a construct the custom
 * renderer does not support, or the manifest drifts from the specs it
 * summarizes, this suite fails loudly instead of letting the page render
 * wrong.
 */

import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  SERVICE_IDS,
  SPEC_MANIFEST,
  SPEC_SERVICES,
  TOTAL_OPERATIONS,
  loadSpec,
} from '../../api-specs'
import { COVERED_SERVICE_IDS, getTryItSupport } from '../../lib/tryItAdapter.mock'
import type { OpenApiSpec } from './openapiTypes'
import {
  countOperations,
  extractOperations,
  groupOperationsByTag,
  resolveRef,
} from './specModel'
import { ServiceSpecView } from './SpecView'

/** Mirrors react-dom's text escaping so raw strings can be asserted in HTML. */
function escapeForHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

async function loadAll(): Promise<Map<string, OpenApiSpec>> {
  const specs = new Map<string, OpenApiSpec>()
  for (const id of SERVICE_IDS) {
    specs.set(id, await loadSpec(id))
  }
  return specs
}

function collectRefs(value: unknown, found: Set<string>): void {
  if (Array.isArray(value)) {
    for (const item of value) collectRefs(item, found)
    return
  }
  if (typeof value === 'object' && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      if (key === '$ref' && typeof child === 'string') {
        found.add(child)
      } else {
        collectRefs(child, found)
      }
    }
  }
}

describe('committed spec catalog', () => {
  it('manifest lists all 11 services with the ids the loader knows', () => {
    expect(SPEC_SERVICES).toHaveLength(11)
    expect(SPEC_SERVICES.map((service) => service.id)).toEqual([...SERVICE_IDS].sort())
  })

  it('loads every snapshot as an OpenAPI 3.0.3 document matching its manifest entry', async () => {
    const specs = await loadAll()
    for (const service of SPEC_SERVICES) {
      const spec = specs.get(service.id)!
      expect(spec.openapi, service.id).toBe(SPEC_MANIFEST.openapiVersion)
      expect(spec.info.title, service.id).toBe(service.title)
      expect(spec.info.version, service.id).toBe(service.version)
      expect(countOperations(spec), service.id).toBe(service.operationCount)
      expect((spec.tags ?? []).map((tag) => tag.name), service.id).toEqual(service.tags)
      expect(service.summary.length, service.id).toBeGreaterThan(0)
    }
    const total = [...specs.values()].reduce((sum, spec) => sum + countOperations(spec), 0)
    expect(TOTAL_OPERATIONS).toBe(total)
  })

  it('resolves every $ref in every snapshot locally', async () => {
    const specs = await loadAll()
    for (const [id, spec] of specs) {
      const refs = new Set<string>()
      collectRefs(spec, refs)
      expect(refs.size, id).toBeGreaterThan(0)
      for (const ref of refs) {
        expect(() => resolveRef(spec, ref), `${id}: ${ref}`).not.toThrow()
      }
    }
  })

  it('extracts and groups every operation without hitting a fallback path', async () => {
    const specs = await loadAll()
    for (const [id, spec] of specs) {
      const operations = extractOperations(spec)
      expect(operations.length, id).toBeGreaterThan(0)

      const operationIds = operations.map((operation) => operation.operationId)
      expect(new Set(operationIds).size, `${id}: duplicate operationIds`).toBe(operationIds.length)

      for (const operation of operations) {
        expect(operation.summary, `${id}: ${operation.operationId}`).toBeTruthy()
        expect(operation.responses.length, `${id}: ${operation.operationId}`).toBeGreaterThan(0)
        expect(operation.auth.label, `${id}: ${operation.operationId}`).toBeTruthy()
      }

      const groups = groupOperationsByTag(spec, operations)
      const grouped = groups.flatMap((group) => group.operations)
      expect(grouped.length, `${id}: grouping dropped operations`).toBe(operations.length)
    }
  })

  it('documents health and ready probes as public and /api routes as bearer-auth', async () => {
    const specs = await loadAll()
    for (const [id, spec] of specs) {
      for (const operation of extractOperations(spec)) {
        const context = `${id}: ${operation.method.toUpperCase()} ${operation.path}`
        if (operation.path === '/health' || operation.path === '/ready') {
          expect(operation.auth.required, context).toBe(false)
        } else {
          expect(operation.auth.required, context).toBe(true)
          expect(operation.auth.label, context).toBe('Bearer JWT')
        }
      }
    }
  })

  it('renders every service view with every operation present (render smoke)', async () => {
    const specs = await loadAll()
    for (const [id, spec] of specs) {
      const operations = extractOperations(spec)
      const groups = groupOperationsByTag(spec, operations)
      const html = renderToStaticMarkup(createElement(ServiceSpecView, { spec, groups }))
      expect(html, id).toContain(spec.info.title)
      for (const operation of operations) {
        expect(html, `${id}: ${operation.operationId} missing from render`).toContain(
          operation.operationId,
        )
      }
    }
  })

  it('renders a Try it panel state for every operation when a serviceId is provided (v1.17.2)', async () => {
    const specs = await loadAll()
    for (const [id, spec] of specs) {
      const operations = extractOperations(spec)
      const groups = groupOperationsByTag(spec, operations)
      const html = renderToStaticMarkup(
        createElement(ServiceSpecView, { spec, groups, serviceId: id }),
      )
      for (const operation of operations) {
        const context = `${id}: ${operation.operationId}`
        expect(html, `${context} missing its Try it panel`).toContain(
          `data-tryit="${operation.operationId}"`,
        )
        const support = getTryItSupport(id, operation)
        if (!support.executable) {
          expect(html, `${context} must render its honest disabled reason`).toContain(
            escapeForHtml(support.reason),
          )
        }
      }
      // Executable services surface the demo-boundary framing; the count of
      // panels always matches the count of operations.
      expect(html.match(/data-tryit="/g)?.length, id).toBe(operations.length)
      if (COVERED_SERVICE_IDS.includes(id)) {
        expect(html, `${id} must label the demo execution`).toContain('in-browser demo')
        expect(html, `${id} must state the admin-caller simulation`).toContain(
          'authenticated admin caller',
        )
      }
    }
  })

  it('renders snippets and a copy-link affordance for every operation (v1.17.3)', async () => {
    const specs = await loadAll()
    for (const [id, spec] of specs) {
      const operations = extractOperations(spec)
      const groups = groupOperationsByTag(spec, operations)
      const html = renderToStaticMarkup(
        createElement(ServiceSpecView, { spec, groups, serviceId: id }),
      )
      for (const operation of operations) {
        const context = `${id}: ${operation.operationId}`
        expect(html, `${context} missing its deep-link anchor`).toContain(
          `data-op-card="${operation.operationId}"`,
        )
        expect(html, `${context} missing its snippets section`).toContain(
          `data-snippets="${operation.operationId}"`,
        )
        expect(html, `${context} missing its copy-link affordance`).toContain(
          `data-copy-link="${operation.operationId}"`,
        )
      }
      // The snippets are generated into the markup: every service view names
      // the SDK package and the base-URL honesty note at least once. The note
      // deliberately no longer asserts a runtime status (SPEC-COPY-2, 2026-07-25);
      // it says where the base URL comes from and points at the status board.
      expect(html, id).toContain('@rodmen07/infraportal-sdk')
      expect(html, id).toContain('this page never runs them')
    }
  })
})

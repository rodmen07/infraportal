/**
 * Demo adapter tests for the v1.17.2 Try it request builder: the
 * operationId-to-store mapping, the documented validation/404/422/500 paths,
 * simulated headers, and the disabled-state logic. Operations are the real
 * OperationViews extracted from the committed spec snapshots, and every test
 * runs against isolated store instances.
 */

import { beforeAll, describe, expect, it } from 'vitest'
import { SERVICE_IDS, loadSpec } from '../api-specs'
import { extractOperations, type OperationView } from '../features/apiDocs/specModel'
import type { OpenApiSpec } from '../features/apiDocs/openapiTypes'
import { createCrmStore } from './crmStore.mock'
import { createProjectsStore } from './projectsStore.mock'
import {
  COVERED_SERVICE_IDS,
  DEMO_CALLER_ID,
  EXECUTABLE_OPERATION_COUNT,
  createTryItAdapter,
  getTryItSupport,
  type SimulatedResponse,
  type TryItAdapter,
  type TryItInput,
} from './tryItAdapter.mock'

const FIXED_ISO = '2026-07-19T12:00:00Z'
const FIXED_MS = Date.parse(FIXED_ISO)

const specs = new Map<string, OpenApiSpec>()
const opIndex = new Map<string, OperationView>()

beforeAll(async () => {
  for (const id of SERVICE_IDS) {
    const spec = await loadSpec(id)
    specs.set(id, spec)
    for (const operation of extractOperations(spec)) {
      opIndex.set(`${id}.${operation.operationId}`, operation)
    }
  }
})

function op(serviceId: string, operationId: string): OperationView {
  const found = opIndex.get(`${serviceId}.${operationId}`)
  if (!found) throw new Error(`missing operation ${serviceId}.${operationId}`)
  return found
}

function freshAdapter(): TryItAdapter {
  return createTryItAdapter({
    crm: createCrmStore({ now: () => FIXED_ISO }),
    projects: createProjectsStore({ now: () => FIXED_ISO }),
    now: () => FIXED_MS,
  })
}

function run(
  adapter: TryItAdapter,
  serviceId: string,
  operationId: string,
  input: TryItInput = {},
): SimulatedResponse {
  return adapter.execute(serviceId, op(serviceId, operationId), input)
}

function jsonBody(response: SimulatedResponse): unknown {
  expect(response.body.kind).toBe('json')
  return response.body.kind === 'json' ? response.body.value : undefined
}

function textBody(response: SimulatedResponse): string {
  expect(response.body.kind).toBe('text')
  return response.body.kind === 'text' ? response.body.value : ''
}

function header(response: SimulatedResponse, name: string): string | undefined {
  return response.headers.find((h) => h.name === name)?.value
}

// ---------------------------------------------------------------------------
// Support / disabled-state logic
// ---------------------------------------------------------------------------

describe('try-it support map', () => {
  it('covers exactly the four services with demo datasets', () => {
    expect([...COVERED_SERVICE_IDS].sort()).toEqual([
      'accounts',
      'contacts',
      'opportunities',
      'projects',
    ])
  })

  it('disables every operation of services without a demo dataset, honestly worded', () => {
    for (const operation of extractOperations(specs.get('search')!)) {
      const support = getTryItSupport('search', operation)
      expect(support.executable, operation.operationId).toBe(false)
      if (!support.executable) {
        expect(support.reason).toContain('no in-browser demo dataset')
        expect(support.reason).toContain('disabled')
      }
    }
  })

  it('disables health and readiness probes on covered services (no fake liveness)', () => {
    for (const operationId of ['healthCheck', 'readinessCheck']) {
      const support = getTryItSupport('accounts', op('accounts', operationId))
      expect(support.executable).toBe(false)
      if (!support.executable) expect(support.reason).toContain('fake liveness')
    }
  })

  it('disables projects operations whose entities have no demo dataset', () => {
    for (const operationId of [
      'listMessages',
      'createMessage',
      'listLinks',
      'createLink',
      'deleteLink',
      'listEmails',
      'syncEmails',
    ]) {
      const support = getTryItSupport('projects', op('projects', operationId))
      expect(support.executable, operationId).toBe(false)
      if (!support.executable) {
        expect(support.reason).toContain('projects, milestones, and deliverables')
      }
    }
  })

  it('reports executable support for exactly EXECUTABLE_OPERATION_COUNT operations across all specs', () => {
    let executable = 0
    for (const [id, spec] of specs) {
      for (const operation of extractOperations(spec)) {
        if (getTryItSupport(id, operation).executable) executable += 1
      }
    }
    expect(executable).toBe(EXECUTABLE_OPERATION_COUNT)
    expect(EXECUTABLE_OPERATION_COUNT).toBe(28)
  })

  it('execute refuses operations the support map disables', () => {
    const adapter = freshAdapter()
    expect(() => run(adapter, 'accounts', 'healthCheck')).toThrow(/not executable/)
  })
})

// ---------------------------------------------------------------------------
// accounts: list/get/create/update/delete against the demo store
// ---------------------------------------------------------------------------

describe('accounts operations', () => {
  it('listAccounts returns the paginated envelope ordered created_at desc with simulated read-tier headers', () => {
    const adapter = freshAdapter()
    const response = run(adapter, 'accounts', 'listAccounts')
    expect(response.status).toBe(200)
    const body = jsonBody(response) as { data: { id: string; owner_id: string }[]; total: number; limit: number; offset: number }
    expect(body.total).toBe(8)
    expect(body.limit).toBe(50)
    expect(body.offset).toBe(0)
    // Seed created_at ascends acc-001..acc-008, so the listing reverses it.
    expect(body.data[0].id).toBe('acc-008')
    expect(body.data[7].id).toBe('acc-001')
    expect(body.data[0].owner_id).toBe(DEMO_CALLER_ID)

    expect(header(response, 'X-RateLimit-Limit')).toBe('60')
    expect(header(response, 'X-RateLimit-Remaining')).toBe('59')
    expect(header(response, 'X-RateLimit-Reset')).toBe(String(Math.floor(FIXED_MS / 1000) + 1))
    expect(response.notes.some((n) => n.includes('simulated from the documented gateway tiers'))).toBe(true)
  })

  it('listAccounts filters by status and q, clamps limit, and honors offset', () => {
    const adapter = freshAdapter()
    const filtered = jsonBody(
      run(adapter, 'accounts', 'listAccounts', { query: { status: 'active', q: 'e' } }),
    ) as { data: { name: string; status: string }[]; total: number }
    expect(filtered.total).toBeGreaterThan(0)
    expect(filtered.data.every((r) => r.status === 'active')).toBe(true)
    expect(filtered.data.every((r) => r.name.toLowerCase().includes('e'))).toBe(true)

    const clamped = jsonBody(
      run(adapter, 'accounts', 'listAccounts', { query: { limit: '500', offset: '6' } }),
    ) as { data: unknown[]; limit: number; offset: number }
    expect(clamped.limit).toBe(100)
    expect(clamped.offset).toBe(6)
    expect(clamped.data).toHaveLength(2)
  })

  it('listAccounts rejects a non-integer limit with the documented 400 text/plain rejection', () => {
    const response = run(freshAdapter(), 'accounts', 'listAccounts', { query: { limit: 'abc' } })
    expect(response.status).toBe(400)
    expect(textBody(response)).toBe(
      'Failed to deserialize query string: limit: invalid digit found in string',
    )
    expect(header(response, 'Content-Type')).toContain('text/plain')
    // The spec documents no rate-limit headers on this axum-generated 400.
    expect(header(response, 'X-RateLimit-Limit')).toBeUndefined()
  })

  it('listAccounts owner_id filter matches only the demo admin and says so', () => {
    const adapter = freshAdapter()
    const foreign = jsonBody(
      run(adapter, 'accounts', 'listAccounts', { query: { owner_id: 'someone-else' } }),
    ) as { total: number }
    expect(foreign.total).toBe(0)
    const own = run(adapter, 'accounts', 'listAccounts', { query: { owner_id: DEMO_CALLER_ID } })
    expect((jsonBody(own) as { total: number }).total).toBe(8)
    expect(own.notes.some((n) => n.includes('owner_id'))).toBe(true)
  })

  it('createAccount inserts into the demo store and returns the 201 DTO with write-tier headers', () => {
    const adapter = freshAdapter()
    const response = run(adapter, 'accounts', 'createAccount', {
      bodyText: JSON.stringify({ name: 'Vandelay Industries', domain: '  ' }),
    })
    expect(response.status).toBe(201)
    const body = jsonBody(response) as Record<string, unknown>
    expect(body).toMatchObject({
      owner_id: DEMO_CALLER_ID,
      name: 'Vandelay Industries',
      domain: null, // blank domain stored as null, per the spec
      status: 'active', // default when omitted
      created_at: FIXED_ISO,
    })
    expect(header(response, 'X-RateLimit-Limit')).toBe('30')

    const listed = jsonBody(run(adapter, 'accounts', 'listAccounts')) as { total: number }
    expect(listed.total).toBe(9)
  })

  it('createAccount rejects an empty name with the documented 400 VALIDATION_ERROR envelope', () => {
    const response = run(freshAdapter(), 'accounts', 'createAccount', {
      bodyText: JSON.stringify({ name: '   ' }),
    })
    expect(response.status).toBe(400)
    expect(jsonBody(response)).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'name must not be empty',
      details: { field: 'name', constraint: 'must not be empty' },
    })
  })

  it('createAccount rejects an unknown status with valid_values and a too-long name', () => {
    const adapter = freshAdapter()
    const badStatus = run(adapter, 'accounts', 'createAccount', {
      bodyText: JSON.stringify({ name: 'Ok', status: 'archived' }),
    })
    expect(badStatus.status).toBe(400)
    expect(jsonBody(badStatus)).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'invalid status value',
      details: { valid_values: ['active', 'inactive', 'churned'] },
    })

    const longName = run(adapter, 'accounts', 'createAccount', {
      bodyText: JSON.stringify({ name: 'x'.repeat(256) }),
    })
    expect(longName.status).toBe(400)
    expect(jsonBody(longName)).toMatchObject({ message: 'name exceeds maximum length' })
  })

  it('createAccount simulates the axum extractor: malformed JSON -> 400 text, missing field -> 422 text', () => {
    const adapter = freshAdapter()
    const malformed = run(adapter, 'accounts', 'createAccount', { bodyText: '{not json' })
    expect(malformed.status).toBe(400)
    expect(textBody(malformed)).toContain('Failed to parse the request body as JSON')

    const missing = run(adapter, 'accounts', 'createAccount', { bodyText: '{}' })
    expect(missing.status).toBe(422)
    expect(textBody(missing)).toBe(
      'Failed to deserialize the JSON body into the target type: missing field `name`',
    )

    const wrongType = run(adapter, 'accounts', 'createAccount', {
      bodyText: JSON.stringify({ name: 42 }),
    })
    expect(wrongType.status).toBe(422)
    expect(textBody(wrongType)).toContain('invalid type: number, expected a string')
  })

  it('getAccount returns the DTO for a seed id and the documented 404 for an unknown id', () => {
    const adapter = freshAdapter()
    const found = run(adapter, 'accounts', 'getAccount', { pathParams: { id: 'acc-001' } })
    expect(found.status).toBe(200)
    expect(jsonBody(found)).toMatchObject({ id: 'acc-001', name: 'Acme Corp' })

    const missing = run(adapter, 'accounts', 'getAccount', { pathParams: { id: 'acc-nope' } })
    expect(missing.status).toBe(404)
    expect(jsonBody(missing)).toEqual({ code: 'NOT_FOUND', message: 'account not found' })
  })

  it('updateAccount patches fields, clears a blank domain to null, and bumps updated_at', () => {
    const adapter = freshAdapter()
    const response = run(adapter, 'accounts', 'updateAccount', {
      pathParams: { id: 'acc-001' },
      bodyText: JSON.stringify({ status: 'inactive', domain: '   ' }),
    })
    expect(response.status).toBe(200)
    expect(jsonBody(response)).toMatchObject({
      id: 'acc-001',
      name: 'Acme Corp', // omitted field kept
      status: 'inactive',
      domain: null,
      updated_at: FIXED_ISO,
    })
  })

  it('updateAccount rejects an empty name with the update-variant message and 404s unknown ids', () => {
    const adapter = freshAdapter()
    const empty = run(adapter, 'accounts', 'updateAccount', {
      pathParams: { id: 'acc-001' },
      bodyText: JSON.stringify({ name: ' ' }),
    })
    expect(empty.status).toBe(400)
    expect(jsonBody(empty)).toEqual({
      code: 'VALIDATION_ERROR',
      message: 'name cannot be empty',
      details: { field: 'name', constraint: 'cannot be empty' },
    })

    const missing = run(adapter, 'accounts', 'updateAccount', {
      pathParams: { id: 'acc-nope' },
      bodyText: '{}',
    })
    expect(missing.status).toBe(404)
  })

  it('deleteAccount returns 204 with no body, then 404 on repeat', () => {
    const adapter = freshAdapter()
    const first = run(adapter, 'accounts', 'deleteAccount', { pathParams: { id: 'acc-008' } })
    expect(first.status).toBe(204)
    expect(first.body.kind).toBe('empty')
    expect(header(first, 'Content-Type')).toBeUndefined()
    expect(header(first, 'X-RateLimit-Limit')).toBe('30')

    const repeat = run(adapter, 'accounts', 'deleteAccount', { pathParams: { id: 'acc-008' } })
    expect(repeat.status).toBe(404)
    expect((jsonBody(run(adapter, 'accounts', 'listAccounts')) as { total: number }).total).toBe(7)
  })
})

// ---------------------------------------------------------------------------
// contacts: cross-entity INVALID_ACCOUNT verification and clear-to-null
// ---------------------------------------------------------------------------

describe('contacts operations', () => {
  it('listContacts orders by last_name then first_name in the paginated envelope', () => {
    const body = jsonBody(run(freshAdapter(), 'contacts', 'listContacts')) as {
      data: { last_name: string }[]
      total: number
    }
    expect(body.total).toBe(8)
    const lastNames = body.data.map((r) => r.last_name)
    expect(lastNames).toEqual([...lastNames].sort((a, b) => a.localeCompare(b, 'en')))
  })

  it('createContact verifies account_id against the demo accounts dataset (422 INVALID_ACCOUNT)', () => {
    const adapter = freshAdapter()
    const unknown = run(adapter, 'contacts', 'createContact', {
      bodyText: JSON.stringify({ first_name: 'Jo', last_name: 'Doe', account_id: 'acc-nope' }),
    })
    expect(unknown.status).toBe(422)
    expect(jsonBody(unknown)).toEqual({ code: 'INVALID_ACCOUNT', message: 'account not found' })
    expect(unknown.notes.some((n) => n.includes('demo accounts dataset'))).toBe(true)

    const known = run(adapter, 'contacts', 'createContact', {
      bodyText: JSON.stringify({ first_name: 'Jo', last_name: 'Doe', account_id: 'acc-001' }),
    })
    expect(known.status).toBe(201)
    expect(jsonBody(known)).toMatchObject({
      account_id: 'acc-001',
      lifecycle_stage: 'lead', // default when omitted
      email: null,
      owner_id: DEMO_CALLER_ID,
    })
  })

  it('createContact validates names and lifecycle_stage with the documented 400 envelopes', () => {
    const adapter = freshAdapter()
    const empty = run(adapter, 'contacts', 'createContact', {
      bodyText: JSON.stringify({ first_name: '', last_name: 'Doe' }),
    })
    expect(empty.status).toBe(400)
    expect(jsonBody(empty)).toMatchObject({ message: 'first_name must not be empty' })

    const badStage = run(adapter, 'contacts', 'createContact', {
      bodyText: JSON.stringify({ first_name: 'Jo', last_name: 'Doe', lifecycle_stage: 'vip' }),
    })
    expect(badStage.status).toBe(400)
    expect(jsonBody(badStage)).toMatchObject({
      message: 'invalid lifecycle_stage value',
      details: { valid_values: ['lead', 'prospect', 'customer', 'churned', 'evangelist'] },
    })
  })

  it('updateContact 404s before validating the body, per the spec ordering', () => {
    const response = run(freshAdapter(), 'contacts', 'updateContact', {
      pathParams: { id: 'con-nope' },
      bodyText: JSON.stringify({ first_name: '' }), // also invalid; 404 must win
    })
    expect(response.status).toBe(404)
    expect(jsonBody(response)).toEqual({ code: 'NOT_FOUND', message: 'contact not found' })
  })

  it('updateContact clears email to null via a blank string and keeps other fields', () => {
    const adapter = freshAdapter()
    const response = run(adapter, 'contacts', 'updateContact', {
      pathParams: { id: 'con-001' },
      bodyText: JSON.stringify({ email: '  ' }),
    })
    expect(response.status).toBe(200)
    expect(jsonBody(response)).toMatchObject({ id: 'con-001', email: null, first_name: 'Ada' })
  })

  it('deleteContact happy path and 404', () => {
    const adapter = freshAdapter()
    expect(run(adapter, 'contacts', 'deleteContact', { pathParams: { id: 'con-001' } }).status).toBe(204)
    expect(run(adapter, 'contacts', 'deleteContact', { pathParams: { id: 'con-001' } }).status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// opportunities: bare-array list and the 422 validation envelope
// ---------------------------------------------------------------------------

describe('opportunities operations', () => {
  it('listOpportunities returns a bare array ordered created_at desc (no pagination envelope)', () => {
    const body = jsonBody(run(freshAdapter(), 'opportunities', 'listOpportunities')) as {
      id: string
      close_date: string | null
    }[]
    expect(Array.isArray(body)).toBe(true)
    expect(body).toHaveLength(8)
    expect(body[0].id).toBe('opp-008') // newest seed first
    expect(body.find((r) => r.id === 'opp-004')!.close_date).toBeNull()
  })

  it('createOpportunity uses 422 (not 400) for handler validation, name before account_id', () => {
    const adapter = freshAdapter()
    const bothEmpty = run(adapter, 'opportunities', 'createOpportunity', {
      bodyText: JSON.stringify({ name: ' ', account_id: '' }),
    })
    expect(bothEmpty.status).toBe(422)
    expect(jsonBody(bothEmpty)).toMatchObject({
      code: 'VALIDATION_ERROR',
      message: 'name must not be empty',
    })

    const longAccount = run(adapter, 'opportunities', 'createOpportunity', {
      bodyText: JSON.stringify({ name: 'Deal', account_id: 'x'.repeat(256) }),
    })
    expect(jsonBody(longAccount)).toMatchObject({
      message: 'account_id exceeds maximum length of 255 characters',
    })
  })

  it('createOpportunity applies the documented defaults (stage, amount)', () => {
    const response = run(freshAdapter(), 'opportunities', 'createOpportunity', {
      bodyText: JSON.stringify({ name: 'New deal', account_id: 'acc-002' }),
    })
    expect(response.status).toBe(201)
    expect(jsonBody(response)).toMatchObject({
      stage: 'qualification',
      amount: 0,
      close_date: null,
      owner_id: DEMO_CALLER_ID,
    })
  })

  it('updateOpportunity 404s unknown ids before validation and validates stage on update', () => {
    const adapter = freshAdapter()
    expect(
      run(adapter, 'opportunities', 'updateOpportunity', {
        pathParams: { id: 'opp-nope' },
        bodyText: JSON.stringify({ name: '' }),
      }).status,
    ).toBe(404)

    const emptyStage = run(adapter, 'opportunities', 'updateOpportunity', {
      pathParams: { id: 'opp-001' },
      bodyText: JSON.stringify({ stage: '  ' }),
    })
    expect(emptyStage.status).toBe(422)
    expect(jsonBody(emptyStage)).toMatchObject({ message: 'stage cannot be empty' })

    const updated = run(adapter, 'opportunities', 'updateOpportunity', {
      pathParams: { id: 'opp-001' },
      bodyText: JSON.stringify({ amount: 15000 }),
    })
    expect(updated.status).toBe(200)
    expect(jsonBody(updated)).toMatchObject({ id: 'opp-001', amount: 15000 })
  })

  it('deleteOpportunity happy path and 404', () => {
    const adapter = freshAdapter()
    expect(run(adapter, 'opportunities', 'deleteOpportunity', { pathParams: { id: 'opp-001' } }).status).toBe(204)
    expect(run(adapter, 'opportunities', 'deleteOpportunity', { pathParams: { id: 'opp-001' } }).status).toBe(404)
  })
})

// ---------------------------------------------------------------------------
// projects: nested entities, parent-first 404s, and simulated FK failures
// ---------------------------------------------------------------------------

describe('projects operations', () => {
  it('listProjects returns a bare array (created_at desc) without the demo-only budget field', () => {
    const body = jsonBody(run(freshAdapter(), 'projects', 'listProjects')) as Record<string, unknown>[]
    expect(body.map((p) => p.id)).toEqual(['proj-003', 'proj-002', 'proj-001'])
    expect(Object.keys(body[0])).not.toContain('budget')
  })

  it('createProject validates per spec and returns the created DTO', () => {
    const adapter = freshAdapter()
    const badStatus = run(adapter, 'projects', 'createProject', {
      bodyText: JSON.stringify({ name: 'New build', account_id: 'acct-900', status: 'paused' }),
    })
    expect(badStatus.status).toBe(400)
    expect(jsonBody(badStatus)).toMatchObject({
      message: 'status must be one of: planning, active, on_hold, completed, cancelled',
    })

    const created = run(adapter, 'projects', 'createProject', {
      bodyText: JSON.stringify({ name: 'New build', account_id: 'acct-900' }),
    })
    expect(created.status).toBe(201)
    expect(jsonBody(created)).toMatchObject({
      name: 'New build',
      status: 'active', // documented default
      client_user_id: null,
    })
  })

  it('updateProject treats explicit null as omitted, per the spec', () => {
    const response = run(freshAdapter(), 'projects', 'updateProject', {
      pathParams: { id: 'proj-001' },
      bodyText: JSON.stringify({ description: null, status: 'on_hold' }),
    })
    expect(response.status).toBe(200)
    expect(jsonBody(response)).toMatchObject({
      status: 'on_hold',
      // description: null in the request did NOT clear the stored value.
      description: 'Lift-and-shift of the legacy VM fleet to Cloud Run with IaC and observability.',
    })
  })

  it('deleteProject reproduces the documented FK failure as 500 DB_ERROR while milestones remain', () => {
    const adapter = freshAdapter()
    const blocked = run(adapter, 'projects', 'deleteProject', { pathParams: { id: 'proj-001' } })
    expect(blocked.status).toBe(500)
    expect(jsonBody(blocked)).toEqual({ code: 'DB_ERROR', message: 'database error' })
    expect(blocked.notes.some((n) => n.includes('ON DELETE CASCADE'))).toBe(true)

    // Still present: the simulated FK failure must not delete anything.
    expect(run(adapter, 'projects', 'getProject', { pathParams: { id: 'proj-001' } }).status).toBe(200)
  })

  it('deleteProject succeeds with 204 once the project has no milestones', () => {
    const adapter = freshAdapter()
    const created = jsonBody(
      run(adapter, 'projects', 'createProject', {
        bodyText: JSON.stringify({ name: 'Empty', account_id: 'acct-901' }),
      }),
    ) as { id: string }
    expect(
      run(adapter, 'projects', 'deleteProject', { pathParams: { id: created.id } }).status,
    ).toBe(204)
  })

  it('createMilestone runs the parent check before body validation (404 wins over invalid body)', () => {
    const adapter = freshAdapter()
    const orphan = run(adapter, 'projects', 'createMilestone', {
      pathParams: { project_id: 'proj-nope' },
      bodyText: JSON.stringify({ name: '' }), // also invalid
    })
    expect(orphan.status).toBe(404)
    expect(jsonBody(orphan)).toEqual({ code: 'NOT_FOUND', message: 'project not found' })

    const created = run(adapter, 'projects', 'createMilestone', {
      pathParams: { project_id: 'proj-003' },
      bodyText: JSON.stringify({ name: 'Launch prep' }),
    })
    expect(created.status).toBe(201)
    expect(jsonBody(created)).toMatchObject({
      project_id: 'proj-003',
      status: 'pending', // documented default
      sort_order: 0,
    })
  })

  it('updateMilestone and deleteMilestone follow store state, including the deliverables FK', () => {
    const adapter = freshAdapter()
    const updated = run(adapter, 'projects', 'updateMilestone', {
      pathParams: { id: 'ms-007' },
      bodyText: JSON.stringify({ status: 'in_progress' }),
    })
    expect(updated.status).toBe(200)
    expect(jsonBody(updated)).toMatchObject({ id: 'ms-007', status: 'in_progress' })

    const blocked = run(adapter, 'projects', 'deleteMilestone', { pathParams: { id: 'ms-007' } })
    expect(blocked.status).toBe(500)
    expect(jsonBody(blocked)).toEqual({ code: 'DB_ERROR', message: 'database error' })

    // Delete its deliverables, then the milestone deletes cleanly.
    for (const id of ['dlv-013', 'dlv-014']) {
      expect(
        run(adapter, 'projects', 'deleteDeliverable', { pathParams: { id } }).status,
      ).toBe(204)
    }
    expect(run(adapter, 'projects', 'deleteMilestone', { pathParams: { id: 'ms-007' } }).status).toBe(204)
    expect(run(adapter, 'projects', 'deleteMilestone', { pathParams: { id: 'ms-007' } }).status).toBe(404)
  })

  it('listDeliverables returns seed records that already use the documented enum (v1.16.5 PR2)', () => {
    const adapter = freshAdapter()
    const seeded = run(adapter, 'projects', 'listDeliverables', {
      pathParams: { milestone_id: 'ms-005' },
    })
    expect(seeded.status).toBe(200)
    const rows = jsonBody(seeded) as { status: string }[]
    // The pre-reconciliation seed carried admin-vocabulary statuses (this
    // milestone had a "blocked" deliverable) and the response carried a
    // legacy-vocabulary caveat note. Both are gone: every seed status is in
    // the spec enum, so no caveat is needed.
    const documented = ['not_started', 'in_progress', 'in_review', 'accepted']
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) expect(documented).toContain(row.status)
    expect(rows.some((r) => r.status === 'in_review')).toBe(true)
    expect(seeded.notes.some((n) => n.includes('status vocabulary'))).toBe(false)

    const missing = run(adapter, 'projects', 'listDeliverables', {
      pathParams: { milestone_id: 'ms-nope' },
    })
    expect(missing.status).toBe(404)
    expect(jsonBody(missing)).toEqual({ code: 'NOT_FOUND', message: 'milestone not found' })
  })

  it('createDeliverable defaults to not_started and validates against the API enum', () => {
    const adapter = freshAdapter()
    const created = run(adapter, 'projects', 'createDeliverable', {
      pathParams: { milestone_id: 'ms-008' },
      bodyText: JSON.stringify({ name: 'Design review', estimated_hours: 4 }),
    })
    expect(created.status).toBe(201)
    expect(jsonBody(created)).toMatchObject({
      milestone_id: 'ms-008',
      status: 'not_started',
      estimated_hours: 4,
    })

    const badStatus = run(adapter, 'projects', 'createDeliverable', {
      pathParams: { milestone_id: 'ms-008' },
      bodyText: JSON.stringify({ name: 'X', status: 'blocked' }), // 'blocked' has never been in the API enum
    })
    expect(badStatus.status).toBe(400)
    expect(jsonBody(badStatus)).toMatchObject({
      message: 'status must be one of: not_started, in_progress, in_review, accepted',
    })
  })

  it('updateDeliverable 404s unknown ids before validation', () => {
    const response = run(freshAdapter(), 'projects', 'updateDeliverable', {
      pathParams: { id: 'dlv-nope' },
      bodyText: JSON.stringify({ name: '' }),
    })
    expect(response.status).toBe(404)
    expect(jsonBody(response)).toEqual({ code: 'NOT_FOUND', message: 'deliverable not found' })
  })

  it('createMilestone rejects a non-integer sort_order via the simulated deserializer (422 text)', () => {
    const response = run(freshAdapter(), 'projects', 'createMilestone', {
      pathParams: { project_id: 'proj-001' },
      bodyText: JSON.stringify({ name: 'Fractional', sort_order: 1.5 }),
    })
    expect(response.status).toBe(422)
    expect(textBody(response)).toContain('expected i32')
  })
})

// ---------------------------------------------------------------------------
// id hints for the panel
// ---------------------------------------------------------------------------

describe('demo id hints', () => {
  it('suggests current store ids per path parameter and nothing for disabled operations', () => {
    const adapter = freshAdapter()
    expect(adapter.idHints('accounts', 'getAccount', 'id')).toContain('acc-001')
    expect(adapter.idHints('projects', 'listMilestones', 'project_id')).toEqual([
      'proj-001',
      'proj-002',
      'proj-003',
    ])
    expect(adapter.idHints('projects', 'updateMilestone', 'id')).toContain('ms-001')
    expect(adapter.idHints('projects', 'updateDeliverable', 'id')).toContain('dlv-001')
    expect(adapter.idHints('search', 'searchDocuments', 'id')).toEqual([])
    expect(adapter.idHints('accounts', 'listAccounts', 'id')).toEqual([])
  })
})

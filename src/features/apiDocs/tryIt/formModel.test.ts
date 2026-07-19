/**
 * Form-model derivation tests for the v1.17.2 Try it request builder, run
 * against the real committed spec snapshots so the models tested are the
 * models the panel renders.
 */

import { describe, expect, it } from 'vitest'
import { SERVICE_IDS, loadSpec } from '../../../api-specs'
import type { OpenApiSpec } from '../openapiTypes'
import { extractOperations, type OperationView } from '../specModel'
import {
  buildRequestPreview,
  buildTryItForm,
  collectPathParams,
  collectQueryParams,
  missingPathParams,
  serializeFormBody,
} from './formModel'

const specCache = new Map<string, OpenApiSpec>()

async function operationView(serviceId: string, operationId: string): Promise<OperationView> {
  if (!specCache.has(serviceId)) specCache.set(serviceId, await loadSpec(serviceId))
  const operation = extractOperations(specCache.get(serviceId)!).find(
    (op) => op.operationId === operationId,
  )
  if (!operation) throw new Error(`missing operation ${serviceId}.${operationId}`)
  return operation
}

describe('buildTryItForm', () => {
  it('derives typed query fields with enum values and constraint placeholders (listAccounts)', async () => {
    const model = buildTryItForm(await operationView('accounts', 'listAccounts'))
    expect(model.pathFields).toHaveLength(0)
    expect(model.bodyMode).toBe('none')

    const byName = Object.fromEntries(model.queryFields.map((f) => [f.name, f]))
    expect(Object.keys(byName)).toEqual(['limit', 'offset', 'status', 'q', 'owner_id'])
    expect(byName.limit.kind).toBe('integer')
    expect(byName.limit.required).toBe(false)
    expect(byName.limit.placeholder).toContain('default 50')
    expect(byName.status.kind).toBe('enum')
    expect(byName.status.enumValues).toEqual(['active', 'inactive', 'churned'])
    expect(byName.q.kind).toBe('text')
  })

  it('derives a required path field (getAccount)', async () => {
    const model = buildTryItForm(await operationView('accounts', 'getAccount'))
    expect(model.pathFields).toHaveLength(1)
    expect(model.pathFields[0]).toMatchObject({
      id: 'path.id',
      name: 'id',
      required: true,
      kind: 'text',
    })
  })

  it('derives flat body fields from a scalar request schema (createAccount)', async () => {
    const model = buildTryItForm(await operationView('accounts', 'createAccount'))
    expect(model.bodyMode).toBe('fields')
    expect(model.bodyRequired).toBe(true)
    const byName = Object.fromEntries(model.bodyFields.map((f) => [f.name, f]))
    expect(byName.name).toMatchObject({ required: true, kind: 'text' })
    expect(byName.domain).toMatchObject({ required: false, nullable: true })
    expect(byName.status).toMatchObject({ kind: 'enum' })
    expect(byName.status.enumValues).toEqual(['active', 'inactive', 'churned'])
  })

  it('derives number and integer body fields (createOpportunity, createMilestone)', async () => {
    const opportunity = buildTryItForm(await operationView('opportunities', 'createOpportunity'))
    expect(opportunity.bodyFields.find((f) => f.name === 'amount')?.kind).toBe('number')
    const milestone = buildTryItForm(await operationView('projects', 'createMilestone'))
    expect(milestone.bodyFields.find((f) => f.name === 'sort_order')?.kind).toBe('integer')
    expect(milestone.pathFields.map((f) => f.name)).toEqual(['project_id'])
  })

  it('falls back to a JSON textarea for nested bodies with a parseable template (syncEmails)', async () => {
    const model = buildTryItForm(await operationView('projects', 'syncEmails'))
    expect(model.bodyMode).toBe('json')
    expect(model.bodyFields).toHaveLength(0)
    expect(model.bodyTemplate).toBeDefined()
    const template = JSON.parse(model.bodyTemplate!) as { emails: unknown }
    expect(Array.isArray(template.emails)).toBe(true)
  })

  it('derives a model for every operation of every committed spec without throwing', async () => {
    for (const serviceId of SERVICE_IDS) {
      const spec = specCache.get(serviceId) ?? (await loadSpec(serviceId))
      specCache.set(serviceId, spec)
      for (const operation of extractOperations(spec)) {
        const model = buildTryItForm(operation)
        expect(model.operationId, `${serviceId}: ${operation.operationId}`).toBe(
          operation.operationId,
        )
        if (operation.requestBody) {
          expect(model.bodyMode, `${serviceId}: ${operation.operationId}`).not.toBe('none')
          if (model.bodyMode === 'json') {
            expect(
              () => JSON.parse(model.bodyTemplate ?? ''),
              `${serviceId}: ${operation.operationId} template must be valid JSON`,
            ).not.toThrow()
          }
        }
        for (const field of [...model.pathFields, ...model.queryFields, ...model.bodyFields]) {
          expect(['text', 'integer', 'number', 'enum'], field.id).toContain(field.kind)
        }
      }
    }
  })
})

describe('form value collection and serialization', () => {
  it('collects only non-blank path and query values and reports missing path params', async () => {
    const operation = await operationView('accounts', 'getAccount')
    const model = buildTryItForm(operation)
    expect(missingPathParams(model, {})).toEqual(['id'])
    expect(missingPathParams(model, { 'path.id': '  ' })).toEqual(['id'])
    expect(collectPathParams(model, { 'path.id': ' acc-001 ' })).toEqual({ id: 'acc-001' })

    const list = buildTryItForm(await operationView('accounts', 'listAccounts'))
    expect(
      collectQueryParams(list, { 'query.limit': '10', 'query.q': '', 'query.status': 'active' }),
    ).toEqual({ limit: '10', status: 'active' })
  })

  it('serializes form bodies: required empties kept, optional empties omitted, numbers coerced', async () => {
    const model = buildTryItForm(await operationView('opportunities', 'createOpportunity'))
    const body = JSON.parse(
      serializeFormBody(model, {
        'body.name': 'Big deal',
        'body.account_id': '',
        'body.stage': '',
        'body.amount': '1500',
      })!,
    )
    // account_id is required, so its empty value is sent (reaching the
    // documented validation response); optional empty stage is omitted.
    expect(body).toEqual({ name: 'Big deal', account_id: '', amount: 1500 })
  })

  it('returns undefined body for operations without a requestBody', async () => {
    const model = buildTryItForm(await operationView('accounts', 'listAccounts'))
    expect(serializeFormBody(model, {})).toBeUndefined()
  })

  it('builds a request preview with substituted path and encoded query', async () => {
    const operation = await operationView('accounts', 'getAccount')
    const model = buildTryItForm(operation)
    expect(buildRequestPreview(operation, model, { 'path.id': 'acc-001' })).toBe(
      'GET /api/v1/accounts/acc-001',
    )

    const listOperation = await operationView('accounts', 'listAccounts')
    const listModel = buildTryItForm(listOperation)
    expect(
      buildRequestPreview(listOperation, listModel, { 'query.q': 'globex corp', 'query.limit': '5' }),
    ).toBe('GET /api/v1/accounts?limit=5&q=globex%20corp')
  })
})

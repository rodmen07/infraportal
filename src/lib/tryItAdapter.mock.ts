// ===========================================================================
// MOCK EXECUTION BOUNDARY - NOT A LIVE BACKEND
//
// This module is the demo adapter behind the API playground's "Try it" panel
// (v1.17.2). It maps OpenAPI operationIds from the committed spec snapshots
// onto the in-memory demo datasets:
//
//   - accounts, contacts, opportunities  ->  crmStore.mock.ts
//   - projects, milestones, deliverables ->  projectsStore.mock.ts
//
// Everything is simulated in the browser tab: no network requests are made
// anywhere. This is a deliberate property of the playground, not a statement
// about what is deployed - the site ships as a static bundle with no service
// URL configured, and live per-service health lives on the #/status board.
//
// Honesty rules (same discipline as the other *.mock.ts boundaries):
//   - Only operations whose entities exist in a demo dataset are executable.
//     Everything else reports a disabled state with the reason; a success is
//     never invented.
//   - The 400/404/422/500 paths are real: bad bodies fail the documented
//     validation, unknown ids miss the store, and the projects-service
//     foreign-key delete failures documented in the spec are reproduced from
//     actual store state.
//   - Auth is NOT simulated. The caller is treated as an authenticated admin
//     (JWT sub "demo-admin"), which the panel states outright, so the
//     documented 401/403 responses are not reachable here.
//   - X-RateLimit-* headers are attached only where the spec documents them
//     for the returned status, with values from the documented gateway tiers,
//     and every response carries notes marking what is simulated.
//
// Who talks to it: TryItPanel.tsx (the per-operation panel inside the API
// docs explorer) and ApiDocsPage.tsx (executable-operation count).
//
// To go live later: implement the same execute() contract over fetch against
// the real services and swap the instance used by TryItPanel; the form model
// (formModel.ts) and panel need no changes.
// ===========================================================================

import type { OperationView } from '../features/apiDocs/specModel'
import {
  crmStore,
  type CrmAccount,
  type CrmContact,
  type CrmOpportunity,
  type CrmStore,
} from './crmStore.mock'
import { projectsStore, type ProjectsStore } from './projectsStore.mock'
import type {
  DeliverableStatus,
  DemoDeliverable,
  DemoMilestone,
  DemoProject,
  MilestoneStatus,
  ProjectStatus,
} from './projectClone'
import {
  DELIVERABLE_STATUSES,
  MILESTONE_STATUSES,
  PROJECT_STATUSES,
} from './projectStatusVocabulary'

/**
 * Marker note re-exported so call sites can surface (in code review or UI)
 * that execution is simulated against the in-memory demo datasets.
 */
export const TRY_IT_BOUNDARY =
  'tryItAdapter.mock: "Try it" requests are simulated entirely in the browser against the in-memory demo datasets. No network requests are made, and the caller is treated as an admin.' as const

/** JWT sub of the simulated admin caller; owner of every demo CRM record. */
export const DEMO_CALLER_ID = 'demo-admin'

// ---------------------------------------------------------------------------
// Public result types
// ---------------------------------------------------------------------------

export type SimulatedBody =
  | { kind: 'json'; value: unknown }
  | { kind: 'text'; value: string }
  | { kind: 'empty' }

export interface SimulatedHeader {
  name: string
  value: string
}

export interface SimulatedResponse {
  status: number
  statusText: string
  /** Simulated headers, only where the spec documents them for this status. */
  headers: SimulatedHeader[]
  body: SimulatedBody
  /** Honesty notes: what was simulated and how. */
  notes: string[]
}

export interface TryItInput {
  pathParams?: Record<string, string>
  query?: Record<string, string>
  /** Raw request body text; parsed here so malformed JSON 400s stay real. */
  bodyText?: string
}

export type TryItSupport =
  | { executable: true }
  | { executable: false; reason: string }

const STATUS_TEXT: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  400: 'Bad Request',
  404: 'Not Found',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
}

// ---------------------------------------------------------------------------
// Executor plumbing
// ---------------------------------------------------------------------------

interface ExecutorContext {
  crm: CrmStore
  projects: ProjectsStore
}

interface ExecResult {
  status: number
  json?: unknown
  text?: string
  notes?: string[]
}

interface NormalizedInput {
  path: Record<string, string>
  query: Record<string, string>
  bodyText?: string
}

type Executor = (input: NormalizedInput, ctx: ExecutorContext) => ExecResult

interface ExecutableOp {
  run: Executor
  /** Demo-id suggestions per path parameter, for the panel's hint chips. */
  idHints?: Record<string, (ctx: ExecutorContext) => string[]>
}

const jsonResult = (status: number, value: unknown, notes?: string[]): ExecResult => ({
  status,
  json: value,
  notes,
})

const textResult = (status: number, value: string, notes?: string[]): ExecResult => ({
  status,
  text: value,
  notes,
})

const notFound = (entity: string): ExecResult =>
  jsonResult(404, { code: 'NOT_FOUND', message: `${entity} not found` })

const validationError = (
  status: number,
  message: string,
  details: Record<string, unknown>,
): ExecResult => jsonResult(status, { code: 'VALIDATION_ERROR', message, details })

/** Spec timestamps are second-precision UTC; the store clock may carry ms. */
const specTime = (iso: string): string => iso.replace(/\.\d+Z$/, 'Z')

const blankToNull = (value: string | undefined): string | null =>
  value === undefined || value.trim() === '' ? null : value

// --- simulated axum extractors --------------------------------------------

type BodyFieldType = 'string' | 'number' | 'integer'

interface BodyFieldSpec {
  type: BodyFieldType
  required?: boolean
  nullable?: boolean
}

type ParsedBody = Record<string, unknown>

const EXPECTED_TYPE: Record<BodyFieldType, string> = {
  string: 'a string',
  number: 'f64',
  integer: 'i32',
}

function jsonTypeName(value: unknown): string {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'sequence'
  return typeof value
}

/**
 * Simulates the axum Json extractor pipeline documented in every spec:
 * malformed JSON -> 400 text/plain; parsed JSON that does not deserialize
 * into the request type (missing required field, wrong field type) ->
 * 422 text/plain. Field order follows the declaration order given here.
 */
function readBody(
  bodyText: string | undefined,
  fields: Record<string, BodyFieldSpec>,
): { ok: true; value: ParsedBody } | { ok: false; result: ExecResult } {
  if (bodyText === undefined || bodyText.trim() === '') {
    return {
      ok: false,
      result: textResult(
        400,
        'Failed to parse the request body as JSON: EOF while parsing a value at line 1 column 0',
      ),
    }
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(bodyText)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'invalid JSON'
    return { ok: false, result: textResult(400, `Failed to parse the request body as JSON: ${message}`) }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return {
      ok: false,
      result: textResult(
        422,
        `Failed to deserialize the JSON body into the target type: invalid type: ${jsonTypeName(parsed)}, expected a JSON object`,
      ),
    }
  }
  const body = parsed as ParsedBody
  for (const [name, spec] of Object.entries(fields)) {
    const value = body[name]
    if (value === undefined) {
      if (spec.required) {
        return {
          ok: false,
          result: textResult(
            422,
            `Failed to deserialize the JSON body into the target type: missing field \`${name}\``,
          ),
        }
      }
      continue
    }
    if (value === null) {
      // Optional fields deserialize as Option and accept null; a required
      // non-nullable field does not.
      if (spec.required && !spec.nullable) {
        return {
          ok: false,
          result: textResult(
            422,
            `Failed to deserialize the JSON body into the target type: invalid type: null, expected ${EXPECTED_TYPE[spec.type]} at field \`${name}\``,
          ),
        }
      }
      continue
    }
    const wrongType =
      (spec.type === 'string' && typeof value !== 'string') ||
      (spec.type === 'number' && typeof value !== 'number') ||
      (spec.type === 'integer' && (typeof value !== 'number' || !Number.isInteger(value)))
    if (wrongType) {
      return {
        ok: false,
        result: textResult(
          422,
          `Failed to deserialize the JSON body into the target type: invalid type: ${jsonTypeName(value)}, expected ${EXPECTED_TYPE[spec.type]} at field \`${name}\``,
        ),
      }
    }
  }
  return { ok: true, value: body }
}

/**
 * Simulates the axum Query extractor for optional integer parameters:
 * a non-integer value rejects the whole query string with 400 text/plain.
 */
function readIntParam(
  query: Record<string, string>,
  name: string,
): { ok: true; value: number | undefined } | { ok: false; result: ExecResult } {
  const raw = query[name]
  if (raw === undefined) return { ok: true, value: undefined }
  if (!/^-?\d+$/.test(raw.trim())) {
    return {
      ok: false,
      result: textResult(
        400,
        `Failed to deserialize query string: ${name}: invalid digit found in string`,
      ),
    }
  }
  return { ok: true, value: Number.parseInt(raw.trim(), 10) }
}

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max)

const OWNER_FILTER_NOTE = `Every demo record is owned by "${DEMO_CALLER_ID}" (the simulated admin caller), so an owner_id filter with any other value matches nothing.`

/** Applies the owner_id filter shared by the CRM list operations. */
function applyOwnerFilter<T>(
  rows: T[],
  ownerId: string | undefined,
  notes: string[],
): T[] {
  if (ownerId === undefined) return rows
  notes.push(OWNER_FILTER_NOTE)
  return ownerId === DEMO_CALLER_ID ? rows : []
}

// ---------------------------------------------------------------------------
// accounts-service executors (validation -> 400 ApiError, per spec)
// ---------------------------------------------------------------------------

const ACCOUNT_STATUSES = ['active', 'inactive', 'churned']

const accountDto = (record: CrmAccount) => ({
  id: record.id,
  owner_id: DEMO_CALLER_ID,
  name: record.name,
  domain: blankToNull(record.domain),
  status: record.status,
  created_at: specTime(record.created_at),
  updated_at: specTime(record.updated_at),
})

const accountIdHints = (ctx: ExecutorContext) => ctx.crm.list('accounts').map((r) => r.id)

const ACCOUNTS_OPS: Record<string, ExecutableOp> = {
  listAccounts: {
    run({ query }, ctx) {
      const limitRead = readIntParam(query, 'limit')
      if (!limitRead.ok) return limitRead.result
      const offsetRead = readIntParam(query, 'offset')
      if (!offsetRead.ok) return offsetRead.result
      const limit = clamp(limitRead.value ?? 50, 1, 100)
      const offset = Math.max(offsetRead.value ?? 0, 0)

      const notes: string[] = []
      let rows = ctx.crm.list('accounts')
      if (query.status !== undefined) rows = rows.filter((r) => r.status === query.status)
      if (query.q !== undefined) {
        const needle = query.q.toLowerCase()
        rows = rows.filter((r) => r.name.toLowerCase().includes(needle))
      }
      rows = applyOwnerFilter(rows, query.owner_id, notes)
      rows = [...rows].sort(
        (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
      )
      const page = rows.slice(offset, offset + limit)
      return jsonResult(
        200,
        { data: page.map(accountDto), total: rows.length, limit, offset },
        notes,
      )
    },
  },

  createAccount: {
    run({ bodyText }, ctx) {
      const read = readBody(bodyText, {
        name: { type: 'string', required: true },
        domain: { type: 'string', nullable: true },
        status: { type: 'string' },
      })
      if (!read.ok) return read.result
      const name = String(read.value.name).trim()
      if (name === '') {
        return validationError(400, 'name must not be empty', {
          field: 'name',
          constraint: 'must not be empty',
        })
      }
      if (name.length > 255) {
        return validationError(400, 'name exceeds maximum length', {
          field: 'name',
          constraint: 'max 255 characters',
        })
      }
      const status = read.value.status == null ? 'active' : String(read.value.status)
      if (!ACCOUNT_STATUSES.includes(status)) {
        return validationError(400, 'invalid status value', {
          field: 'status',
          valid_values: ACCOUNT_STATUSES,
        })
      }
      const domain = read.value.domain == null ? '' : String(read.value.domain).trim()
      const record = ctx.crm.insertFromImport('accounts', { name, domain, status }) as CrmAccount
      return jsonResult(201, accountDto(record))
    },
  },

  getAccount: {
    idHints: { id: accountIdHints },
    run({ path }, ctx) {
      const record = ctx.crm.list('accounts').find((r) => r.id === path.id)
      return record ? jsonResult(200, accountDto(record)) : notFound('account')
    },
  },

  updateAccount: {
    idHints: { id: accountIdHints },
    run({ path, bodyText }, ctx) {
      const read = readBody(bodyText, {
        name: { type: 'string' },
        domain: { type: 'string', nullable: true },
        status: { type: 'string' },
      })
      if (!read.ok) return read.result
      const changes: Record<string, string> = {}
      if (read.value.name != null) {
        const name = String(read.value.name).trim()
        if (name === '') {
          return validationError(400, 'name cannot be empty', {
            field: 'name',
            constraint: 'cannot be empty',
          })
        }
        if (name.length > 255) {
          return validationError(400, 'name exceeds maximum length', {
            field: 'name',
            constraint: 'max 255 characters',
          })
        }
        changes.name = name
      }
      if (read.value.status != null) {
        const status = String(read.value.status)
        if (!ACCOUNT_STATUSES.includes(status)) {
          return validationError(400, 'invalid status value', {
            field: 'status',
            valid_values: ACCOUNT_STATUSES,
          })
        }
        changes.status = status
      }
      if (read.value.domain != null) {
        // A blank or whitespace-only domain clears the field to null.
        changes.domain = String(read.value.domain).trim()
      }
      const updated = ctx.crm.updateFields('accounts', path.id, changes)
      return updated ? jsonResult(200, accountDto(updated as CrmAccount)) : notFound('account')
    },
  },

  deleteAccount: {
    idHints: { id: accountIdHints },
    run({ path }, ctx) {
      return ctx.crm.remove('accounts', path.id) ? { status: 204 } : notFound('account')
    },
  },
}

// ---------------------------------------------------------------------------
// contacts-service executors (validation -> 400 ApiError; unknown account_id
// -> 422 INVALID_ACCOUNT, verified against the demo accounts dataset)
// ---------------------------------------------------------------------------

const LIFECYCLE_STAGES = ['lead', 'prospect', 'customer', 'churned', 'evangelist']

const INVALID_ACCOUNT_NOTE =
  'account_id is verified against the demo accounts dataset, standing in for the live cross-service check against accounts-service.'

const contactDto = (record: CrmContact) => ({
  id: record.id,
  owner_id: DEMO_CALLER_ID,
  account_id: blankToNull(record.account_id),
  first_name: record.first_name,
  last_name: record.last_name,
  email: blankToNull(record.email),
  phone: blankToNull(record.phone),
  lifecycle_stage: record.lifecycle_stage,
  created_at: specTime(record.created_at),
  updated_at: specTime(record.updated_at),
})

const contactIdHints = (ctx: ExecutorContext) => ctx.crm.list('contacts').map((r) => r.id)

/** Shared 400 checks for a contact name part; empty-message text differs. */
function checkContactName(
  value: string,
  field: 'first_name' | 'last_name',
  emptyMessage: string,
): ExecResult | null {
  if (value === '') {
    return validationError(400, emptyMessage, { field, constraint: 'must not be empty' })
  }
  if (value.length > 255) {
    return validationError(400, `${field} exceeds maximum length`, {
      field,
      constraint: 'max 255 characters',
    })
  }
  return null
}

const CONTACTS_OPS: Record<string, ExecutableOp> = {
  listContacts: {
    run({ query }, ctx) {
      const limitRead = readIntParam(query, 'limit')
      if (!limitRead.ok) return limitRead.result
      const offsetRead = readIntParam(query, 'offset')
      if (!offsetRead.ok) return offsetRead.result
      const limit = clamp(limitRead.value ?? 50, 1, 100)
      const offset = Math.max(offsetRead.value ?? 0, 0)

      const notes: string[] = []
      let rows = ctx.crm.list('contacts')
      if (query.account_id !== undefined) {
        rows = rows.filter((r) => (r.account_id ?? '') === query.account_id)
      }
      if (query.lifecycle_stage !== undefined) {
        rows = rows.filter((r) => r.lifecycle_stage === query.lifecycle_stage)
      }
      if (query.q !== undefined) {
        const needle = query.q.toLowerCase()
        rows = rows.filter((r) =>
          [r.first_name, r.last_name, r.email ?? ''].some((v) => v.toLowerCase().includes(needle)),
        )
      }
      rows = applyOwnerFilter(rows, query.owner_id, notes)
      rows = [...rows].sort(
        (a, b) =>
          a.last_name.localeCompare(b.last_name, 'en') ||
          a.first_name.localeCompare(b.first_name, 'en'),
      )
      const page = rows.slice(offset, offset + limit)
      return jsonResult(
        200,
        { data: page.map(contactDto), total: rows.length, limit, offset },
        notes,
      )
    },
  },

  createContact: {
    run({ bodyText }, ctx) {
      const read = readBody(bodyText, {
        first_name: { type: 'string', required: true },
        last_name: { type: 'string', required: true },
        account_id: { type: 'string', nullable: true },
        email: { type: 'string', nullable: true },
        phone: { type: 'string', nullable: true },
        lifecycle_stage: { type: 'string' },
      })
      if (!read.ok) return read.result
      const firstName = String(read.value.first_name).trim()
      const lastName = String(read.value.last_name).trim()
      const nameError =
        checkContactName(firstName, 'first_name', 'first_name must not be empty') ??
        checkContactName(lastName, 'last_name', 'last_name must not be empty')
      if (nameError) return nameError
      const stage =
        read.value.lifecycle_stage == null ? 'lead' : String(read.value.lifecycle_stage).trim()
      if (!LIFECYCLE_STAGES.includes(stage)) {
        return validationError(400, 'invalid lifecycle_stage value', {
          field: 'lifecycle_stage',
          valid_values: LIFECYCLE_STAGES,
        })
      }
      const accountId = blankToNull(
        read.value.account_id == null ? undefined : String(read.value.account_id).trim(),
      )
      if (accountId !== null && !ctx.crm.list('accounts').some((a) => a.id === accountId)) {
        return jsonResult(422, { code: 'INVALID_ACCOUNT', message: 'account not found' }, [
          INVALID_ACCOUNT_NOTE,
        ])
      }
      const email = blankToNull(read.value.email == null ? undefined : String(read.value.email).trim())
      if (email !== null && email.length > 255) {
        return validationError(400, 'email exceeds maximum length', {
          field: 'email',
          constraint: 'max 255 characters',
        })
      }
      const phone = blankToNull(read.value.phone == null ? undefined : String(read.value.phone))
      const record = ctx.crm.insertFromImport('contacts', {
        first_name: firstName,
        last_name: lastName,
        account_id: accountId ?? '',
        email: email ?? '',
        phone: phone ?? '',
        lifecycle_stage: stage,
      }) as CrmContact
      return jsonResult(201, contactDto(record))
    },
  },

  getContact: {
    idHints: { id: contactIdHints },
    run({ path }, ctx) {
      const record = ctx.crm.list('contacts').find((r) => r.id === path.id)
      return record ? jsonResult(200, contactDto(record)) : notFound('contact')
    },
  },

  updateContact: {
    idHints: { id: contactIdHints },
    run({ path, bodyText }, ctx) {
      // The handler fetches the existing row before validating the body, so
      // an unknown id returns 404 even when the body is invalid.
      if (!ctx.crm.list('contacts').some((r) => r.id === path.id)) return notFound('contact')
      const read = readBody(bodyText, {
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        account_id: { type: 'string', nullable: true },
        email: { type: 'string', nullable: true },
        phone: { type: 'string', nullable: true },
        lifecycle_stage: { type: 'string' },
      })
      if (!read.ok) return read.result
      const changes: Record<string, string> = {}
      const notes: string[] = []
      if (read.value.first_name != null) {
        const firstName = String(read.value.first_name).trim()
        const error = checkContactName(firstName, 'first_name', 'first_name cannot be empty')
        if (error) return error
        changes.first_name = firstName
      }
      if (read.value.last_name != null) {
        const lastName = String(read.value.last_name).trim()
        const error = checkContactName(lastName, 'last_name', 'last_name cannot be empty')
        if (error) return error
        changes.last_name = lastName
      }
      if (read.value.lifecycle_stage != null) {
        const stage = String(read.value.lifecycle_stage).trim()
        if (!LIFECYCLE_STAGES.includes(stage)) {
          return validationError(400, 'invalid lifecycle_stage value', {
            field: 'lifecycle_stage',
            valid_values: LIFECYCLE_STAGES,
          })
        }
        changes.lifecycle_stage = stage
      }
      if (read.value.account_id != null) {
        // Blank clears to null; non-blank is verified against demo accounts.
        const accountId = String(read.value.account_id).trim()
        if (accountId !== '' && !ctx.crm.list('accounts').some((a) => a.id === accountId)) {
          return jsonResult(422, { code: 'INVALID_ACCOUNT', message: 'account not found' }, [
            INVALID_ACCOUNT_NOTE,
          ])
        }
        changes.account_id = accountId
        if (accountId !== '') notes.push(INVALID_ACCOUNT_NOTE)
      }
      if (read.value.email != null) {
        const email = String(read.value.email).trim()
        if (email.length > 255) {
          return validationError(400, 'email exceeds maximum length', {
            field: 'email',
            constraint: 'max 255 characters',
          })
        }
        changes.email = email
      }
      if (read.value.phone != null) changes.phone = String(read.value.phone).trim()
      const updated = ctx.crm.updateFields('contacts', path.id, changes)
      return updated
        ? jsonResult(200, contactDto(updated as CrmContact), notes)
        : notFound('contact')
    },
  },

  deleteContact: {
    idHints: { id: contactIdHints },
    run({ path }, ctx) {
      return ctx.crm.remove('contacts', path.id) ? { status: 204 } : notFound('contact')
    },
  },
}

// ---------------------------------------------------------------------------
// opportunities-service executors (handler validation -> 422 ApiError,
// per this spec; 400 is reserved for malformed JSON)
// ---------------------------------------------------------------------------

const opportunityDto = (record: CrmOpportunity) => ({
  id: record.id,
  owner_id: DEMO_CALLER_ID,
  account_id: record.account_id,
  name: record.name,
  stage: record.stage,
  amount: record.amount,
  close_date: record.close_date ?? null,
  created_at: specTime(record.created_at),
  updated_at: specTime(record.updated_at),
})

const opportunityIdHints = (ctx: ExecutorContext) =>
  ctx.crm.list('opportunities').map((r) => r.id)

/** 422 checks shared by the opportunity string fields. */
function checkOpportunityText(
  value: string,
  field: 'name' | 'account_id' | 'stage',
  emptyMessage: string,
): ExecResult | null {
  if (value === '') {
    return validationError(422, emptyMessage, { field, constraint: 'must not be empty' })
  }
  if (value.length > 255) {
    return validationError(422, `${field} exceeds maximum length of 255 characters`, {
      field,
      constraint: 'max 255 characters',
    })
  }
  return null
}

const OPPORTUNITIES_OPS: Record<string, ExecutableOp> = {
  listOpportunities: {
    run({ query }, ctx) {
      const notes: string[] = []
      let rows = ctx.crm.list('opportunities')
      rows = applyOwnerFilter(rows, query.owner_id, notes)
      rows = [...rows].sort((a, b) => b.created_at.localeCompare(a.created_at))
      return jsonResult(200, rows.map(opportunityDto), notes)
    },
  },

  createOpportunity: {
    run({ bodyText }, ctx) {
      const read = readBody(bodyText, {
        account_id: { type: 'string', required: true },
        name: { type: 'string', required: true },
        stage: { type: 'string' },
        amount: { type: 'number' },
        close_date: { type: 'string', nullable: true },
      })
      if (!read.ok) return read.result
      // name is validated before account_id, per the spec.
      const name = String(read.value.name).trim()
      const accountId = String(read.value.account_id).trim()
      const error =
        checkOpportunityText(name, 'name', 'name must not be empty') ??
        checkOpportunityText(accountId, 'account_id', 'account_id must not be empty')
      if (error) return error
      const stage =
        read.value.stage == null || String(read.value.stage).trim() === ''
          ? 'qualification'
          : String(read.value.stage).trim()
      const amount = read.value.amount == null ? 0 : (read.value.amount as number)
      const closeDate = read.value.close_date == null ? '' : String(read.value.close_date)
      const record = ctx.crm.insertFromImport('opportunities', {
        name,
        account_id: accountId,
        stage,
        amount: String(amount),
        close_date: closeDate,
      }) as CrmOpportunity
      return jsonResult(201, opportunityDto(record))
    },
  },

  getOpportunity: {
    idHints: { id: opportunityIdHints },
    run({ path }, ctx) {
      const record = ctx.crm.list('opportunities').find((r) => r.id === path.id)
      return record ? jsonResult(200, opportunityDto(record)) : notFound('opportunity')
    },
  },

  updateOpportunity: {
    idHints: { id: opportunityIdHints },
    run({ path, bodyText }, ctx) {
      // The handler fetches the existing row first, so an unknown id returns
      // 404 before any field validation runs.
      if (!ctx.crm.list('opportunities').some((r) => r.id === path.id)) {
        return notFound('opportunity')
      }
      const read = readBody(bodyText, {
        name: { type: 'string' },
        stage: { type: 'string' },
        amount: { type: 'number' },
        close_date: { type: 'string' },
      })
      if (!read.ok) return read.result
      const changes: Record<string, string | number> = {}
      if (read.value.name != null) {
        const name = String(read.value.name).trim()
        const error = checkOpportunityText(name, 'name', 'name cannot be empty')
        if (error) return error
        changes.name = name
      }
      if (read.value.stage != null) {
        const stage = String(read.value.stage).trim()
        const error = checkOpportunityText(stage, 'stage', 'stage cannot be empty')
        if (error) return error
        changes.stage = stage
      }
      if (read.value.amount != null) changes.amount = read.value.amount as number
      if (read.value.close_date != null) {
        // Trimmed and stored; an empty string is stored as an empty string.
        changes.close_date = String(read.value.close_date).trim()
      }
      const updated = ctx.crm.updateFields('opportunities', path.id, changes)
      return updated
        ? jsonResult(200, opportunityDto(updated as CrmOpportunity))
        : notFound('opportunity')
    },
  },

  deleteOpportunity: {
    idHints: { id: opportunityIdHints },
    run({ path }, ctx) {
      return ctx.crm.remove('opportunities', path.id) ? { status: 204 } : notFound('opportunity')
    },
  },
}

// ---------------------------------------------------------------------------
// projects-service executors (validation -> 400 ApiError; parent-existence
// checks run before body validation; delete FK failures -> 500 DB_ERROR)
// ---------------------------------------------------------------------------

// Status enums come from the shared spec-locked vocabulary module
// (projectStatusVocabulary.ts); since v1.16.5 PR2 the demo seed uses the
// documented enums too, so no legacy-vocabulary caveat is needed here.

/** The projects-service Project DTO has no budget field; the demo record does. */
const projectDto = (record: DemoProject) => ({
  id: record.id,
  account_id: record.account_id,
  client_user_id: record.client_user_id,
  name: record.name,
  description: record.description,
  status: record.status,
  start_date: record.start_date,
  target_end_date: record.target_end_date,
  created_at: specTime(record.created_at),
  updated_at: specTime(record.updated_at),
})

const milestoneDto = (record: DemoMilestone) => ({
  id: record.id,
  project_id: record.project_id,
  name: record.name,
  description: record.description,
  due_date: record.due_date,
  status: record.status,
  sort_order: record.sort_order,
  created_at: specTime(record.created_at),
  updated_at: specTime(record.updated_at),
})

const deliverableDto = (record: DemoDeliverable) => ({
  id: record.id,
  milestone_id: record.milestone_id,
  name: record.name,
  description: record.description,
  status: record.status,
  estimated_hours: record.estimated_hours,
  created_at: specTime(record.created_at),
  updated_at: specTime(record.updated_at),
})

const projectIdHints = (ctx: ExecutorContext) => ctx.projects.listProjects().map((p) => p.id)
const milestoneIdHints = (ctx: ExecutorContext) =>
  ctx.projects.listProjects().flatMap((p) => ctx.projects.listMilestones(p.id)).map((m) => m.id)
const deliverableIdHints = (ctx: ExecutorContext) =>
  ctx.projects
    .listProjects()
    .flatMap((p) => ctx.projects.listMilestones(p.id))
    .flatMap((m) => ctx.projects.listDeliverables(m.id))
    .map((d) => d.id)

/** Shared 400 checks: trimmed non-empty name, max lengths, status enums. */
function checkProjectsText(
  value: string,
  field: string,
  maxLength: number,
): ExecResult | null {
  if (value === '') {
    return validationError(400, `${field} must not be empty`, {
      field,
      constraint: 'must not be empty',
    })
  }
  if (value.length > maxLength) {
    return validationError(400, `${field} exceeds maximum length`, {
      field,
      constraint: `max ${maxLength} characters`,
    })
  }
  return null
}

function checkDescription(value: string): ExecResult | null {
  if (value.length > 1000) {
    return validationError(400, 'description exceeds maximum length', {
      field: 'description',
      constraint: 'max 1000 characters',
    })
  }
  return null
}

function checkStatusEnum(value: string, allowed: readonly string[]): ExecResult | null {
  if (!allowed.includes(value)) {
    return validationError(400, `status must be one of: ${allowed.join(', ')}`, {
      field: 'status',
      valid_values: [...allowed],
    })
  }
  return null
}

const PROJECT_FK_NOTE =
  'Simulated foreign-key failure, exactly as the spec documents it: the milestones table references projects without ON DELETE CASCADE, so deleting a project that still has milestones surfaces as 500 DB_ERROR. Delete its milestones (and their deliverables) first.'

const MILESTONE_FK_NOTE =
  'Simulated foreign-key failure, exactly as the spec documents it: the deliverables table references milestones without ON DELETE CASCADE, so deleting a milestone that still has deliverables surfaces as 500 DB_ERROR. Delete its deliverables first.'

const PROJECTS_OPS: Record<string, ExecutableOp> = {
  listProjects: {
    run(_input, ctx) {
      const rows = [...ctx.projects.listProjects()].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      )
      return jsonResult(200, rows.map(projectDto))
    },
  },

  createProject: {
    run({ bodyText }, ctx) {
      const read = readBody(bodyText, {
        account_id: { type: 'string', required: true },
        name: { type: 'string', required: true },
        client_user_id: { type: 'string', nullable: true },
        description: { type: 'string', nullable: true },
        status: { type: 'string' },
        start_date: { type: 'string', nullable: true },
        target_end_date: { type: 'string', nullable: true },
      })
      if (!read.ok) return read.result
      const name = String(read.value.name).trim()
      const accountId = String(read.value.account_id).trim()
      const description = read.value.description == null ? null : String(read.value.description)
      const error =
        checkProjectsText(name, 'name', 255) ??
        checkProjectsText(accountId, 'account_id', 255) ??
        (description !== null ? checkDescription(description) : null)
      if (error) return error
      const statusRaw = read.value.status == null ? '' : String(read.value.status).trim()
      let status: ProjectStatus = 'active'
      if (statusRaw !== '') {
        const statusError = checkStatusEnum(statusRaw, PROJECT_STATUSES)
        if (statusError) return statusError
        status = statusRaw as ProjectStatus
      }
      const record = ctx.projects.createProject({
        account_id: accountId,
        name,
        client_user_id: read.value.client_user_id == null ? null : String(read.value.client_user_id),
        description,
        status,
        start_date: read.value.start_date == null ? null : String(read.value.start_date),
        target_end_date:
          read.value.target_end_date == null ? null : String(read.value.target_end_date),
      })
      return jsonResult(201, projectDto(record))
    },
  },

  getProject: {
    idHints: { id: projectIdHints },
    run({ path }, ctx) {
      const record = ctx.projects.getProject(path.id)
      return record ? jsonResult(200, projectDto(record)) : notFound('project')
    },
  },

  updateProject: {
    idHints: { id: projectIdHints },
    run({ path, bodyText }, ctx) {
      // The existing row is loaded before body validation, so an unknown id
      // returns 404 even when the body is also invalid.
      if (!ctx.projects.getProject(path.id)) return notFound('project')
      const read = readBody(bodyText, {
        client_user_id: { type: 'string', nullable: true },
        name: { type: 'string', nullable: true },
        description: { type: 'string', nullable: true },
        status: { type: 'string', nullable: true },
        start_date: { type: 'string', nullable: true },
        target_end_date: { type: 'string', nullable: true },
      })
      if (!read.ok) return read.result
      // Explicit null is treated the same as omitting the field, per the spec.
      const changes: {
        client_user_id?: string
        name?: string
        description?: string
        status?: ProjectStatus
        start_date?: string
        target_end_date?: string
      } = {}
      if (read.value.name != null) {
        const name = String(read.value.name).trim()
        const error = checkProjectsText(name, 'name', 255)
        if (error) return error
        changes.name = name
      }
      if (read.value.status != null) {
        const status = String(read.value.status)
        const error = checkStatusEnum(status, PROJECT_STATUSES)
        if (error) return error
        changes.status = status as ProjectStatus
      }
      if (read.value.description != null) {
        const description = String(read.value.description)
        const error = checkDescription(description)
        if (error) return error
        changes.description = description
      }
      if (read.value.client_user_id != null) {
        changes.client_user_id = String(read.value.client_user_id)
      }
      if (read.value.start_date != null) changes.start_date = String(read.value.start_date).trim()
      if (read.value.target_end_date != null) {
        changes.target_end_date = String(read.value.target_end_date).trim()
      }
      const updated = ctx.projects.updateProject(path.id, changes)
      return updated ? jsonResult(200, projectDto(updated)) : notFound('project')
    },
  },

  deleteProject: {
    idHints: { id: projectIdHints },
    run({ path }, ctx) {
      if (!ctx.projects.getProject(path.id)) return notFound('project')
      if (ctx.projects.listMilestones(path.id).length > 0) {
        return jsonResult(500, { code: 'DB_ERROR', message: 'database error' }, [PROJECT_FK_NOTE])
      }
      ctx.projects.removeProject(path.id)
      return { status: 204 }
    },
  },

  listMilestones: {
    idHints: { project_id: projectIdHints },
    run({ path }, ctx) {
      if (!ctx.projects.getProject(path.project_id)) return notFound('project')
      const rows = [...ctx.projects.listMilestones(path.project_id)].sort(
        (a, b) => a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
      )
      return jsonResult(200, rows.map(milestoneDto))
    },
  },

  createMilestone: {
    idHints: { project_id: projectIdHints },
    run({ path, bodyText }, ctx) {
      // The parent project existence check runs before body validation, so an
      // unknown project_id returns 404 even when the body is also invalid.
      if (!ctx.projects.getProject(path.project_id)) return notFound('project')
      const read = readBody(bodyText, {
        name: { type: 'string', required: true },
        description: { type: 'string', nullable: true },
        due_date: { type: 'string', nullable: true },
        status: { type: 'string' },
        sort_order: { type: 'integer' },
      })
      if (!read.ok) return read.result
      const name = String(read.value.name).trim()
      const description = read.value.description == null ? null : String(read.value.description)
      const error =
        checkProjectsText(name, 'name', 255) ??
        (description !== null ? checkDescription(description) : null)
      if (error) return error
      const statusRaw = read.value.status == null ? '' : String(read.value.status).trim()
      let status: MilestoneStatus = 'pending'
      if (statusRaw !== '') {
        const statusError = checkStatusEnum(statusRaw, MILESTONE_STATUSES)
        if (statusError) return statusError
        status = statusRaw as MilestoneStatus
      }
      const record = ctx.projects.createMilestone(path.project_id, {
        name,
        description,
        due_date: read.value.due_date == null ? null : String(read.value.due_date),
        status,
        sort_order: read.value.sort_order == null ? 0 : (read.value.sort_order as number) | 0,
      })
      return record ? jsonResult(201, milestoneDto(record)) : notFound('project')
    },
  },

  updateMilestone: {
    idHints: { id: milestoneIdHints },
    run({ path, bodyText }, ctx) {
      if (!ctx.projects.getMilestone(path.id)) return notFound('milestone')
      const read = readBody(bodyText, {
        name: { type: 'string', nullable: true },
        description: { type: 'string', nullable: true },
        due_date: { type: 'string', nullable: true },
        status: { type: 'string', nullable: true },
        sort_order: { type: 'integer', nullable: true },
      })
      if (!read.ok) return read.result
      const changes: {
        name?: string
        description?: string
        due_date?: string
        status?: MilestoneStatus
        sort_order?: number
      } = {}
      if (read.value.name != null) {
        const name = String(read.value.name).trim()
        const error = checkProjectsText(name, 'name', 255)
        if (error) return error
        changes.name = name
      }
      if (read.value.status != null) {
        const status = String(read.value.status)
        const error = checkStatusEnum(status, MILESTONE_STATUSES)
        if (error) return error
        changes.status = status as MilestoneStatus
      }
      if (read.value.description != null) {
        const description = String(read.value.description)
        const error = checkDescription(description)
        if (error) return error
        changes.description = description
      }
      if (read.value.due_date != null) changes.due_date = String(read.value.due_date).trim()
      if (read.value.sort_order != null) changes.sort_order = (read.value.sort_order as number) | 0
      const updated = ctx.projects.updateMilestone(path.id, changes)
      return updated ? jsonResult(200, milestoneDto(updated)) : notFound('milestone')
    },
  },

  deleteMilestone: {
    idHints: { id: milestoneIdHints },
    run({ path }, ctx) {
      if (!ctx.projects.getMilestone(path.id)) return notFound('milestone')
      if (ctx.projects.listDeliverables(path.id).length > 0) {
        return jsonResult(500, { code: 'DB_ERROR', message: 'database error' }, [MILESTONE_FK_NOTE])
      }
      ctx.projects.removeMilestone(path.id)
      return { status: 204 }
    },
  },

  listDeliverables: {
    idHints: { milestone_id: milestoneIdHints },
    run({ path }, ctx) {
      if (!ctx.projects.getMilestone(path.milestone_id)) return notFound('milestone')
      const rows = [...ctx.projects.listDeliverables(path.milestone_id)].sort((a, b) =>
        a.created_at.localeCompare(b.created_at),
      )
      return jsonResult(200, rows.map(deliverableDto))
    },
  },

  createDeliverable: {
    idHints: { milestone_id: milestoneIdHints },
    run({ path, bodyText }, ctx) {
      // Parent milestone existence is checked before body validation.
      if (!ctx.projects.getMilestone(path.milestone_id)) return notFound('milestone')
      const read = readBody(bodyText, {
        name: { type: 'string', required: true },
        description: { type: 'string', nullable: true },
        status: { type: 'string' },
        estimated_hours: { type: 'number', nullable: true },
      })
      if (!read.ok) return read.result
      const name = String(read.value.name).trim()
      const description = read.value.description == null ? null : String(read.value.description)
      const error =
        checkProjectsText(name, 'name', 255) ??
        (description !== null ? checkDescription(description) : null)
      if (error) return error
      const statusRaw = read.value.status == null ? '' : String(read.value.status).trim()
      let status: DeliverableStatus = 'not_started'
      if (statusRaw !== '') {
        const statusError = checkStatusEnum(statusRaw, DELIVERABLE_STATUSES)
        if (statusError) return statusError
        status = statusRaw as DeliverableStatus
      }
      const record = ctx.projects.createDeliverable(path.milestone_id, {
        name,
        description,
        status,
        estimated_hours:
          read.value.estimated_hours == null ? null : (read.value.estimated_hours as number),
      })
      return record ? jsonResult(201, deliverableDto(record)) : notFound('milestone')
    },
  },

  updateDeliverable: {
    idHints: { id: deliverableIdHints },
    run({ path, bodyText }, ctx) {
      if (!ctx.projects.getDeliverable(path.id)) return notFound('deliverable')
      const read = readBody(bodyText, {
        name: { type: 'string', nullable: true },
        description: { type: 'string', nullable: true },
        status: { type: 'string', nullable: true },
        estimated_hours: { type: 'number', nullable: true },
      })
      if (!read.ok) return read.result
      const changes: {
        name?: string
        description?: string
        status?: DeliverableStatus
        estimated_hours?: number
      } = {}
      if (read.value.name != null) {
        const name = String(read.value.name).trim()
        const error = checkProjectsText(name, 'name', 255)
        if (error) return error
        changes.name = name
      }
      if (read.value.status != null) {
        const status = String(read.value.status)
        const error = checkStatusEnum(status, DELIVERABLE_STATUSES)
        if (error) return error
        changes.status = status as DeliverableStatus
      }
      if (read.value.description != null) {
        const description = String(read.value.description)
        const error = checkDescription(description)
        if (error) return error
        changes.description = description
      }
      if (read.value.estimated_hours != null) {
        changes.estimated_hours = read.value.estimated_hours as number
      }
      const updated = ctx.projects.updateDeliverable(path.id, changes)
      return updated ? jsonResult(200, deliverableDto(updated)) : notFound('deliverable')
    },
  },

  deleteDeliverable: {
    idHints: { id: deliverableIdHints },
    run({ path }, ctx) {
      return ctx.projects.removeDeliverable(path.id) ? { status: 204 } : notFound('deliverable')
    },
  },
}

// ---------------------------------------------------------------------------
// Support map and adapter assembly
// ---------------------------------------------------------------------------

const EXECUTABLE: Record<string, Record<string, ExecutableOp>> = {
  accounts: ACCOUNTS_OPS,
  contacts: CONTACTS_OPS,
  opportunities: OPPORTUNITIES_OPS,
  projects: PROJECTS_OPS,
}

/** Services whose entities have an in-browser demo dataset. */
export const COVERED_SERVICE_IDS: readonly string[] = Object.keys(EXECUTABLE)

/** Total executable operations across all specs (28 of 99 in v1.17.2). */
export const EXECUTABLE_OPERATION_COUNT: number = Object.values(EXECUTABLE).reduce(
  (sum, ops) => sum + Object.keys(ops).length,
  0,
)

const NO_DATASET_REASON = (serviceId: string): string =>
  `${serviceId}-service has no in-browser demo dataset. This playground ships demo data for accounts, contacts, opportunities, and projects only; every other spec is a static reference. Simulating a success here would be fake, so execution is disabled.`

const PROBE_REASON =
  'Health and readiness probes report on a running service process and its database ping. This playground calls nothing, so simulating an "ok" here would be fake liveness. Disabled instead: the platform status board at #/status publishes the real per-service health.'

const NO_ENTITY_REASON =
  'The in-browser projects demo dataset covers projects, milestones, and deliverables. There is no demo dataset behind this operation, and inventing one on the fly would misrepresent the documented behavior, so execution is disabled.'

export function getTryItSupport(
  serviceId: string,
  operation: Pick<OperationView, 'operationId' | 'path'>,
): TryItSupport {
  const ops = EXECUTABLE[serviceId]
  if (!ops) return { executable: false, reason: NO_DATASET_REASON(serviceId) }
  if (operation.path === '/health' || operation.path === '/ready') {
    return { executable: false, reason: PROBE_REASON }
  }
  if (!ops[operation.operationId]) return { executable: false, reason: NO_ENTITY_REASON }
  return { executable: true }
}

const RATE_HEADER_NOTE =
  'X-RateLimit-* values are simulated from the documented gateway tiers (read 60 rps, write 30 rps); no gateway is running.'

export interface TryItAdapterOptions {
  /** Demo datasets the executors run against. Default: the shared stores. */
  crm?: CrmStore
  projects?: ProjectsStore
  /** Clock for the simulated X-RateLimit-Reset header. Inject in tests. */
  now?: () => number
}

export interface TryItAdapter {
  support(serviceId: string, operation: Pick<OperationView, 'operationId' | 'path'>): TryItSupport
  /** Runs an executable operation. Throws for operations support() disables. */
  execute(serviceId: string, operation: OperationView, input: TryItInput): SimulatedResponse
  /** Current demo ids suggested for a path parameter (empty when none). */
  idHints(serviceId: string, operationId: string, paramName: string): string[]
}

export function createTryItAdapter(options: TryItAdapterOptions = {}): TryItAdapter {
  const ctx: ExecutorContext = {
    crm: options.crm ?? crmStore,
    projects: options.projects ?? projectsStore,
  }
  const now = options.now ?? Date.now

  return {
    support: getTryItSupport,

    execute(serviceId, operation, input) {
      const support = getTryItSupport(serviceId, operation)
      if (!support.executable) {
        throw new Error(`operation is not executable in the demo: ${operation.operationId}`)
      }
      const op = EXECUTABLE[serviceId][operation.operationId]
      const result = op.run(
        {
          path: input.pathParams ?? {},
          query: input.query ?? {},
          bodyText: input.bodyText,
        },
        ctx,
      )

      const notes = [...(result.notes ?? [])]
      const headers: SimulatedHeader[] = []
      const documented = operation.responses.find((r) => r.status === String(result.status))
      if (documented?.headerNames.includes('X-RateLimit-Limit')) {
        const limit = operation.method === 'get' ? 60 : 30
        headers.push(
          { name: 'X-RateLimit-Limit', value: String(limit) },
          { name: 'X-RateLimit-Remaining', value: String(limit - 1) },
          { name: 'X-RateLimit-Reset', value: String(Math.floor(now() / 1000) + 1) },
        )
        notes.push(RATE_HEADER_NOTE)
      }

      let body: SimulatedBody = { kind: 'empty' }
      if (result.json !== undefined) {
        headers.push({ name: 'Content-Type', value: 'application/json' })
        body = { kind: 'json', value: result.json }
      } else if (result.text !== undefined) {
        headers.push({ name: 'Content-Type', value: 'text/plain; charset=utf-8' })
        body = { kind: 'text', value: result.text }
      }

      return {
        status: result.status,
        statusText: STATUS_TEXT[result.status] ?? '',
        headers,
        body,
        notes,
      }
    },

    idHints(serviceId, operationId, paramName) {
      const hint = EXECUTABLE[serviceId]?.[operationId]?.idHints?.[paramName]
      return hint ? hint(ctx) : []
    },
  }
}

/** Shared adapter used by the API docs page; executes against the demo stores. */
export const tryItAdapter: TryItAdapter = createTryItAdapter()

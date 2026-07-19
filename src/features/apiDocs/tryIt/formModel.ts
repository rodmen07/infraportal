/**
 * Pure form-model derivation for the "Try it" request builder (v1.17.2).
 *
 * Turns an OperationView (specModel.ts) into render-ready input descriptors
 * plus the serialization rules that build the simulated request. Scalar and
 * enum fields become individual inputs; anything nested (arrays, objects,
 * maps, free-form values) falls back to a JSON textarea prefilled from the
 * spec's example or a schema-derived skeleton.
 *
 * No store access and no React here: execution lives behind the marked demo
 * boundary in src/lib/tryItAdapter.mock.ts, and TryItPanel.tsx is the only
 * caller that touches the DOM.
 */

import type { OperationView, SchemaNodeView } from '../specModel'

export type TryItFieldKind = 'text' | 'integer' | 'number' | 'enum'

export interface TryItField {
  /** Stable input id, e.g. "path.id", "query.limit", "body.name". */
  id: string
  section: 'path' | 'query' | 'body'
  name: string
  required: boolean
  kind: TryItFieldKind
  enumValues?: (string | number)[]
  nullable: boolean
  description?: string
  /** Constraint hint shown in the input, e.g. "default 50, 1 to 100". */
  placeholder?: string
}

export type TryItBodyMode = 'none' | 'fields' | 'json'

export interface TryItFormModel {
  operationId: string
  pathFields: TryItField[]
  queryFields: TryItField[]
  /**
   * How the request body is edited: 'none' (no requestBody), 'fields' (flat
   * object of scalar/enum fields, one input each; the panel can still switch
   * to a raw JSON textarea), or 'json' (complex body, JSON textarea only).
   */
  bodyMode: TryItBodyMode
  bodyFields: TryItField[]
  /** Prefilled JSON textarea content (spec example, else schema skeleton). */
  bodyTemplate?: string
  bodyRequired: boolean
}

function fieldKind(node: SchemaNodeView | undefined): TryItFieldKind {
  if (!node) return 'text'
  if (node.enumValues && node.enumValues.length > 0) return 'enum'
  if (node.label.startsWith('integer')) return 'integer'
  if (node.label.startsWith('number')) return 'number'
  return 'text'
}

/** A node a single input can edit: scalar or enum, not nested, not free-form. */
function isScalarNode(node: SchemaNodeView): boolean {
  if (node.fields !== undefined || node.items !== undefined || node.cyclic) return false
  if (node.label === 'any' || node.label === 'object' || node.refName) return false
  return true
}

function buildField(
  section: TryItField['section'],
  name: string,
  required: boolean,
  node: SchemaNodeView | undefined,
  description?: string,
): TryItField {
  const constraints = node?.constraints ?? []
  return {
    id: `${section}.${name}`,
    section,
    name,
    required,
    kind: fieldKind(node),
    enumValues: node?.enumValues,
    nullable: node?.nullable ?? false,
    description: description ?? node?.description,
    placeholder: constraints.length > 0 ? constraints.join(', ') : undefined,
  }
}

/** Skeleton value for the JSON-textarea fallback, derived from the schema. */
export function schemaSkeleton(node: SchemaNodeView, depth = 0): unknown {
  if (depth > 6 || node.cyclic) return null
  if (node.enumValues && node.enumValues.length > 0) return node.enumValues[0]
  if (node.items !== undefined && node.label.startsWith('array')) {
    return [schemaSkeleton(node.items, depth + 1)]
  }
  if (node.items !== undefined && node.label.startsWith('map')) return {}
  if (node.fields !== undefined) {
    return Object.fromEntries(
      node.fields.map((field) => [field.name, schemaSkeleton(field.node, depth + 1)]),
    )
  }
  if (node.label.startsWith('integer') || node.label.startsWith('number')) return 0
  if (node.label.startsWith('boolean')) return false
  if (node.label === 'any' || node.label === 'object' || node.refName) return null
  return ''
}

/** Derives the form model for one operation. Never throws on spec-scoped input. */
export function buildTryItForm(operation: OperationView): TryItFormModel {
  const pathFields: TryItField[] = []
  const queryFields: TryItField[] = []
  for (const param of operation.parameters) {
    if (param.location === 'path') {
      pathFields.push(buildField('path', param.name, true, param.schema, param.description))
    } else if (param.location === 'query') {
      queryFields.push(
        buildField('query', param.name, param.required, param.schema, param.description),
      )
    }
  }

  const model: TryItFormModel = {
    operationId: operation.operationId,
    pathFields,
    queryFields,
    bodyMode: 'none',
    bodyFields: [],
    bodyRequired: operation.requestBody?.required ?? false,
  }

  const media = operation.requestBody?.content.find((m) => m.mediaType === 'application/json')
  if (!operation.requestBody || !media) return model

  const schema = media.schema
  const flatObject =
    schema !== undefined &&
    schema.fields !== undefined &&
    schema.items === undefined &&
    schema.fields.every((field) => isScalarNode(field.node))

  if (schema && flatObject) {
    model.bodyMode = 'fields'
    model.bodyFields = schema.fields!.map((field) =>
      buildField('body', field.name, field.required, field.node),
    )
    return model
  }

  model.bodyMode = 'json'
  const example = media.examples[0]?.value
  const template = example !== undefined ? example : schema ? schemaSkeleton(schema) : {}
  model.bodyTemplate = JSON.stringify(template, null, 2)
  return model
}

/** Raw input values keyed by TryItField.id. Absent and "" mean untouched. */
export type TryItValues = Record<string, string>

/** Path parameter map for the adapter; only non-blank values are included. */
export function collectPathParams(model: TryItFormModel, values: TryItValues): Record<string, string> {
  const out: Record<string, string> = {}
  for (const field of model.pathFields) {
    const raw = (values[field.id] ?? '').trim()
    if (raw !== '') out[field.name] = raw
  }
  return out
}

/** Names of required path parameters the visitor has not filled in yet. */
export function missingPathParams(model: TryItFormModel, values: TryItValues): string[] {
  return model.pathFields
    .filter((field) => (values[field.id] ?? '').trim() === '')
    .map((field) => field.name)
}

/** Query map for the adapter; empty inputs are omitted (not sent). */
export function collectQueryParams(model: TryItFormModel, values: TryItValues): Record<string, string> {
  const out: Record<string, string> = {}
  for (const field of model.queryFields) {
    const raw = values[field.id] ?? ''
    if (raw !== '') out[field.name] = raw
  }
  return out
}

/**
 * Serializes field-mode body inputs to a JSON request body string.
 *
 * Rules: empty optional fields are omitted; empty REQUIRED fields are sent as
 * "" so the documented validation responses stay reachable from the form;
 * number/integer inputs become JSON numbers when parseable and are otherwise
 * sent as the raw string (the simulated deserializer then rejects them the
 * way the documented 422 does). Returns undefined when the operation has no
 * body.
 */
export function serializeFormBody(model: TryItFormModel, values: TryItValues): string | undefined {
  if (model.bodyMode === 'none') return undefined
  const body: Record<string, unknown> = {}
  for (const field of model.bodyFields) {
    const raw = values[field.id] ?? ''
    if (raw === '') {
      if (field.required) body[field.name] = ''
      continue
    }
    if (field.kind === 'number' || field.kind === 'integer') {
      const parsed = Number(raw)
      body[field.name] = Number.isNaN(parsed) ? raw : parsed
    } else {
      body[field.name] = raw
    }
  }
  return JSON.stringify(body, null, 2)
}

/** Request line preview, e.g. "GET /api/v1/accounts?limit=10". */
export function buildRequestPreview(
  operation: OperationView,
  model: TryItFormModel,
  values: TryItValues,
): string {
  let path = operation.path
  for (const [name, value] of Object.entries(collectPathParams(model, values))) {
    path = path.replace(`{${name}}`, encodeURIComponent(value))
  }
  const query = Object.entries(collectQueryParams(model, values))
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
    .join('&')
  return `${operation.method.toUpperCase()} ${path}${query ? `?${query}` : ''}`
}

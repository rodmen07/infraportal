/**
 * Pure, framework-free logic for turning a committed OpenAPI snapshot into
 * render-ready view models: local $ref resolution, operation extraction and
 * tag grouping, readable schema trees, auth resolution, and response views.
 *
 * Everything here throws SpecModelError on refs that do not resolve or on
 * constructs outside the scoped OpenAPI subset (see openapiTypes.ts). The
 * walk-every-operation test in specCatalog.test.ts runs this module over all
 * 11 committed specs, so unsupported input fails CI loudly instead of
 * rendering wrong.
 */

import {
  HTTP_METHODS,
  type HeaderObject,
  type HttpMethod,
  type MaybeRef,
  type MediaTypeObject,
  type OpenApiSpec,
  type OperationObject,
  type ParameterObject,
  type PathItemObject,
  type RefObject,
  type RequestBodyObject,
  type ResponseObject,
  type SchemaObject,
  type SecurityRequirement,
} from './openapiTypes'

export class SpecModelError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SpecModelError'
  }
}

export function isRef(value: unknown): value is RefObject {
  return (
    typeof value === 'object' &&
    value !== null &&
    '$ref' in value &&
    typeof (value as RefObject).$ref === 'string'
  )
}

const COMPONENT_SECTIONS = [
  'schemas',
  'responses',
  'parameters',
  'headers',
  'examples',
  'securitySchemes',
] as const

type ComponentSection = (typeof COMPONENT_SECTIONS)[number]

export interface ResolvedRef<T> {
  value: T
  refName: string
  section: ComponentSection
}

/**
 * Resolves a local component reference of the form
 * `#/components/<section>/<Name>`. External or non-component refs throw.
 */
export function resolveRef<T>(spec: OpenApiSpec, ref: string): ResolvedRef<T> {
  const match = /^#\/components\/([^/]+)\/([^/]+)$/.exec(ref)
  if (!match) {
    throw new SpecModelError(`unsupported $ref format: ${ref}`)
  }
  const section = match[1] as ComponentSection
  const name = match[2]
  if (!COMPONENT_SECTIONS.includes(section)) {
    throw new SpecModelError(`unsupported components section in $ref: ${ref}`)
  }
  const bucket = spec.components?.[section] as Record<string, T> | undefined
  const value = bucket?.[name]
  if (value === undefined) {
    throw new SpecModelError(`unresolved $ref: ${ref}`)
  }
  return { value, refName: name, section }
}

/** Returns the resolved value plus the ref name when the input was a $ref. */
export function deref<T>(spec: OpenApiSpec, value: MaybeRef<T>): { value: T; refName?: string } {
  if (isRef(value)) {
    const resolved = resolveRef<T>(spec, value.$ref)
    return { value: resolved.value, refName: resolved.refName }
  }
  return { value }
}

// ---------------------------------------------------------------------------
// Schema trees
// ---------------------------------------------------------------------------

export interface SchemaFieldView {
  name: string
  required: boolean
  node: SchemaNodeView
}

export interface SchemaNodeView {
  /** Component name when this node came from a $ref (e.g. "Account"). */
  refName?: string
  /** Readable type label, e.g. "string (uuid)", "array of Account", "object". */
  label: string
  description?: string
  nullable: boolean
  enumValues?: (string | number)[]
  /** Human-readable constraints, e.g. "default 50", "1 to 100", "max length 255". */
  constraints: string[]
  /** Object properties, when this node is an object with declared properties. */
  fields?: SchemaFieldView[]
  /** Array item node, when this node is an array. */
  items?: SchemaNodeView
  /** True when expansion stopped because the ref repeats along this branch. */
  cyclic?: boolean
}

const MAX_SCHEMA_DEPTH = 8

function schemaConstraints(schema: SchemaObject): string[] {
  const constraints: string[] = []
  if (schema.default !== undefined) constraints.push(`default ${JSON.stringify(schema.default)}`)
  if (schema.minimum !== undefined && schema.maximum !== undefined) {
    constraints.push(`${schema.minimum} to ${schema.maximum}`)
  } else {
    if (schema.minimum !== undefined) constraints.push(`min ${schema.minimum}`)
    if (schema.maximum !== undefined) constraints.push(`max ${schema.maximum}`)
  }
  if (schema.minLength !== undefined) constraints.push(`min length ${schema.minLength}`)
  if (schema.maxLength !== undefined) constraints.push(`max length ${schema.maxLength}`)
  if (schema.minItems !== undefined) constraints.push(`min items ${schema.minItems}`)
  if (schema.maxItems !== undefined) constraints.push(`max items ${schema.maxItems}`)
  if (schema.pattern !== undefined) constraints.push(`pattern ${schema.pattern}`)
  return constraints
}

function assertSupportedSchema(schema: SchemaObject, context: string): void {
  for (const combinator of ['allOf', 'oneOf', 'anyOf', 'not'] as const) {
    if (schema[combinator] !== undefined) {
      throw new SpecModelError(`unsupported schema combinator "${combinator}" at ${context}`)
    }
  }
}

/**
 * Builds a readable schema tree, resolving local $refs, guarding against
 * reference cycles, and refusing (loudly) constructs outside the scoped
 * subset.
 */
export function buildSchemaNode(
  spec: OpenApiSpec,
  schema: MaybeRef<SchemaObject>,
  context: string,
  seenRefs: ReadonlySet<string> = new Set(),
  depth = 0,
): SchemaNodeView {
  if (depth > MAX_SCHEMA_DEPTH) {
    throw new SpecModelError(`schema nesting deeper than ${MAX_SCHEMA_DEPTH} at ${context}`)
  }

  let refName: string | undefined
  let resolved: SchemaObject
  let nextSeen = seenRefs
  if (isRef(schema)) {
    const res = resolveRef<SchemaObject>(spec, schema.$ref)
    refName = res.refName
    resolved = res.value
    if (seenRefs.has(res.refName)) {
      return {
        refName: res.refName,
        label: res.refName,
        nullable: false,
        constraints: [],
        cyclic: true,
      }
    }
    nextSeen = new Set(seenRefs).add(res.refName)
  } else {
    resolved = schema
  }

  assertSupportedSchema(resolved, context)

  const nullable = resolved.nullable === true
  const constraints = schemaConstraints(resolved)
  const base: SchemaNodeView = {
    refName,
    label: '',
    description: resolved.description,
    nullable,
    constraints,
  }
  if (resolved.enum) base.enumValues = resolved.enum

  const type = resolved.type

  if (type === 'array') {
    if (!resolved.items) {
      throw new SpecModelError(`array schema without items at ${context}`)
    }
    const items = buildSchemaNode(spec, resolved.items, `${context}.items`, nextSeen, depth + 1)
    base.items = items
    base.label = `array of ${items.refName ?? items.label}`
    return base
  }

  if (type === 'object' || (type === undefined && resolved.properties)) {
    base.label = refName ?? 'object'
    if (resolved.properties) {
      const requiredNames = new Set(resolved.required ?? [])
      base.fields = Object.entries(resolved.properties).map(([name, prop]) => ({
        name,
        required: requiredNames.has(name),
        node: buildSchemaNode(spec, prop, `${context}.${name}`, nextSeen, depth + 1),
      }))
    }
    if (resolved.additionalProperties && typeof resolved.additionalProperties === 'object') {
      base.items = buildSchemaNode(
        spec,
        resolved.additionalProperties,
        `${context}.additionalProperties`,
        nextSeen,
        depth + 1,
      )
      base.label = `map of ${base.items.refName ?? base.items.label}`
    }
    return base
  }

  if (type === undefined) {
    // Free-form value (e.g. the ApiError "details" field).
    base.label = 'any'
    return base
  }

  base.label = resolved.format ? `${type} (${resolved.format})` : type
  if (resolved.enum) base.label = `${type} enum`
  return base
}

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

export interface ParameterView {
  name: string
  location: ParameterObject['in']
  required: boolean
  description?: string
  schema?: SchemaNodeView
}

export interface MediaTypeView {
  mediaType: string
  schema?: SchemaNodeView
  /** Example payloads pulled from `example` or named `examples`. */
  examples: { label?: string; value: unknown }[]
}

export interface RequestBodyView {
  required: boolean
  description?: string
  content: MediaTypeView[]
}

export interface ResponseView {
  status: string
  description: string
  headerNames: string[]
  content: MediaTypeView[]
  /** True when the response body is the platform ApiError envelope. */
  isErrorEnvelope: boolean
}

export interface AuthView {
  required: boolean
  label: string
}

export interface OperationView {
  operationId: string
  method: HttpMethod
  path: string
  summary?: string
  description?: string
  tags: string[]
  auth: AuthView
  parameters: ParameterView[]
  requestBody?: RequestBodyView
  responses: ResponseView[]
}

const ERROR_ENVELOPE_REF = 'ApiError'

function buildMediaTypeViews(
  spec: OpenApiSpec,
  content: Record<string, MediaTypeObject> | undefined,
  context: string,
): MediaTypeView[] {
  if (!content) return []
  return Object.entries(content).map(([mediaType, media]) => {
    const examples: MediaTypeView['examples'] = []
    if (media.example !== undefined) {
      examples.push({ value: media.example })
    }
    if (media.examples) {
      for (const [name, exampleOrRef] of Object.entries(media.examples)) {
        const { value: example } = deref(spec, exampleOrRef)
        examples.push({ label: example.summary ?? name, value: example.value })
      }
    }
    return {
      mediaType,
      schema: media.schema
        ? buildSchemaNode(spec, media.schema, `${context}[${mediaType}]`)
        : undefined,
      examples,
    }
  })
}

export function resolveAuth(spec: OpenApiSpec, operation: OperationObject): AuthView {
  const requirements: SecurityRequirement[] = operation.security ?? spec.security ?? []
  if (requirements.length === 0 || requirements.every((req) => Object.keys(req).length === 0)) {
    return { required: false, label: 'None (public)' }
  }
  const labels = requirements.flatMap((req) =>
    Object.keys(req).map((schemeName) => {
      const scheme = spec.components?.securitySchemes?.[schemeName]
      if (!scheme) {
        throw new SpecModelError(`security requirement references unknown scheme "${schemeName}"`)
      }
      if (scheme.type === 'http' && scheme.scheme === 'bearer') {
        return scheme.bearerFormat ? `Bearer ${scheme.bearerFormat}` : 'Bearer token'
      }
      return `${scheme.type}${scheme.scheme ? ` (${scheme.scheme})` : ''}`
    }),
  )
  return { required: true, label: labels.join(' or ') }
}

function buildParameterViews(
  spec: OpenApiSpec,
  pathItem: PathItemObject,
  operation: OperationObject,
  context: string,
): ParameterView[] {
  const merged: MaybeRef<ParameterObject>[] = [
    ...(pathItem.parameters ?? []),
    ...(operation.parameters ?? []),
  ]
  return merged.map((paramOrRef) => {
    const { value: param } = deref(spec, paramOrRef)
    return {
      name: param.name,
      location: param.in,
      required: param.required ?? param.in === 'path',
      description: param.description,
      schema: param.schema
        ? buildSchemaNode(spec, param.schema, `${context}.param(${param.name})`)
        : undefined,
    }
  })
}

function compareStatus(a: string, b: string): number {
  return a.localeCompare(b, 'en')
}

function buildResponseViews(
  spec: OpenApiSpec,
  operation: OperationObject,
  context: string,
): ResponseView[] {
  return Object.entries(operation.responses)
    .sort(([a], [b]) => compareStatus(a, b))
    .map(([status, responseOrRef]) => {
      const { value: response } = deref<ResponseObject>(spec, responseOrRef)
      const content = buildMediaTypeViews(spec, response.content, `${context}.${status}`)
      const isErrorEnvelope = content.some((media) => media.schema?.refName === ERROR_ENVELOPE_REF)
      return {
        status,
        description: response.description,
        headerNames: Object.keys(response.headers ?? {}).map((name) => {
          // Resolve header refs so unresolved ones fail loudly in the walk test.
          const headerOrRef = (response.headers ?? {})[name]
          deref<HeaderObject>(spec, headerOrRef)
          return name
        }),
        content,
        isErrorEnvelope,
      }
    })
}

export function buildOperationView(
  spec: OpenApiSpec,
  path: string,
  method: HttpMethod,
  pathItem: PathItemObject,
  operation: OperationObject,
): OperationView {
  const context = `${method.toUpperCase()} ${path}`
  if (!operation.operationId) {
    throw new SpecModelError(`operation without operationId at ${context}`)
  }
  let requestBody: RequestBodyView | undefined
  if (operation.requestBody) {
    const { value: body } = deref<RequestBodyObject>(spec, operation.requestBody)
    requestBody = {
      required: body.required ?? false,
      description: body.description,
      content: buildMediaTypeViews(spec, body.content, `${context}.requestBody`),
    }
  }
  return {
    operationId: operation.operationId,
    method,
    path,
    summary: operation.summary,
    description: operation.description,
    tags: operation.tags ?? [],
    auth: resolveAuth(spec, operation),
    parameters: buildParameterViews(spec, pathItem, operation, context),
    requestBody,
    responses: buildResponseViews(spec, operation, context),
  }
}

/** Extracts every operation in the spec, in path-declaration order. */
export function extractOperations(spec: OpenApiSpec): OperationView[] {
  const operations: OperationView[] = []
  for (const [path, pathItem] of Object.entries(spec.paths)) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method]
      if (operation) {
        operations.push(buildOperationView(spec, path, method, pathItem, operation))
      }
    }
  }
  return operations
}

export function countOperations(spec: OpenApiSpec): number {
  let count = 0
  for (const pathItem of Object.values(spec.paths)) {
    for (const method of HTTP_METHODS) {
      if (pathItem[method]) count += 1
    }
  }
  return count
}

// ---------------------------------------------------------------------------
// Tag grouping
// ---------------------------------------------------------------------------

export interface TagGroupView {
  tag: string
  description?: string
  operations: OperationView[]
}

/**
 * Groups operations by their first tag, ordered by the spec's tag declaration
 * order; tags used by operations but not declared at the top level follow
 * alphabetically, and untagged operations land in a trailing "Other" group.
 */
export function groupOperationsByTag(spec: OpenApiSpec, operations: OperationView[]): TagGroupView[] {
  const declaredTags = spec.tags ?? []
  const groups = new Map<string, TagGroupView>()

  for (const tag of declaredTags) {
    groups.set(tag.name, { tag: tag.name, description: tag.description, operations: [] })
  }

  const undeclared: string[] = []
  for (const operation of operations) {
    const tagName = operation.tags[0] ?? 'Other'
    if (!groups.has(tagName)) {
      groups.set(tagName, { tag: tagName, operations: [] })
      undeclared.push(tagName)
    }
    groups.get(tagName)!.operations.push(operation)
  }

  const declaredOrder = declaredTags.map((tag) => tag.name)
  const orderedNames = [
    ...declaredOrder,
    ...undeclared.filter((name) => name !== 'Other').sort((a, b) => a.localeCompare(b, 'en')),
    ...(groups.has('Other') ? ['Other'] : []),
  ]

  return orderedNames
    .map((name) => groups.get(name)!)
    .filter((group) => group.operations.length > 0)
}

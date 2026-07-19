/**
 * Minimal OpenAPI 3.0 types, deliberately scoped to what the 11 committed
 * service specs actually use (see src/api-specs/). This is not a general
 * OpenAPI model: combinators (allOf/oneOf/anyOf/not), external refs,
 * callbacks, and links are unsupported on purpose, and the spec model throws
 * loudly when it meets anything outside this shape so the walk-every-operation
 * test fails instead of rendering wrong.
 */

export interface RefObject {
  $ref: string
}

export type MaybeRef<T> = T | RefObject

export interface TagObject {
  name: string
  description?: string
}

export interface ServerObject {
  url: string
  description?: string
}

/** Map of security scheme name to required scopes (always empty here). */
export type SecurityRequirement = Record<string, string[]>

export interface SecuritySchemeObject {
  type: string
  scheme?: string
  bearerFormat?: string
  description?: string
}

export interface SchemaObject {
  type?: string
  format?: string
  description?: string
  enum?: (string | number)[]
  items?: MaybeRef<SchemaObject>
  properties?: Record<string, MaybeRef<SchemaObject>>
  additionalProperties?: MaybeRef<SchemaObject> | boolean
  required?: string[]
  nullable?: boolean
  default?: unknown
  example?: unknown
  minimum?: number
  maximum?: number
  minLength?: number
  maxLength?: number
  minItems?: number
  maxItems?: number
  pattern?: string
  // Unsupported combinators; present in the type only so the model can
  // detect and reject them explicitly.
  allOf?: unknown
  oneOf?: unknown
  anyOf?: unknown
  not?: unknown
}

export interface ExampleObject {
  summary?: string
  description?: string
  value?: unknown
}

export interface MediaTypeObject {
  schema?: MaybeRef<SchemaObject>
  example?: unknown
  examples?: Record<string, MaybeRef<ExampleObject>>
}

export interface HeaderObject {
  description?: string
  schema?: MaybeRef<SchemaObject>
  example?: unknown
}

export interface ParameterObject {
  name: string
  in: 'query' | 'path' | 'header' | 'cookie'
  description?: string
  required?: boolean
  schema?: MaybeRef<SchemaObject>
  example?: unknown
}

export interface RequestBodyObject {
  description?: string
  required?: boolean
  content: Record<string, MediaTypeObject>
}

export interface ResponseObject {
  description: string
  headers?: Record<string, MaybeRef<HeaderObject>>
  content?: Record<string, MediaTypeObject>
}

export interface OperationObject {
  tags?: string[]
  summary?: string
  description?: string
  operationId?: string
  parameters?: MaybeRef<ParameterObject>[]
  requestBody?: MaybeRef<RequestBodyObject>
  responses: Record<string, MaybeRef<ResponseObject>>
  security?: SecurityRequirement[]
}

export const HTTP_METHODS = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'] as const

export type HttpMethod = (typeof HTTP_METHODS)[number]

export type PathItemObject = {
  [M in HttpMethod]?: OperationObject
} & {
  parameters?: MaybeRef<ParameterObject>[]
}

export interface ComponentsObject {
  securitySchemes?: Record<string, SecuritySchemeObject>
  schemas?: Record<string, SchemaObject>
  responses?: Record<string, ResponseObject>
  parameters?: Record<string, ParameterObject>
  headers?: Record<string, HeaderObject>
  examples?: Record<string, ExampleObject>
}

export interface OpenApiSpec {
  openapi: string
  info: {
    title: string
    version: string
    description?: string
  }
  externalDocs?: { description?: string; url: string }
  servers?: ServerObject[]
  tags?: TagObject[]
  security?: SecurityRequirement[]
  paths: Record<string, PathItemObject>
  components?: ComponentsObject
}

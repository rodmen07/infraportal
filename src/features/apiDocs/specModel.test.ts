import { describe, expect, it } from 'vitest'
import type { OpenApiSpec } from './openapiTypes'
import {
  SpecModelError,
  buildSchemaNode,
  countOperations,
  deref,
  extractOperations,
  groupOperationsByTag,
  isRef,
  resolveAuth,
  resolveRef,
} from './specModel'

function fixtureSpec(): OpenApiSpec {
  return {
    openapi: '3.0.3',
    info: { title: 'fixture API', version: '1.0.0' },
    tags: [
      { name: 'Health', description: 'Probes' },
      { name: 'Widgets', description: 'Widget CRUD' },
    ],
    security: [{ bearerAuth: [] }],
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Liveness probe',
          operationId: 'healthCheck',
          security: [],
          responses: {
            '200': { description: 'OK' },
          },
        },
      },
      '/api/v1/widgets': {
        get: {
          tags: ['Widgets'],
          summary: 'List widgets',
          operationId: 'listWidgets',
          parameters: [
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
            },
          ],
          responses: {
            '401': { $ref: '#/components/responses/Unauthorized' },
            '200': {
              description: 'Widget list',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/WidgetList' },
                },
              },
            },
          },
        },
        post: {
          tags: ['Widgets'],
          summary: 'Create a widget',
          operationId: 'createWidget',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Widget' },
              },
            },
          },
          responses: {
            '400': {
              description: 'Validation failure',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/ApiError' },
                },
              },
            },
            '201': { description: 'Created' },
          },
        },
      },
      '/api/v1/widgets/{id}': {
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        get: {
          summary: 'Get a widget (untagged)',
          operationId: 'getWidget',
          responses: {
            '200': { description: 'The widget' },
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      },
      schemas: {
        Widget: {
          type: 'object',
          required: ['id', 'name'],
          properties: {
            id: { type: 'string', format: 'uuid' },
            name: { type: 'string', maxLength: 255, description: 'Display name' },
            status: { type: 'string', enum: ['active', 'inactive'], nullable: true },
            parent: { $ref: '#/components/schemas/Widget' },
          },
        },
        WidgetList: {
          type: 'object',
          required: ['data'],
          properties: {
            data: { type: 'array', items: { $ref: '#/components/schemas/Widget' } },
          },
        },
        ApiError: {
          type: 'object',
          required: ['code', 'message'],
          properties: {
            code: { type: 'string' },
            message: { type: 'string' },
            details: { description: 'Optional context' },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'Missing or invalid token',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ApiError' },
            },
          },
        },
      },
    },
  }
}

describe('isRef', () => {
  it('detects ref objects and rejects non-refs', () => {
    expect(isRef({ $ref: '#/components/schemas/Widget' })).toBe(true)
    expect(isRef({ type: 'string' })).toBe(false)
    expect(isRef(null)).toBe(false)
    expect(isRef('#/components/schemas/Widget')).toBe(false)
  })
})

describe('resolveRef', () => {
  it('resolves local component refs with section and name', () => {
    const spec = fixtureSpec()
    const resolved = resolveRef(spec, '#/components/schemas/Widget')
    expect(resolved.refName).toBe('Widget')
    expect(resolved.section).toBe('schemas')
    expect(resolved.value).toBe(spec.components?.schemas?.Widget)
  })

  it('throws on unknown refs', () => {
    expect(() => resolveRef(fixtureSpec(), '#/components/schemas/Missing')).toThrow(SpecModelError)
  })

  it('throws on external or non-component refs', () => {
    expect(() => resolveRef(fixtureSpec(), 'other.yaml#/components/schemas/Widget')).toThrow(
      SpecModelError,
    )
    expect(() => resolveRef(fixtureSpec(), '#/paths/~1health/get')).toThrow(SpecModelError)
    expect(() => resolveRef(fixtureSpec(), '#/components/links/Broken')).toThrow(SpecModelError)
  })
})

describe('deref', () => {
  it('passes plain values through without a refName', () => {
    const { value, refName } = deref(fixtureSpec(), { type: 'string' })
    expect(value).toEqual({ type: 'string' })
    expect(refName).toBeUndefined()
  })

  it('resolves refs and reports the refName', () => {
    const { refName } = deref(fixtureSpec(), { $ref: '#/components/schemas/ApiError' })
    expect(refName).toBe('ApiError')
  })
})

describe('buildSchemaNode', () => {
  it('labels primitives with their format', () => {
    const node = buildSchemaNode(fixtureSpec(), { type: 'string', format: 'uuid' }, 'test')
    expect(node.label).toBe('string (uuid)')
  })

  it('captures enums, nullability, and constraints', () => {
    const spec = fixtureSpec()
    const widget = buildSchemaNode(spec, { $ref: '#/components/schemas/Widget' }, 'test')
    expect(widget.refName).toBe('Widget')
    const fields = Object.fromEntries((widget.fields ?? []).map((field) => [field.name, field]))
    expect(fields.id.required).toBe(true)
    expect(fields.name.node.constraints).toContain('max length 255')
    expect(fields.status.node.enumValues).toEqual(['active', 'inactive'])
    expect(fields.status.node.nullable).toBe(true)
    expect(fields.status.required).toBe(false)
  })

  it('renders integer range and default constraints', () => {
    const node = buildSchemaNode(
      fixtureSpec(),
      { type: 'integer', minimum: 1, maximum: 100, default: 50 },
      'test',
    )
    expect(node.constraints).toContain('default 50')
    expect(node.constraints).toContain('1 to 100')
  })

  it('labels arrays by their item ref name', () => {
    const node = buildSchemaNode(fixtureSpec(), { $ref: '#/components/schemas/WidgetList' }, 'test')
    const data = node.fields?.find((field) => field.name === 'data')
    expect(data?.node.label).toBe('array of Widget')
    expect(data?.node.items?.refName).toBe('Widget')
  })

  it('stops on reference cycles instead of recursing forever', () => {
    const node = buildSchemaNode(fixtureSpec(), { $ref: '#/components/schemas/Widget' }, 'test')
    const parent = node.fields?.find((field) => field.name === 'parent')
    expect(parent?.node.cyclic).toBe(true)
    expect(parent?.node.refName).toBe('Widget')
  })

  it('treats schemas without a type as free-form values', () => {
    const node = buildSchemaNode(fixtureSpec(), { description: 'anything' }, 'test')
    expect(node.label).toBe('any')
  })

  it('throws on unsupported combinators', () => {
    expect(() =>
      buildSchemaNode(fixtureSpec(), { oneOf: [{ type: 'string' }] }, 'test'),
    ).toThrow(SpecModelError)
  })

  it('throws on array schemas without items', () => {
    expect(() => buildSchemaNode(fixtureSpec(), { type: 'array' }, 'test')).toThrow(SpecModelError)
  })
})

describe('resolveAuth', () => {
  it('inherits root security as a bearer requirement', () => {
    const spec = fixtureSpec()
    const operation = spec.paths['/api/v1/widgets'].get!
    expect(resolveAuth(spec, operation)).toEqual({ required: true, label: 'Bearer JWT' })
  })

  it('treats an empty security override as public', () => {
    const spec = fixtureSpec()
    const operation = spec.paths['/health'].get!
    expect(resolveAuth(spec, operation)).toEqual({ required: false, label: 'None (public)' })
  })

  it('throws when a requirement names an unknown scheme', () => {
    const spec = fixtureSpec()
    const operation = { ...spec.paths['/health'].get!, security: [{ ghost: [] }] }
    expect(() => resolveAuth(spec, operation)).toThrow(SpecModelError)
  })
})

describe('extractOperations', () => {
  it('extracts every operation with method, path, and view models', () => {
    const spec = fixtureSpec()
    const operations = extractOperations(spec)
    expect(operations.map((op) => op.operationId).sort()).toEqual([
      'createWidget',
      'getWidget',
      'healthCheck',
      'listWidgets',
    ])
    expect(countOperations(spec)).toBe(operations.length)
  })

  it('merges path-level parameters into the operation', () => {
    const spec = fixtureSpec()
    const getWidget = extractOperations(spec).find((op) => op.operationId === 'getWidget')!
    expect(getWidget.parameters).toHaveLength(1)
    expect(getWidget.parameters[0].name).toBe('id')
    expect(getWidget.parameters[0].location).toBe('path')
    expect(getWidget.parameters[0].required).toBe(true)
    expect(getWidget.parameters[0].schema?.label).toBe('string (uuid)')
  })

  it('sorts responses by status and resolves response refs', () => {
    const spec = fixtureSpec()
    const listWidgets = extractOperations(spec).find((op) => op.operationId === 'listWidgets')!
    expect(listWidgets.responses.map((response) => response.status)).toEqual(['200', '401'])
    const unauthorized = listWidgets.responses.find((response) => response.status === '401')!
    expect(unauthorized.description).toBe('Missing or invalid token')
    expect(unauthorized.isErrorEnvelope).toBe(true)
  })

  it('flags ApiError envelope responses and leaves plain responses unflagged', () => {
    const spec = fixtureSpec()
    const createWidget = extractOperations(spec).find((op) => op.operationId === 'createWidget')!
    const badRequest = createWidget.responses.find((response) => response.status === '400')!
    const created = createWidget.responses.find((response) => response.status === '201')!
    expect(badRequest.isErrorEnvelope).toBe(true)
    expect(created.isErrorEnvelope).toBe(false)
    expect(createWidget.requestBody?.required).toBe(true)
    expect(createWidget.requestBody?.content[0].schema?.refName).toBe('Widget')
  })

  it('throws when an operation has no operationId', () => {
    const spec = fixtureSpec()
    delete spec.paths['/health'].get!.operationId
    expect(() => extractOperations(spec)).toThrow(SpecModelError)
  })
})

describe('groupOperationsByTag', () => {
  it('orders groups by declared tag order with untagged operations last', () => {
    const spec = fixtureSpec()
    const groups = groupOperationsByTag(spec, extractOperations(spec))
    expect(groups.map((group) => group.tag)).toEqual(['Health', 'Widgets', 'Other'])
    expect(groups[0].description).toBe('Probes')
    expect(groups[1].operations.map((op) => op.operationId)).toEqual([
      'listWidgets',
      'createWidget',
    ])
    expect(groups[2].operations.map((op) => op.operationId)).toEqual(['getWidget'])
  })

  it('covers every operation exactly once', () => {
    const spec = fixtureSpec()
    const operations = extractOperations(spec)
    const groups = groupOperationsByTag(spec, operations)
    const grouped = groups.flatMap((group) => group.operations.map((op) => op.operationId))
    expect(grouped.sort()).toEqual(operations.map((op) => op.operationId).sort())
  })

  it('drops declared tags that have no operations', () => {
    const spec = fixtureSpec()
    spec.tags = [...(spec.tags ?? []), { name: 'Unused' }]
    const groups = groupOperationsByTag(spec, extractOperations(spec))
    expect(groups.map((group) => group.tag)).not.toContain('Unused')
  })
})

/**
 * Snippet generation tests (v1.17.3): POSIX shell escaping, curl
 * method/path/header/body correctness, body-sourcing precedence, and SDK
 * snippet honesty. The final suites walk all 11 committed specs and pin the
 * SDK snippets against the SDK's real public surface.
 */

import { describe, expect, it } from 'vitest'
import { SERVICE_IDS, loadSpec } from '../../../api-specs'
import type { OperationView, ResponseView, SchemaNodeView } from '../specModel'
import { extractOperations } from '../specModel'
import { buildTryItForm } from '../tryIt/formModel'
import {
  AUTH_PLACEHOLDER,
  SDK_PACKAGE_NAME,
  buildCurlSnippet,
  buildSdkSnippet,
  resolveSnippetBody,
  shellSingleQuote,
} from './snippetModel'

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function scalar(label: string): SchemaNodeView {
  return { label, nullable: false, constraints: [] }
}

function okResponse(withBody = true): ResponseView {
  return {
    status: '200',
    description: 'OK',
    headerNames: [],
    content: withBody
      ? [{ mediaType: 'application/json', schema: scalar('object'), examples: [] }]
      : [],
    isErrorEnvelope: false,
  }
}

function makeOperation(partial: Partial<OperationView>): OperationView {
  return {
    operationId: 'testOp',
    method: 'get',
    path: '/api/v1/things',
    tags: [],
    auth: { required: true, label: 'Bearer JWT' },
    parameters: [],
    responses: [okResponse()],
    ...partial,
  }
}

/** POST operation with a flat scalar body (fields mode) and a spec example. */
function makeCreateOperation(example?: unknown): OperationView {
  const bodySchema: SchemaNodeView = {
    label: 'object',
    nullable: false,
    constraints: [],
    fields: [
      { name: 'name', required: true, node: scalar('string') },
      { name: 'limit', required: false, node: scalar('integer') },
    ],
  }
  return makeOperation({
    operationId: 'createThing',
    method: 'post',
    requestBody: {
      required: true,
      content: [
        {
          mediaType: 'application/json',
          schema: bodySchema,
          examples: example === undefined ? [] : [{ value: example }],
        },
      ],
    },
  })
}

// ---------------------------------------------------------------------------
// Shell escaping
// ---------------------------------------------------------------------------

describe('shellSingleQuote', () => {
  it('wraps plain text in single quotes', () => {
    expect(shellSingleQuote('hello')).toBe("'hello'")
  })

  it('escapes embedded single quotes with the close-escape-reopen idiom', () => {
    expect(shellSingleQuote("it's")).toBe("'it'\\''s'")
  })

  it('leaves double quotes, dollars, backslashes, and newlines literal', () => {
    const text = '{"name": "a$b\\c",\n "x": 1}'
    expect(shellSingleQuote(text)).toBe(`'${text}'`)
  })

  it('escapes every single quote, not just the first', () => {
    expect(shellSingleQuote("a'b'c")).toBe("'a'\\''b'\\''c'")
  })
})

// ---------------------------------------------------------------------------
// curl
// ---------------------------------------------------------------------------

describe('buildCurlSnippet', () => {
  const baseUrl = 'https://accounts-service-5gcrg4oiza-uc.a.run.app'

  it('omits -X for GET and quotes the full URL', () => {
    const operation = makeOperation({})
    const curl = buildCurlSnippet({ operation, model: buildTryItForm(operation), baseUrl })
    expect(curl.startsWith(`curl '${baseUrl}/api/v1/things'`)).toBe(true)
    expect(curl).not.toContain('-X GET')
  })

  it('uses -X with the uppercased method for non-GET verbs', () => {
    for (const [method, flag] of [
      ['post', '-X POST'],
      ['patch', '-X PATCH'],
      ['delete', '-X DELETE'],
      ['put', '-X PUT'],
    ] as const) {
      const operation = makeOperation({ method })
      const curl = buildCurlSnippet({ operation, model: buildTryItForm(operation) })
      expect(curl, method).toContain(flag)
    }
  })

  it('adds the bearer placeholder header only when the operation documents auth', () => {
    const authed = makeOperation({})
    const anon = makeOperation({ auth: { required: false, label: 'None (public)' } })
    const authedCurl = buildCurlSnippet({ operation: authed, model: buildTryItForm(authed) })
    const anonCurl = buildCurlSnippet({ operation: anon, model: buildTryItForm(anon) })
    expect(authedCurl).toContain(`-H 'Authorization: Bearer ${AUTH_PLACEHOLDER}'`)
    expect(anonCurl).not.toContain('Authorization')
  })

  it('sends no Content-Type and no -d when the operation has no request body', () => {
    const operation = makeOperation({})
    const curl = buildCurlSnippet({ operation, model: buildTryItForm(operation) })
    expect(curl).not.toContain('Content-Type')
    expect(curl).not.toContain('-d ')
  })

  it('keeps documented {param} placeholders and substitutes filled path params encoded', () => {
    const operation = makeOperation({
      operationId: 'getThing',
      path: '/api/v1/things/{id}',
      parameters: [{ name: 'id', location: 'path', required: true, schema: scalar('string') }],
    })
    const model = buildTryItForm(operation)
    const empty = buildCurlSnippet({ operation, model })
    expect(empty).toContain("'/api/v1/things/{id}'")
    const filled = buildCurlSnippet({
      operation,
      model,
      state: { values: { 'path.id': 'a b/c' }, jsonMode: false },
    })
    expect(filled).toContain("'/api/v1/things/a%20b%2Fc'")
  })

  it('includes only filled query parameters, URL encoded', () => {
    const operation = makeOperation({
      parameters: [
        { name: 'q', location: 'query', required: false, schema: scalar('string') },
        { name: 'limit', location: 'query', required: false, schema: scalar('integer') },
      ],
    })
    const model = buildTryItForm(operation)
    const empty = buildCurlSnippet({ operation, model })
    expect(empty).not.toContain('?')
    const filled = buildCurlSnippet({
      operation,
      model,
      state: { values: { 'query.q': 'a&b', 'query.limit': '' }, jsonMode: false },
    })
    expect(filled).toContain("'/api/v1/things?q=a%26b'")
    expect(filled).not.toContain('limit=')
  })

  it('joins the command, headers, and data with POSIX line continuations', () => {
    const operation = makeCreateOperation({ name: 'x' })
    const curl = buildCurlSnippet({ operation, model: buildTryItForm(operation) })
    // Each argument part continues the previous line with " \" + indent
    // (lines INSIDE the quoted JSON body are literal and not continued).
    expect(curl).toContain(" \\\n  -H 'Authorization: Bearer")
    expect(curl).toContain(" \\\n  -H 'Content-Type: application/json' \\\n  -d '")
  })
})

describe('curl body sourcing precedence', () => {
  it('uses the spec example when the form is untouched', () => {
    const operation = makeCreateOperation({ name: 'Globex', limit: 3 })
    const model = buildTryItForm(operation)
    const body = resolveSnippetBody(operation, model)
    expect(body).toBe(JSON.stringify({ name: 'Globex', limit: 3 }, null, 2))
  })

  it('prefers filled form fields over the example, keeping serialization rules', () => {
    const operation = makeCreateOperation({ name: 'Globex' })
    const model = buildTryItForm(operation)
    const body = resolveSnippetBody(operation, model, {
      values: { 'body.limit': '5' },
      jsonMode: false,
    })
    // Required-but-empty fields serialize as "" (matches the Try it panel);
    // filled integers become JSON numbers; the example is not used.
    expect(JSON.parse(body!)).toEqual({ name: '', limit: 5 })
  })

  it('prefers the JSON textarea over everything in JSON mode', () => {
    const operation = makeCreateOperation({ name: 'Globex' })
    const model = buildTryItForm(operation)
    const raw = '{\n  "name": "O\'Hara"\n}'
    const body = resolveSnippetBody(operation, model, {
      values: { 'body.name': 'ignored' },
      bodyText: raw,
      jsonMode: true,
    })
    expect(body).toBe(raw)
  })

  it('falls back to a schema skeleton when there is no example', () => {
    const operation = makeCreateOperation(undefined)
    const model = buildTryItForm(operation)
    const body = resolveSnippetBody(operation, model)
    expect(JSON.parse(body!)).toEqual({ name: '', limit: 0 })
  })

  it('returns undefined when the operation has no request body', () => {
    const operation = makeOperation({})
    expect(resolveSnippetBody(operation, buildTryItForm(operation))).toBeUndefined()
  })

  it('escapes bodies containing quotes and newlines for POSIX shells', () => {
    const operation = makeCreateOperation(undefined)
    const model = buildTryItForm(operation)
    const raw = '{\n  "note": "it\'s \\"quoted\\""\n}'
    const curl = buildCurlSnippet({
      operation,
      model,
      state: { values: {}, bodyText: raw, jsonMode: true },
    })
    // The -d argument is the raw body single-quoted, with each embedded
    // single quote turned into the '\'' idiom and everything else literal.
    expect(curl).toContain(`-d ${shellSingleQuote(raw)}`)
    expect(curl).toContain("it'\\''s")
    expect(curl).toContain('\\"quoted\\"')
  })
})

// ---------------------------------------------------------------------------
// SDK snippets against the pinned SDK surface
// ---------------------------------------------------------------------------

// Pinned public value exports of @rodmen07/infraportal-sdk, read from
// sdks/typescript-sdk/src/index.ts in the microservices repo (v1.16.3 SDK,
// pinned here for v1.17.3). If the SDK surface changes, update this list
// deliberately alongside the snippet templates.
const SDK_VALUE_EXPORTS = [
  'ApiError',
  'DEFAULT_RETRY_OPTIONS',
  'InfraPortalClient',
  'UNKNOWN_ERROR_CODE',
  'parseErrorEnvelope',
  'parseRateLimit',
  'parseRetryAfterSeconds',
  'AccountsApi',
]

// Pinned methods, from src/services/accounts.ts and src/core/client.ts.
const ACCOUNTS_API_METHODS = ['list', 'get', 'create', 'update', 'delete']
const CLIENT_METHODS = ['request', 'setToken']

function importedIdentifiers(snippet: string): string[] {
  const match = snippet.match(/^import \{ ([^}]+) \} from "([^"]+)";$/m)
  expect(match, `snippet has no import line:\n${snippet}`).not.toBeNull()
  expect(match![2]).toBe(SDK_PACKAGE_NAME)
  return match![1].split(',').map((name) => name.trim())
}

describe('buildSdkSnippet (accounts typed surface)', () => {
  async function accountsOperation(operationId: string): Promise<OperationView> {
    const operations = extractOperations(await loadSpec('accounts'))
    const operation = operations.find((op) => op.operationId === operationId)
    expect(operation, operationId).toBeDefined()
    return operation!
  }

  it('uses AccountsApi.list for listAccounts', async () => {
    const snippet = buildSdkSnippet({
      serviceId: 'accounts',
      operation: await accountsOperation('listAccounts'),
      baseUrl: 'https://accounts-service-5gcrg4oiza-uc.a.run.app',
    })
    expect(importedIdentifiers(snippet)).toEqual(['AccountsApi', 'InfraPortalClient'])
    expect(snippet).toContain('new AccountsApi(client)')
    expect(snippet).toContain('await accounts.list({ limit: 20 });')
    expect(snippet).toContain('token: "<your-jwt>"')
    expect(snippet).toContain('https://accounts-service-5gcrg4oiza-uc.a.run.app')
  })

  it('embeds the spec example body in createAccount', async () => {
    const snippet = buildSdkSnippet({
      serviceId: 'accounts',
      operation: await accountsOperation('createAccount'),
    })
    expect(snippet).toContain('await accounts.create({')
    expect(snippet).toContain('"name": "Globex Corporation"')
  })

  it('renders deleteAccount without a data destructure (204)', async () => {
    const snippet = buildSdkSnippet({
      serviceId: 'accounts',
      operation: await accountsOperation('deleteAccount'),
    })
    expect(snippet).toContain('await accounts.delete("<account-id>");')
    expect(snippet).not.toContain('const { data')
  })

  it('routes the public health probe through the generic client core without a token', async () => {
    const snippet = buildSdkSnippet({
      serviceId: 'accounts',
      operation: await accountsOperation('healthCheck'),
    })
    expect(importedIdentifiers(snippet)).toEqual(['InfraPortalClient'])
    expect(snippet).toContain('await client.request("GET", "/health")')
    expect(snippet).not.toContain('token:')
    expect(snippet).not.toContain('new AccountsApi')
  })
})

describe('buildSdkSnippet (services without typed modules)', () => {
  it('is honest about missing typed modules and uses the generic client core', async () => {
    const operations = extractOperations(await loadSpec('contacts'))
    const create = operations.find((op) => op.method === 'post' && op.path === '/api/v1/contacts')
    expect(create).toBeDefined()
    const snippet = buildSdkSnippet({ serviceId: 'contacts', operation: create! })
    expect(importedIdentifiers(snippet)).toEqual(['InfraPortalClient'])
    expect(snippet).toContain('typed service module so far is AccountsApi')
    expect(snippet).toContain('has not been written yet')
    expect(snippet).toContain('await client.request("POST", "/api/v1/contacts", {')
    expect(snippet).toContain('body:')
    expect(snippet).not.toContain('new AccountsApi')
  })

  it('rewrites path parameters into readable placeholders in the request call', async () => {
    const operations = extractOperations(await loadSpec('contacts'))
    const get = operations.find((op) => op.method === 'get' && op.path.includes('{id}'))
    expect(get).toBeDefined()
    const snippet = buildSdkSnippet({ serviceId: 'contacts', operation: get! })
    // The comment keeps the documented {id} path; the call gets a placeholder.
    expect(snippet).toContain(`client.request("GET", "${get!.path.replace('{id}', '<id>')}")`)
  })
})

// ---------------------------------------------------------------------------
// Walk every operation of every committed spec
// ---------------------------------------------------------------------------

describe('snippets across all committed specs', () => {
  it('builds a well-formed curl command for every operation', async () => {
    for (const serviceId of SERVICE_IDS) {
      const spec = await loadSpec(serviceId)
      const baseUrl = spec.servers?.[0]?.url
      expect(baseUrl, `${serviceId} spec must document a server`).toBeTruthy()
      for (const operation of extractOperations(spec)) {
        const context = `${serviceId}: ${operation.operationId}`
        const curl = buildCurlSnippet({ operation, model: buildTryItForm(operation), baseUrl })
        expect(curl.startsWith('curl'), context).toBe(true)
        expect(curl, context).toContain(`'${baseUrl}${operation.path.split('{')[0]}`)
        if (operation.auth.required) {
          expect(curl, context).toContain(AUTH_PLACEHOLDER)
        }
        if (operation.requestBody) {
          expect(curl, context).toContain('-d ')
          expect(curl, context).toContain("Content-Type: application/json")
        }
        // Balanced single quotes once the '\'' escape idiom is removed.
        const withoutEscapes = curl.split("'\\''").join('')
        expect(withoutEscapes.split("'").length % 2, context).toBe(1)
      }
    }
  })

  it('references only pinned SDK exports and methods in every SDK snippet', async () => {
    for (const serviceId of SERVICE_IDS) {
      const spec = await loadSpec(serviceId)
      const baseUrl = spec.servers?.[0]?.url
      for (const operation of extractOperations(spec)) {
        const context = `${serviceId}: ${operation.operationId}`
        const snippet = buildSdkSnippet({ serviceId, operation, baseUrl })
        for (const identifier of importedIdentifiers(snippet)) {
          expect(SDK_VALUE_EXPORTS, `${context} imports unknown export ${identifier}`).toContain(
            identifier,
          )
        }
        for (const [, method] of snippet.matchAll(/\baccounts\.(\w+)\(/g)) {
          expect(ACCOUNTS_API_METHODS, `${context} calls unknown AccountsApi.${method}`).toContain(
            method,
          )
        }
        for (const [, method] of snippet.matchAll(/\bclient\.(\w+)\(/g)) {
          expect(CLIENT_METHODS, `${context} calls unknown client.${method}`).toContain(method)
        }
        // Every snippet constructs the real client and labels the source build.
        expect(snippet, context).toContain('new InfraPortalClient({')
        expect(snippet, context).toContain('not yet published to npm')
      }
    }
  })

  it('gives every accounts CRUD operation typed AccountsApi code', async () => {
    const operations = extractOperations(await loadSpec('accounts'))
    for (const operation of operations) {
      const snippet = buildSdkSnippet({ serviceId: 'accounts', operation })
      if (operation.path.startsWith('/api/v1/accounts')) {
        expect(snippet, operation.operationId).toContain('new AccountsApi(client)')
      } else {
        expect(snippet, operation.operationId).not.toContain('new AccountsApi')
      }
    }
  })
})

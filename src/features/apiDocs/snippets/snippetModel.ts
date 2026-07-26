/**
 * Pure snippet generation for the per-operation "Snippets" section (v1.17.3).
 *
 * Two generators, both template-driven and unit tested (snippetModel.test.ts):
 *
 * - buildCurlSnippet: a copy-paste curl command with the documented method,
 *   the spec's first documented server URL, the bearer placeholder when the
 *   operation requires auth, and a JSON body escaped for POSIX shells. The
 *   body prefers the visitor's current Try it form values and falls back to
 *   the spec's example, then a schema-derived skeleton.
 * - buildSdkSnippet: real @rodmen07/infraportal-sdk code. Accounts CRUD
 *   operations use the typed AccountsApi surface; every other operation uses
 *   the client core's generic request() method (which is real SDK surface),
 *   with an honest note that the typed module for that service does not
 *   exist yet. The test suite pins the SDK's public exports and rejects any
 *   snippet that references something the SDK does not export.
 *
 * Honesty: this page never executes a snippet. It renders committed spec
 * snapshots and hands you copy-paste text. BASE_URL_NOTE says where the base
 * URL comes from and where to check what is actually serving; the UI shows it.
 * It deliberately asserts no runtime status of its own (see
 * src/features/site/runtimeStatusCopy.test.ts).
 * No React and no browser globals here.
 */

import type { OperationView } from '../specModel'
import {
  collectPathParams,
  collectQueryParams,
  schemaSkeleton,
  serializeFormBody,
  type TryItFormModel,
  type TryItValues,
} from '../tryIt/formModel'

export const AUTH_PLACEHOLDER = '<your-jwt>'

export const SDK_PACKAGE_NAME = '@rodmen07/infraportal-sdk'

export const SDK_SOURCE_NOTE =
  'Builds from source (sdks/typescript-sdk in the microservices repo); not yet published to npm.'

export const BASE_URL_NOTE =
  'These snippets document the API contract; this page never runs them. The base URL is the first server the spec documents, so run them from your own terminal against the environment you mean to call. For live per-service health, see the platform status board at #/status.'

export const POWERSHELL_NOTE =
  'The curl command is quoted for POSIX shells (bash, zsh, Git Bash, WSL). In PowerShell, plain "curl" aliases Invoke-WebRequest: call curl.exe instead, join the command onto one line (or replace the trailing backslashes with backticks), and note that a body containing single quotes needs PowerShell quoting rules, not the POSIX escaping shown here.'

// ---------------------------------------------------------------------------
// POSIX shell escaping
// ---------------------------------------------------------------------------

/**
 * Wraps text in single quotes for POSIX shells. Inside single quotes every
 * character is literal (newlines, double quotes, $, backslashes), so the only
 * escape needed is for the single quote itself: close, emit an escaped quote,
 * reopen (' -> '\'').
 */
export function shellSingleQuote(text: string): string {
  return `'${text.split("'").join(`'\\''`)}'`
}

// ---------------------------------------------------------------------------
// Request assembly shared with the Try it form state
// ---------------------------------------------------------------------------

/** Snapshot of the Try it panel's live form state. */
export interface SnippetFormState {
  /** Raw input values keyed by TryItField.id ("path.id", "body.name", ...). */
  values: TryItValues
  /** JSON textarea content, meaningful when jsonMode is true. */
  bodyText?: string
  /** True when the visitor edits the body as raw JSON. */
  jsonMode: boolean
}

const EMPTY_STATE: SnippetFormState = { values: {}, jsonMode: false }

/**
 * Operation path with filled-in path parameters substituted (URL encoded);
 * unfilled parameters keep their documented {name} placeholder.
 */
export function resolveSnippetPath(
  operation: OperationView,
  model: TryItFormModel,
  values: TryItValues,
): string {
  let path = operation.path
  for (const [name, value] of Object.entries(collectPathParams(model, values))) {
    path = path.replace(`{${name}}`, encodeURIComponent(value))
  }
  return path
}

function snippetQueryString(model: TryItFormModel, values: TryItValues): string {
  return Object.entries(collectQueryParams(model, values))
    .map(([name, value]) => `${encodeURIComponent(name)}=${encodeURIComponent(value)}`)
    .join('&')
}

/** The spec's example body value, else a schema-derived skeleton. */
function exampleBodyValue(operation: OperationView): unknown {
  const media = operation.requestBody?.content.find(
    (entry) => entry.mediaType === 'application/json',
  )
  if (!media) return {}
  const example = media.examples[0]?.value
  if (example !== undefined) return example
  if (media.schema) return schemaSkeleton(media.schema)
  return {}
}

function exampleBodyText(operation: OperationView, model: TryItFormModel): string {
  const media = operation.requestBody?.content.find(
    (entry) => entry.mediaType === 'application/json',
  )
  const example = media?.examples[0]?.value
  if (example !== undefined) return JSON.stringify(example, null, 2)
  if (model.bodyTemplate !== undefined) return model.bodyTemplate
  if (media?.schema) return JSON.stringify(schemaSkeleton(media.schema), null, 2)
  return '{}'
}

/**
 * JSON body for the snippet, or undefined when the operation has no request
 * body. Sourcing precedence (tested):
 * 1. In JSON mode, the visitor's textarea content when non-blank.
 * 2. In form mode, the serialized form fields once any body field is filled.
 * 3. The spec's example for the operation.
 * 4. A schema-derived skeleton.
 */
export function resolveSnippetBody(
  operation: OperationView,
  model: TryItFormModel,
  state: SnippetFormState = EMPTY_STATE,
): string | undefined {
  if (model.bodyMode === 'none') return undefined
  if (state.jsonMode || model.bodyMode === 'json') {
    if (state.bodyText !== undefined && state.bodyText.trim() !== '') {
      return state.bodyText
    }
  } else if (
    model.bodyFields.some((field) => (state.values[field.id] ?? '').trim() !== '')
  ) {
    return serializeFormBody(model, state.values) ?? exampleBodyText(operation, model)
  }
  return exampleBodyText(operation, model)
}

// ---------------------------------------------------------------------------
// curl
// ---------------------------------------------------------------------------

export interface CurlSnippetInput {
  operation: OperationView
  model: TryItFormModel
  /** First documented server URL from the spec. */
  baseUrl?: string
  /** Live Try it form state; omitted for docs-only rendering. */
  state?: SnippetFormState
}

/**
 * Builds the copyable curl command. GET omits -X (curl's default verb);
 * the Authorization header appears only when the operation documents auth;
 * Content-Type and -d appear only when a body resolves.
 */
export function buildCurlSnippet({ operation, model, baseUrl, state }: CurlSnippetInput): string {
  const values = state?.values ?? {}
  const path = resolveSnippetPath(operation, model, values)
  const query = snippetQueryString(model, values)
  const url = `${baseUrl ?? ''}${path}${query === '' ? '' : `?${query}`}`
  const method = operation.method.toUpperCase()

  const parts: string[] = [
    `curl${method === 'GET' ? '' : ` -X ${method}`} ${shellSingleQuote(url)}`,
  ]
  if (operation.auth.required) {
    parts.push(`-H ${shellSingleQuote(`Authorization: Bearer ${AUTH_PLACEHOLDER}`)}`)
  }
  const body = resolveSnippetBody(operation, model, state)
  if (body !== undefined) {
    parts.push(`-H ${shellSingleQuote('Content-Type: application/json')}`)
    parts.push(`-d ${shellSingleQuote(body)}`)
  }
  return parts.join(' \\\n  ')
}

// ---------------------------------------------------------------------------
// TypeScript SDK
// ---------------------------------------------------------------------------

export interface SdkSnippetInput {
  serviceId: string
  operation: OperationView
  /** First documented server URL from the spec. */
  baseUrl?: string
}

/** Renders a JSON value as a TypeScript literal (JSON is valid TS). */
function jsonLiteral(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? '{}'
}

/** Indents every line but the first, for embedding a literal in a call. */
function indentTail(text: string, indent: string): string {
  const lines = text.split('\n')
  return [lines[0], ...lines.slice(1).map((line) => indent + line)].join('\n')
}

function clientPreamble(input: SdkSnippetInput, imports: string[]): string[] {
  const lines = [
    `import { ${imports.join(', ')} } from "${SDK_PACKAGE_NAME}";`,
    `// ${SDK_SOURCE_NOTE}`,
    '',
    'const client = new InfraPortalClient({',
    `  baseUrl: "${input.baseUrl ?? '<base-url>'}", // first server documented in the spec`,
  ]
  if (input.operation.auth.required) {
    lines.push(`  token: "${AUTH_PLACEHOLDER}", // bearer JWT carrying the admin role`)
  }
  lines.push('});')
  return lines
}

/**
 * Typed calls for the accounts service, the one service with a typed SDK
 * module (sdks/typescript-sdk/src/services/accounts.ts). Method names here
 * are pinned against the real AccountsApi surface by the test suite.
 */
const ACCOUNTS_TYPED_CALLS: Record<string, (operation: OperationView) => string[]> = {
  listAccounts: () => [
    '// GET /api/v1/accounts (paginated; limit is clamped to 1..100 server-side)',
    'const { data, rateLimit } = await accounts.list({ limit: 20 });',
    'console.log(data.total, rateLimit.remaining);',
  ],
  getAccount: () => [
    '// GET /api/v1/accounts/{id}; throws ApiError NOT_FOUND (404) when absent',
    'const { data: account } = await accounts.get("<account-id>");',
  ],
  createAccount: (operation) => [
    '// POST /api/v1/accounts; returns 201 with the created account',
    `const { data: created } = await accounts.create(${jsonLiteral(exampleBodyValue(operation))});`,
  ],
  updateAccount: (operation) => [
    '// PATCH /api/v1/accounts/{id}; omitted fields keep their stored values',
    `const { data: updated } = await accounts.update("<account-id>", ${jsonLiteral(exampleBodyValue(operation))});`,
  ],
  deleteAccount: () => [
    '// DELETE /api/v1/accounts/{id}; resolves with no data on 204',
    'await accounts.delete("<account-id>");',
  ],
}

function genericCoverageNote(serviceId: string, operation: OperationView): string[] {
  if (serviceId === 'accounts') {
    return [
      '// The health probes are public and outside AccountsApi; call them',
      "// through the client core's generic request() method.",
    ]
  }
  return [
    `// The SDK's only typed service module so far is AccountsApi; a typed`,
    `// module for the ${serviceId} service has not been written yet.`,
    "// client.request() below is the SDK's real generic surface: it still",
    `// applies ${operation.auth.required ? 'bearer auth, ' : ''}the documented 429 retry contract and`,
    '// X-RateLimit-* header parsing.',
  ]
}

function genericRequestLines(operation: OperationView): string[] {
  const method = operation.method.toUpperCase()
  const pathLiteral = operation.path.replace(/\{([^}]+)\}/g, '<$1>')
  const hasBody = operation.requestBody !== undefined
  const has2xxBody = operation.responses.some(
    (response) => response.status.startsWith('2') && response.content.length > 0,
  )
  const prefix = has2xxBody ? 'const { data } = ' : ''
  const lines = [`// ${method} ${operation.path}${operation.summary ? `: ${operation.summary}` : ''}`]
  if (hasBody) {
    lines.push(
      `${prefix}await client.request(${JSON.stringify(method)}, ${JSON.stringify(pathLiteral)}, {`,
      `  body: ${indentTail(jsonLiteral(exampleBodyValue(operation)), '  ')},`,
      '});',
    )
  } else {
    lines.push(`${prefix}await client.request(${JSON.stringify(method)}, ${JSON.stringify(pathLiteral)});`)
  }
  if (has2xxBody) lines.push('console.log(data);')
  return lines
}

/**
 * Builds the TypeScript SDK snippet for one operation. Accounts CRUD
 * operations get real typed AccountsApi code; everything else gets the
 * generic client core call plus an honest coverage note.
 */
export function buildSdkSnippet(input: SdkSnippetInput): string {
  const { serviceId, operation } = input
  const typedCall = serviceId === 'accounts' ? ACCOUNTS_TYPED_CALLS[operation.operationId] : undefined
  if (typedCall) {
    return [
      ...clientPreamble(input, ['AccountsApi', 'InfraPortalClient']),
      'const accounts = new AccountsApi(client);',
      '',
      ...typedCall(operation),
    ].join('\n')
  }
  return [
    ...clientPreamble(input, ['InfraPortalClient']),
    '',
    ...genericCoverageNote(serviceId, operation),
    '',
    ...genericRequestLines(operation),
  ].join('\n')
}

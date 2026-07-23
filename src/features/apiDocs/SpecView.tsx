/**
 * Presentational components for rendering an OpenAPI snapshot's view models
 * (see specModel.ts). No browser globals, no context, no effects: everything
 * renders from props, expand/collapse uses native <details>, and the whole
 * tree is exercisable with react-dom/server in the node-env test suite
 * (renderSmoke assertions in specCatalog.test.ts). The one stateful child is
 * the v1.17.2 TryItPanel, rendered per operation only when a serviceId is
 * provided; it keeps local form state but still has no effects.
 */

import type { OpenApiSpec } from './openapiTypes'
import { CopyButton } from './CopyButton'
import { buildApiDocsLink } from './deepLink'
import { TryItPanel } from './tryIt/TryItPanel'
import type {
  MediaTypeView,
  OperationView,
  ParameterView,
  SchemaNodeView,
  TagGroupView,
} from './specModel'

const METHOD_STYLES: Record<string, string> = {
  get: 'border-emerald-500/40 bg-emerald-500/15 text-success-text',
  post: 'border-sky-500/40 bg-sky-500/15 text-info-text',
  put: 'border-violet-500/40 bg-violet-500/15 text-violet-300',
  patch: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
  delete: 'border-rose-500/40 bg-rose-500/15 text-danger-text',
}

const FALLBACK_METHOD_STYLE = 'border-zinc-500/40 bg-zinc-500/15 text-text-secondary'

export function MethodBadge({ method }: { method: string }) {
  return (
    <span
      className={`inline-block w-16 shrink-0 rounded-md border px-1.5 py-0.5 text-center font-mono text-scale-xs font-bold uppercase ${METHOD_STYLES[method] ?? FALLBACK_METHOD_STYLE}`}
    >
      {method}
    </span>
  )
}

function statusTone(status: string): string {
  if (status.startsWith('2')) return 'text-success-text'
  if (status.startsWith('4')) return 'text-amber-300'
  if (status.startsWith('5')) return 'text-danger-text'
  return 'text-text-secondary'
}

function ConstraintChips({ node }: { node: SchemaNodeView }) {
  const chips: string[] = [...node.constraints]
  if (node.nullable) chips.push('nullable')
  if (chips.length === 0) return null
  return (
    <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
      {chips.map((chip) => (
        <span
          key={chip}
          className="rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono text-scale-xs text-text-muted"
        >
          {chip}
        </span>
      ))}
    </span>
  )
}

function EnumChips({ values }: { values: (string | number)[] }) {
  return (
    <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
      {values.map((value) => (
        <span
          key={String(value)}
          className="rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 font-mono text-scale-xs text-amber-300"
        >
          {String(value)}
        </span>
      ))}
    </span>
  )
}

export function SchemaTree({ node, depth = 0 }: { node: SchemaNodeView; depth?: number }) {
  return (
    <div className={depth > 0 ? 'border-l border-zinc-700/40 pl-3' : ''}>
      <div className="text-xs leading-6">
        <span className="font-mono text-amber-300/90">{node.refName ?? node.label}</span>
        {node.refName && node.label !== node.refName && (
          <span className="ml-2 font-mono text-scale-xs text-text-subtle">{node.label}</span>
        )}
        {node.cyclic && (
          <span className="ml-2 rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono text-scale-xs text-text-muted">
            recursive reference
          </span>
        )}
        {node.enumValues && <EnumChips values={node.enumValues} />}
        <ConstraintChips node={node} />
      </div>
      {node.description && <p className="mt-0.5 text-scale-xs leading-4 text-text-subtle">{node.description}</p>}
      {node.fields && node.fields.length > 0 && (
        <ul className="mt-1.5 space-y-1.5">
          {node.fields.map((field) => (
            <li key={field.name} className="border-l border-zinc-700/40 pl-3">
              <div className="text-xs leading-5">
                <span className="font-mono font-semibold text-zinc-200">{field.name}</span>
                {field.required && (
                  <span className="ml-1.5 rounded bg-rose-500/15 px-1 py-0.5 text-scale-xs font-medium text-danger-text">
                    required
                  </span>
                )}
                <span className="ml-2 font-mono text-scale-xs text-amber-300/80">
                  {field.node.refName ?? field.node.label}
                </span>
                {field.node.enumValues && <EnumChips values={field.node.enumValues} />}
                <ConstraintChips node={field.node} />
              </div>
              {field.node.description && (
                <p className="mt-0.5 text-scale-xs leading-4 text-text-subtle">{field.node.description}</p>
              )}
              {(field.node.fields || field.node.items) && (
                <div className="mt-1">
                  <SchemaTree node={{ ...field.node, description: undefined }} depth={depth + 1} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {node.items && (
        <div className="mt-1.5 border-l border-zinc-700/40 pl-3">
          <div className="text-scale-xs font-semibold uppercase tracking-wider text-text-subtle">
            {node.label.startsWith('map of') ? 'values' : 'items'}
          </div>
          <SchemaTree node={node.items} depth={depth + 1} />
        </div>
      )}
    </div>
  )
}

export function ParametersTable({ parameters }: { parameters: ParameterView[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-700/40">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-zinc-700/40 bg-zinc-800/40 text-text-muted">
          <tr>
            <th className="px-3 py-2 font-medium">Name</th>
            <th className="px-3 py-2 font-medium">In</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {parameters.map((param) => (
            <tr key={`${param.location}:${param.name}`} className="border-b border-zinc-700/20 align-top last:border-b-0">
              <td className="px-3 py-2 font-mono text-zinc-200">
                {param.name}
                {param.required && (
                  <span className="ml-1.5 rounded bg-rose-500/15 px-1 py-0.5 text-scale-xs font-medium text-danger-text">
                    required
                  </span>
                )}
              </td>
              <td className="px-3 py-2 text-text-muted">{param.location}</td>
              <td className="px-3 py-2 font-mono text-amber-300/80">
                {param.schema ? (param.schema.refName ?? param.schema.label) : 'any'}
                {param.schema?.enumValues && <EnumChips values={param.schema.enumValues} />}
                {param.schema && <ConstraintChips node={param.schema} />}
              </td>
              <td className="px-3 py-2 leading-5 text-text-subtle">{param.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ExampleBlock({ label, value }: { label?: string; value: unknown }) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  return (
    <details className="mt-1.5">
      <summary className="cursor-pointer text-scale-xs text-text-subtle hover:text-text-secondary">
        Example{label ? `: ${label}` : ''}
      </summary>
      <pre className="code-surface mt-1 overflow-x-auto rounded-lg bg-zinc-900/70 p-3 font-mono text-scale-xs leading-4 text-text-secondary">
        {text}
      </pre>
    </details>
  )
}

export function MediaContentView({ media }: { media: MediaTypeView }) {
  return (
    <div className="mt-2 rounded-lg border border-zinc-700/30 bg-zinc-900/30 p-3">
      <div className="font-mono text-scale-xs uppercase tracking-wider text-text-subtle">{media.mediaType}</div>
      {media.schema && (
        <div className="mt-2">
          <SchemaTree node={media.schema} />
        </div>
      )}
      {media.examples.map((example, index) => (
        <ExampleBlock key={example.label ?? index} label={example.label} value={example.value} />
      ))}
    </div>
  )
}

export function OperationCard({
  operation,
  serviceId,
  baseUrl,
}: {
  operation: OperationView
  /** Enables the per-operation Try it panel; omit for docs-only rendering. */
  serviceId?: string
  /** First documented server URL from the spec, for snippets (v1.17.3). */
  baseUrl?: string
}) {
  return (
    <details
      data-op-card={operation.operationId}
      className="group rounded-xl border border-zinc-700/40 bg-zinc-900/40 open:border-amber-400/30"
    >
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
        <MethodBadge method={operation.method} />
        <code className="break-all font-mono text-xs text-zinc-200">{operation.path}</code>
        <span className="min-w-0 flex-1 text-xs text-text-subtle">{operation.summary}</span>
        <span className="text-zinc-600 transition-transform group-open:rotate-90">›</span>
      </summary>
      <div className="space-y-4 border-t border-zinc-700/30 p-4">
        <div className="flex flex-wrap items-center gap-2 text-scale-xs">
          <span className="font-mono text-text-subtle">{operation.operationId}</span>
          <span
            className={`rounded-md border px-2 py-0.5 font-medium ${
              operation.auth.required
                ? 'border-amber-500/30 bg-amber-500/10 text-amber-300'
                : 'border-emerald-500/30 bg-emerald-500/10 text-success-text'
            }`}
          >
            Auth: {operation.auth.label}
          </span>
          {serviceId && (
            <span className="ml-auto" data-copy-link={operation.operationId}>
              <CopyButton
                label="Copy link"
                copiedLabel="Link copied"
                text={() =>
                  buildApiDocsLink(
                    { service: serviceId, op: operation.operationId },
                    window.location.href,
                  )
                }
              />
            </span>
          )}
        </div>

        {operation.description && (
          <p className="whitespace-pre-line text-xs leading-5 text-text-muted">{operation.description.trim()}</p>
        )}

        {operation.parameters.length > 0 && (
          <div>
            <h5 className="mb-2 text-scale-xs font-semibold uppercase tracking-widest text-text-muted">Parameters</h5>
            <ParametersTable parameters={operation.parameters} />
          </div>
        )}

        {operation.requestBody && (
          <div>
            <h5 className="mb-1 text-scale-xs font-semibold uppercase tracking-widest text-text-muted">
              Request body
              {operation.requestBody.required && (
                <span className="ml-1.5 rounded bg-rose-500/15 px-1 py-0.5 text-scale-xs font-medium normal-case tracking-normal text-danger-text">
                  required
                </span>
              )}
            </h5>
            {operation.requestBody.description && (
              <p className="mb-1 text-scale-xs text-text-subtle">{operation.requestBody.description}</p>
            )}
            {operation.requestBody.content.map((media) => (
              <MediaContentView key={media.mediaType} media={media} />
            ))}
          </div>
        )}

        <div>
          <h5 className="mb-2 text-scale-xs font-semibold uppercase tracking-widest text-text-muted">Responses</h5>
          <ul className="space-y-2">
            {operation.responses.map((response) => (
              <li key={response.status} className="rounded-lg border border-zinc-700/30 p-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className={`font-mono font-bold ${statusTone(response.status)}`}>{response.status}</span>
                  <span className="flex-1 text-text-muted">{response.description.trim()}</span>
                  {response.isErrorEnvelope && (
                    <span className="rounded border border-rose-500/25 bg-rose-500/10 px-1.5 py-0.5 font-mono text-scale-xs text-danger-text">
                      ApiError envelope
                    </span>
                  )}
                </div>
                {response.headerNames.length > 0 && (
                  <p className="mt-1.5 font-mono text-scale-xs text-zinc-600">
                    Headers: {response.headerNames.join(', ')}
                  </p>
                )}
                {response.content.map((media) => (
                  <MediaContentView key={media.mediaType} media={media} />
                ))}
              </li>
            ))}
          </ul>
        </div>

        {serviceId && <TryItPanel serviceId={serviceId} operation={operation} baseUrl={baseUrl} />}
      </div>
    </details>
  )
}

export function TagGroupSection({
  group,
  serviceId,
  baseUrl,
}: {
  group: TagGroupView
  serviceId?: string
  baseUrl?: string
}) {
  return (
    <section className="space-y-2">
      <div>
        <h4 className="text-sm font-semibold text-text-primary">{group.tag}</h4>
        {group.description && <p className="mt-0.5 text-xs text-text-subtle">{group.description}</p>}
      </div>
      <div className="space-y-2">
        {group.operations.map((operation) => (
          <OperationCard
            key={operation.operationId}
            operation={operation}
            serviceId={serviceId}
            baseUrl={baseUrl}
          />
        ))}
      </div>
    </section>
  )
}

export function ServiceSpecView({
  spec,
  groups,
  serviceId,
}: {
  spec: OpenApiSpec
  groups: TagGroupView[]
  /** Enables the per-operation Try it panels; omit for docs-only rendering. */
  serviceId?: string
}) {
  // First documented server (the historical deployment) anchors the snippets.
  const baseUrl = spec.servers?.[0]?.url
  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-zinc-700/40 bg-zinc-900/40 p-4">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="text-base font-semibold text-text-primary">{spec.info.title}</h3>
          <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono text-scale-xs text-text-muted">
            v{spec.info.version}
          </span>
          <span className="rounded bg-zinc-800/80 px-1.5 py-0.5 font-mono text-scale-xs text-text-muted">
            OpenAPI {spec.openapi}
          </span>
        </div>
        {spec.info.description && (
          <details className="mt-2">
            <summary className="cursor-pointer text-xs text-amber-300/90 hover:text-amber-200">
              Service description and auth model
            </summary>
            <p className="mt-2 whitespace-pre-line text-xs leading-5 text-text-muted">
              {spec.info.description.trim()}
            </p>
          </details>
        )}
        {spec.servers && spec.servers.length > 0 && (
          <ul className="mt-3 space-y-1">
            {spec.servers.map((server) => (
              <li key={server.url} className="text-scale-xs text-text-subtle">
                <code className="font-mono text-text-muted">{server.url}</code>
                {server.description && <span className="ml-2">{server.description}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {groups.map((group) => (
        <TagGroupSection key={group.tag} group={group} serviceId={serviceId} baseUrl={baseUrl} />
      ))}
    </div>
  )
}

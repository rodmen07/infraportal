/**
 * Per-operation "Try it" panel (v1.17.2).
 *
 * Renders the form derived by formModel.ts and executes through the marked
 * demo boundary in src/lib/tryItAdapter.mock.ts. Operations without a demo
 * dataset render a disabled state with the adapter's honest reason instead of
 * a fake success. Stateful, but with no effects and no browser globals, so
 * the node-env render-smoke suite can exercise it via react-dom/server.
 *
 * Also hosts the v1.17.3 SnippetsSection (rendered as a sibling of the Try
 * it box) so the generated curl command can source the live form values.
 */

import { useMemo, useState } from 'react'
import { tryItAdapter, type SimulatedResponse } from '../../../lib/tryItAdapter.mock'
import type { OperationView } from '../specModel'
import { SnippetsSection } from '../snippets/SnippetsSection'
import {
  buildRequestPreview,
  buildTryItForm,
  collectPathParams,
  collectQueryParams,
  missingPathParams,
  serializeFormBody,
  type TryItField,
  type TryItValues,
} from './formModel'

const EXECUTABLE_NOTE =
  'Runs entirely in your browser against the labeled in-memory demo dataset; no network requests are made (the platform backend was decommissioned on 2026-06-04). The simulation treats you as an authenticated admin caller, so the documented 401/403 responses are not reachable here. Changes are shared with the admin demo tables and last until you reload the page.'

function statusTone(status: number): string {
  if (status < 300) return 'text-emerald-300'
  if (status < 500) return 'text-amber-300'
  return 'text-rose-300'
}

// v1.18.1 PR2: the shared, token-built `.field-input` recipe from
// src/styles/tokens.css owns fill, border, text, and placeholder in both
// themes; only the size and monospace treatment specific to an API field
// stays here.
const inputClass =
  'field-input px-2 py-1 font-mono text-[11px] focus:outline-none disabled:opacity-50'

function FieldInput({
  field,
  value,
  onChange,
  idHints,
}: {
  field: TryItField
  value: string
  onChange: (next: string) => void
  idHints?: string[]
}) {
  return (
    <label className="block">
      <span className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="font-mono font-semibold text-zinc-200">{field.name}</span>
        {field.required && (
          <span className="rounded bg-rose-500/15 px-1 py-0.5 text-[10px] font-medium text-rose-300">
            required
          </span>
        )}
        <span className="font-mono text-[10px] text-zinc-500">{field.kind}</span>
      </span>
      {field.kind === 'enum' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} mt-1`}>
          <option value="">{field.required ? '(select a value)' : '(omit)'}</option>
          {(field.enumValues ?? []).map((enumValue) => (
            <option key={String(enumValue)} value={String(enumValue)}>
              {String(enumValue)}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.kind === 'integer' || field.kind === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className={`${inputClass} mt-1`}
        />
      )}
      {idHints && idHints.length > 0 && (
        <span className="mt-1 flex flex-wrap items-center gap-1">
          <span className="text-[10px] text-zinc-600">demo ids:</span>
          {idHints.slice(0, 4).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => onChange(id)}
              className="rounded border border-zinc-700/50 bg-zinc-800/60 px-1.5 py-0.5 font-mono text-[10px] text-amber-300/90 hover:border-amber-400/40 hover:text-amber-200"
            >
              {id}
            </button>
          ))}
        </span>
      )}
    </label>
  )
}

function ResponseViewer({ response }: { response: SimulatedResponse }) {
  return (
    <div className="mt-3 rounded-lg border border-zinc-700/40 bg-zinc-950/50 p-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`font-mono font-bold ${statusTone(response.status)}`}>
          {response.status} {response.statusText}
        </span>
        <span className="rounded border border-amber-500/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-300">
          simulated
        </span>
      </div>
      {response.headers.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {response.headers.map((header) => (
            <li key={header.name} className="font-mono text-[10px] text-zinc-500">
              <span className="text-zinc-400">{header.name}:</span> {header.value}
              <span className="ml-1.5 rounded bg-zinc-800/80 px-1 py-px text-[9px] text-zinc-500">
                simulated
              </span>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-2">
        {response.body.kind === 'empty' ? (
          <p className="text-[11px] italic text-zinc-600">(no response body)</p>
        ) : (
          <pre className="max-h-72 overflow-auto rounded-md bg-zinc-900/80 p-2.5 font-mono text-[11px] leading-4 text-zinc-300">
            {response.body.kind === 'json'
              ? JSON.stringify(response.body.value, null, 2)
              : response.body.value}
          </pre>
        )}
      </div>
      {response.notes.length > 0 && (
        <ul className="mt-2 space-y-1">
          {response.notes.map((note) => (
            <li key={note} className="text-[10px] leading-4 text-amber-300/80">
              {note}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function TryItPanel({
  serviceId,
  operation,
  baseUrl,
}: {
  serviceId: string
  operation: OperationView
  /** First documented server URL from the spec, for the snippets (v1.17.3). */
  baseUrl?: string
}) {
  const support = tryItAdapter.support(serviceId, operation)
  const model = useMemo(() => buildTryItForm(operation), [operation])

  const [values, setValues] = useState<TryItValues>({})
  const [jsonMode, setJsonMode] = useState(model.bodyMode === 'json')
  const [bodyText, setBodyText] = useState<string>(model.bodyTemplate ?? '')
  const [formError, setFormError] = useState<string | null>(null)
  const [response, setResponse] = useState<SimulatedResponse | null>(null)

  const setValue = (id: string, next: string) =>
    setValues((previous) => ({ ...previous, [id]: next }))

  const switchToJson = () => {
    setBodyText(serializeFormBody(model, values) ?? model.bodyTemplate ?? '{}')
    setJsonMode(true)
  }

  const execute = () => {
    const missing = missingPathParams(model, values)
    if (missing.length > 0) {
      setFormError(`Fill in the required path parameter${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`)
      setResponse(null)
      return
    }
    setFormError(null)
    const requestBody =
      model.bodyMode === 'none' ? undefined : jsonMode ? bodyText : serializeFormBody(model, values)
    setResponse(
      tryItAdapter.execute(serviceId, operation, {
        pathParams: collectPathParams(model, values),
        query: collectQueryParams(model, values),
        bodyText: requestBody,
      }),
    )
  }

  return (
    <>
    <div
      data-tryit={operation.operationId}
      className="rounded-lg border border-amber-500/20 bg-zinc-900/50 p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h5 className="text-[10px] font-semibold uppercase tracking-widest text-zinc-300">Try it</h5>
        <span className="rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] text-emerald-300">
          in-browser demo
        </span>
      </div>

      {!support.executable ? (
        <div className="mt-2">
          <p className="text-[11px] leading-4 text-zinc-500">{support.reason}</p>
          <button
            type="button"
            disabled
            className="mt-2 cursor-not-allowed rounded-md border border-zinc-700/50 bg-zinc-800/40 px-3 py-1 text-xs font-medium text-zinc-600"
          >
            Execute
          </button>
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          <p className="text-[10px] leading-4 text-zinc-500">{EXECUTABLE_NOTE}</p>

          {model.pathFields.length > 0 && (
            <div className="space-y-2">
              <h6 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Path parameters
              </h6>
              {model.pathFields.map((field) => (
                <FieldInput
                  key={field.id}
                  field={field}
                  value={values[field.id] ?? ''}
                  onChange={(next) => setValue(field.id, next)}
                  idHints={tryItAdapter.idHints(serviceId, operation.operationId, field.name)}
                />
              ))}
            </div>
          )}

          {model.queryFields.length > 0 && (
            <div className="space-y-2">
              <h6 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Query parameters
              </h6>
              {model.queryFields.map((field) => (
                <FieldInput
                  key={field.id}
                  field={field}
                  value={values[field.id] ?? ''}
                  onChange={(next) => setValue(field.id, next)}
                />
              ))}
            </div>
          )}

          {model.bodyMode !== 'none' && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h6 className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  Request body
                  {model.bodyRequired && (
                    <span className="ml-1.5 rounded bg-rose-500/15 px-1 py-0.5 text-[10px] font-medium normal-case tracking-normal text-rose-300">
                      required
                    </span>
                  )}
                </h6>
                {model.bodyMode === 'fields' && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setJsonMode(false)}
                      className={`rounded border px-1.5 py-0.5 text-[10px] ${!jsonMode ? 'border-amber-400/50 bg-amber-500/15 text-amber-200' : 'border-zinc-700/50 text-zinc-500 hover:text-zinc-300'}`}
                    >
                      Form
                    </button>
                    <button
                      type="button"
                      onClick={switchToJson}
                      className={`rounded border px-1.5 py-0.5 text-[10px] ${jsonMode ? 'border-amber-400/50 bg-amber-500/15 text-amber-200' : 'border-zinc-700/50 text-zinc-500 hover:text-zinc-300'}`}
                    >
                      JSON
                    </button>
                  </div>
                )}
              </div>
              {jsonMode || model.bodyMode === 'json' ? (
                <textarea
                  value={bodyText}
                  onChange={(e) => setBodyText(e.target.value)}
                  rows={6}
                  spellCheck={false}
                  className={`${inputClass} resize-y`}
                />
              ) : (
                model.bodyFields.map((field) => (
                  <FieldInput
                    key={field.id}
                    field={field}
                    value={values[field.id] ?? ''}
                    onChange={(next) => setValue(field.id, next)}
                  />
                ))
              )}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={execute}
              className="rounded-md border border-amber-400/40 bg-gradient-to-r from-amber-500/25 to-orange-500/25 px-3 py-1 text-xs font-semibold text-amber-100 hover:from-amber-500/35 hover:to-orange-500/35"
            >
              Execute
            </button>
            <code className="break-all font-mono text-[10px] text-zinc-500">
              {buildRequestPreview(operation, model, values)}
            </code>
          </div>

          {formError && <p className="text-[11px] text-rose-300">{formError}</p>}
          {response && <ResponseViewer response={response} />}
        </div>
      )}
    </div>
    <SnippetsSection
      serviceId={serviceId}
      operation={operation}
      model={model}
      baseUrl={baseUrl}
      state={{ values, bodyText, jsonMode }}
    />
    </>
  )
}

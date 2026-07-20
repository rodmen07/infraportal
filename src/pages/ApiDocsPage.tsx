import { PageLayout } from './PageLayout'
import { SPEC_SERVICES, SPEC_MANIFEST, TOTAL_OPERATIONS } from '../api-specs'
import { ApiSpecExplorer } from '../features/apiDocs/ApiSpecExplorer'
import { EXECUTABLE_OPERATION_COUNT } from '../lib/tryItAdapter.mock'
import { DataTable, DataTableBody, DataTableHead, DataTableRow } from '../components/ui/DataTable'

const SPECS_REPO_URL = 'https://github.com/rodmen07/microservices'
const API_GUIDE_URL = `${SPECS_REPO_URL}/blob/main/docs/API.md`

// Platform tiers as documented in every committed spec and docs/RATE_LIMITING.md.
// Historically enforced by go-gateway; shown here as the documented contract.
const RATE_LIMITS = [
  { tier: 'Auth routes', limit: '5 rps', paths: '/api/auth/*' },
  { tier: 'Write operations', limit: '30 rps', paths: 'POST / PATCH / DELETE' },
  { tier: 'Read operations', limit: '60 rps', paths: 'GET' },
]

export function ApiDocsPage() {
  return (
    <PageLayout title="API Reference" subtitle="Every endpoint of the InfraPortal platform, rendered from its committed OpenAPI specs">
      <div className="space-y-8">
        {/* Header */}
        <div className="forge-panel surface-card-strong space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">The InfraPortal API</h2>
            <p className="mt-2 text-sm text-text-muted">
              {SPEC_SERVICES.length} services, {TOTAL_OPERATIONS} operations, documented as OpenAPI{' '}
              {SPEC_MANIFEST.openapiVersion} specs that live next to the code they describe. This page
              renders those specs entirely in your browser from snapshots committed into the site
              bundle: no network requests, no live backend. The platform itself ran on GCP Cloud Run
              and Fly.io and was deliberately decommissioned to zero infrastructure cost in June 2026;
              the specs, source, and CI remain public.
            </p>
            <p className="mt-2 text-sm text-text-muted">
              {EXECUTABLE_OPERATION_COUNT} of the {TOTAL_OPERATIONS} operations are executable right
              here through each operation's "Try it" panel, running against a labeled in-browser demo
              dataset (accounts, contacts, opportunities, and projects). The panels simulate the
              documented success, validation, and not-found responses from real demo state; operations
              without a demo dataset say so instead of faking a result.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={SPECS_REPO_URL} target="_blank" rel="noopener noreferrer" className="btn-accent">
              View Specs on GitHub
            </a>
            <a href={API_GUIDE_URL} target="_blank" rel="noopener noreferrer" className="btn-neutral">
              API Getting-Started Guide
            </a>
            <a href="#/case-studies/microservices-platform" className="btn-neutral">
              Read the Case Study
            </a>
          </div>
        </div>

        {/* Auth Callout */}
        <div className="forge-panel surface-card-strong border-l-4 border-accent-line p-5">
          <h3 className="text-sm font-semibold text-accent-text">Authentication Model</h3>
          <p className="mt-2 text-sm text-text-muted">
            Every operation below carries its documented auth requirement. Across all{' '}
            {SPEC_SERVICES.length} services, the <code className="rounded bg-surface-hover px-2 py-0.5 font-mono text-xs">/health</code>{' '}
            and <code className="rounded bg-surface-hover px-2 py-0.5 font-mono text-xs">/ready</code> probes are public;
            every <code className="rounded bg-surface-hover px-2 py-0.5 font-mono text-xs">/api/v1</code> route requires a
            bearer JWT issued by auth-service, validated in the handler.
          </p>
          <div className="mt-3 rounded-lg bg-surface-2 p-3 font-mono text-xs text-text-secondary">
            Authorization: Bearer &lt;jwt&gt;
          </div>
          <p className="mt-3 text-xs text-text-muted">
            Missing or invalid tokens receive 401 with the error envelope; valid tokens without the
            required role receive 403. Each service description below documents its exact role rules.
          </p>
        </div>

        {/* Spec Explorer */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-text-muted">
              Services ({SPEC_SERVICES.length})
            </h3>
            <p className="text-scale-xs text-text-muted">
              Select a service to browse its operations. Specs load on demand from the site bundle.
            </p>
          </div>
          <ApiSpecExplorer />
        </div>

        {/* Rate Limits */}
        <div className="forge-panel surface-card-strong p-5">
          <h3 className="mb-2 text-sm font-semibold text-text-primary">Rate Limiting</h3>
          <p className="mb-4 text-xs text-text-muted">
            Documented platform tiers, historically enforced per client IP at the go-gateway edge.
            Every proxied response carried these limits as headers.
          </p>
          <DataTable>
            <DataTableHead>
              <tr>
                <th className="px-3 py-2">Tier</th>
                <th className="px-3 py-2">Limit</th>
                <th className="px-3 py-2">Applies to</th>
              </tr>
            </DataTableHead>
            <DataTableBody>
              {RATE_LIMITS.map((row) => (
                <DataTableRow key={row.tier}>
                  <td className="px-3 py-2 text-text-primary">{row.tier}</td>
                  <td className="px-3 py-2 font-mono text-accent">{row.limit}</td>
                  <td className="px-3 py-2 text-text-muted">{row.paths}</td>
                </DataTableRow>
              ))}
            </DataTableBody>
          </DataTable>
          <p className="mt-3 text-xs text-text-muted">
            Rate-limited responses include <code className="rounded bg-surface-hover px-1 py-0.5 font-mono text-scale-xs">X-RateLimit-*</code>{' '}
            headers and, on 429, <code className="rounded bg-surface-hover px-1 py-0.5 font-mono text-scale-xs">Retry-After</code>.
            The exact headers appear on each operation's responses above.
          </p>
        </div>

        {/* Error Format */}
        <div className="forge-panel surface-card-strong p-5">
          <h3 className="mb-3 text-sm font-semibold text-text-primary">Error Envelope</h3>
          <p className="text-xs text-text-muted">
            Service-generated errors share one envelope (the <code className="rounded bg-surface-hover px-1 py-0.5 font-mono text-scale-xs">ApiError</code>{' '}
            schema in every spec); responses using it are tagged in the explorer above.
          </p>
          <div className="mt-3 rounded-lg bg-surface-2 p-3 font-mono text-xs text-text-secondary">
            <pre className="overflow-x-auto">{`{
  "code": "VALIDATION_ERROR",
  "message": "name must not be empty",
  "details": { "field": "name", "constraint": "must not be empty" }
}`}</pre>
          </div>
          <p className="mt-3 text-xs text-text-muted">
            Framework-generated rejections (malformed JSON, bad query types) are produced before the
            handler runs and return text/plain bodies; the specs document those per operation.
          </p>
        </div>

        {/* Support */}
        <div className="rounded-lg border border-border-soft bg-surface-1 p-4">
          <p className="text-xs text-text-muted">
            These snapshots are synced from the specs in the{' '}
            <a href={SPECS_REPO_URL} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-text">
              microservices repo
            </a>{' '}
            via <code className="rounded bg-surface-hover px-1 py-0.5 font-mono text-scale-xs">npm run sync-specs</code>.
            Questions? Start with{' '}
            <a href={API_GUIDE_URL} target="_blank" rel="noopener noreferrer" className="text-accent hover:text-accent-text">
              docs/API.md
            </a>{' '}
            or open an issue on GitHub.
          </p>
        </div>
      </div>
    </PageLayout>
  )
}

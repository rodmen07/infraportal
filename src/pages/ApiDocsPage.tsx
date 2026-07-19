import { PageLayout } from './PageLayout'
import { SPEC_SERVICES, SPEC_MANIFEST, TOTAL_OPERATIONS } from '../api-specs'
import { ApiSpecExplorer } from '../features/apiDocs/ApiSpecExplorer'

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
            <h2 className="text-lg font-semibold text-zinc-100">The InfraPortal API</h2>
            <p className="mt-2 text-sm text-zinc-400">
              {SPEC_SERVICES.length} services, {TOTAL_OPERATIONS} operations, documented as OpenAPI{' '}
              {SPEC_MANIFEST.openapiVersion} specs that live next to the code they describe. This page
              renders those specs entirely in your browser from snapshots committed into the site
              bundle: no network requests, no live backend. The platform itself ran on GCP Cloud Run
              and Fly.io and was deliberately decommissioned to zero infrastructure cost in June 2026;
              the specs, source, and CI remain public.
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
        <div className="forge-panel surface-card-strong border-l-4 border-amber-500/40 p-5">
          <h3 className="text-sm font-semibold text-amber-300">Authentication Model</h3>
          <p className="mt-2 text-sm text-zinc-400">
            Every operation below carries its documented auth requirement. Across all{' '}
            {SPEC_SERVICES.length} services, the <code className="rounded bg-zinc-800/60 px-2 py-0.5 font-mono text-xs">/health</code>{' '}
            and <code className="rounded bg-zinc-800/60 px-2 py-0.5 font-mono text-xs">/ready</code> probes are public;
            every <code className="rounded bg-zinc-800/60 px-2 py-0.5 font-mono text-xs">/api/v1</code> route requires a
            bearer JWT issued by auth-service, validated in the handler.
          </p>
          <div className="mt-3 rounded-lg bg-zinc-900/60 p-3 font-mono text-xs text-zinc-300">
            Authorization: Bearer &lt;jwt&gt;
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Missing or invalid tokens receive 401 with the error envelope; valid tokens without the
            required role receive 403. Each service description below documents its exact role rules.
          </p>
        </div>

        {/* Spec Explorer */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">
              Services ({SPEC_SERVICES.length})
            </h3>
            <p className="text-[11px] text-zinc-500">
              Select a service to browse its operations. Specs load on demand from the site bundle.
            </p>
          </div>
          <ApiSpecExplorer />
        </div>

        {/* Rate Limits */}
        <div className="forge-panel surface-card-strong p-5">
          <h3 className="mb-2 text-sm font-semibold text-zinc-200">Rate Limiting</h3>
          <p className="mb-4 text-xs text-zinc-500">
            Documented platform tiers, historically enforced per client IP at the go-gateway edge.
            Every proxied response carried these limits as headers.
          </p>
          <div className="overflow-x-auto rounded-lg border border-zinc-700/40">
            <table className="w-full text-sm">
              <thead className="border-b border-zinc-700/40 bg-zinc-800/40 text-left text-xs text-zinc-400">
                <tr>
                  <th className="px-3 py-2">Tier</th>
                  <th className="px-3 py-2">Limit</th>
                  <th className="px-3 py-2">Applies to</th>
                </tr>
              </thead>
              <tbody>
                {RATE_LIMITS.map((row) => (
                  <tr key={row.tier} className="border-b border-zinc-700/20 last:border-b-0 hover:bg-zinc-800/20">
                    <td className="px-3 py-2 text-zinc-200">{row.tier}</td>
                    <td className="px-3 py-2 font-mono text-amber-400">{row.limit}</td>
                    <td className="px-3 py-2 text-zinc-500">{row.paths}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Rate-limited responses include <code className="rounded bg-zinc-800/60 px-1 py-0.5 font-mono text-[10px]">X-RateLimit-*</code>{' '}
            headers and, on 429, <code className="rounded bg-zinc-800/60 px-1 py-0.5 font-mono text-[10px]">Retry-After</code>.
            The exact headers appear on each operation's responses above.
          </p>
        </div>

        {/* Error Format */}
        <div className="forge-panel surface-card-strong p-5">
          <h3 className="mb-3 text-sm font-semibold text-zinc-200">Error Envelope</h3>
          <p className="text-xs text-zinc-400">
            Service-generated errors share one envelope (the <code className="rounded bg-zinc-800/60 px-1 py-0.5 font-mono text-[10px]">ApiError</code>{' '}
            schema in every spec); responses using it are tagged in the explorer above.
          </p>
          <div className="mt-3 rounded-lg bg-zinc-900/60 p-3 font-mono text-xs text-zinc-300">
            <pre className="overflow-x-auto">{`{
  "code": "VALIDATION_ERROR",
  "message": "name must not be empty",
  "details": { "field": "name", "constraint": "must not be empty" }
}`}</pre>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Framework-generated rejections (malformed JSON, bad query types) are produced before the
            handler runs and return text/plain bodies; the specs document those per operation.
          </p>
        </div>

        {/* Support */}
        <div className="rounded-lg border border-zinc-700/40 bg-zinc-900/20 p-4">
          <p className="text-xs text-zinc-400">
            These snapshots are synced from the specs in the{' '}
            <a href={SPECS_REPO_URL} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300">
              microservices repo
            </a>{' '}
            via <code className="rounded bg-zinc-800/60 px-1 py-0.5 font-mono text-[10px]">npm run sync-specs</code>.
            Questions? Start with{' '}
            <a href={API_GUIDE_URL} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300">
              docs/API.md
            </a>{' '}
            or open an issue on GitHub.
          </p>
        </div>
      </div>
    </PageLayout>
  )
}

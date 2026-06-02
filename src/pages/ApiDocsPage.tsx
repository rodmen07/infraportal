import { PageLayout } from './PageLayout'
import { GATEWAY_URL } from '../config'

const SERVICES = [
  { name: 'Accounts', tag: 'accounts', endpoints: 5, description: 'Account lifecycle management' },
  { name: 'Contacts', tag: 'contacts', endpoints: 5, description: 'Contact directory and lead tracking' },
  { name: 'Activities', tag: 'activities', endpoints: 5, description: 'Calls, emails, meetings, tasks' },
  { name: 'Opportunities', tag: 'opportunities', endpoints: 5, description: 'Sales pipeline and stages' },
  { name: 'Automation', tag: 'automation', endpoints: 4, description: 'Workflow rules and triggers' },
  { name: 'Integrations', tag: 'integrations', endpoints: 4, description: 'Third-party connections' },
  { name: 'Search', tag: 'search', endpoints: 4, description: 'Full-text search across CRM' },
  { name: 'Reporting', tag: 'reporting', endpoints: 6, description: 'Saved reports and dashboards' },
  { name: 'Projects', tag: 'projects', endpoints: 8, description: 'Client portal projects' },
  { name: 'Audit', tag: 'audit', endpoints: 2, description: 'Immutable mutation log' },
  { name: 'System', tag: 'system', endpoints: 2, description: 'Health checks and status' }
]

const RATE_LIMITS = [
  { tier: 'Auth routes', limit: '5 rps', paths: '/api/auth/*' },
  { tier: 'Write operations', limit: '30 rps', paths: 'POST/PATCH/DELETE' },
  { tier: 'Read operations', limit: '60 rps', paths: 'GET' }
]

export function ApiDocsPage() {
  const specURL = `${GATEWAY_URL}/api/openapi.json`
  const docsURL = `${GATEWAY_URL}/api/docs`

  return (
    <PageLayout title="API Reference" subtitle="Complete API documentation and integration guide">
      <div className="space-y-8">
        {/* Header / CTA */}
        <div className="forge-panel surface-card-strong space-y-4 p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-zinc-100">Welcome to the InfraPortal API</h2>
            <p className="mt-2 text-sm text-zinc-400">
              Build integrations with a production-grade 15-service CRM platform. All endpoints are documented below.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <a
              href={docsURL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-accent"
            >
              Open Swagger UI
            </a>
            <a
              href={specURL}
              download="infraportal-api.json"
              className="btn-neutral"
            >
              Download OpenAPI Spec
            </a>
            <a
              href="https://rodmen07.github.io/infraportal/api-reference/"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-neutral"
            >
              View Static Docs
            </a>
          </div>
        </div>

        {/* Auth Callout */}
        <div className="forge-panel surface-card-strong border-l-4 border-amber-500/40 p-5">
          <h3 className="text-sm font-semibold text-amber-300">Authentication Required</h3>
          <p className="mt-2 text-sm text-zinc-400">
            All endpoints (except <code className="rounded bg-zinc-800/60 px-2 py-0.5 font-mono text-xs">/health</code>) require a Bearer JWT token.
          </p>
          <div className="mt-3 rounded-lg bg-zinc-900/60 p-3 font-mono text-xs text-zinc-300">
            Authorization: Bearer &lt;your-jwt-token&gt;
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            Get a token via <code className="rounded bg-zinc-800/60 px-2 py-0.5 font-mono">POST /api/auth/auth/login</code> or sign in with <a href="#/portal/login" className="text-amber-400 hover:text-amber-300">GitHub / Google</a>.
          </p>
        </div>

        {/* Services Grid */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-zinc-400">Services (11)</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SERVICES.map((service) => (
              <div key={service.tag} className="forge-panel surface-card-strong p-4 hover:border-amber-400/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <h4 className="text-sm font-semibold text-zinc-100">{service.name}</h4>
                    <p className="mt-1 text-xs text-zinc-500">{service.description}</p>
                  </div>
                  <span className="shrink-0 rounded bg-zinc-800/60 px-2 py-0.5 text-xs text-zinc-400">
                    {service.endpoints} endpoints
                  </span>
                </div>
                <p className="mt-3 text-[10px] text-zinc-600 font-mono">
                  tag: <span className="text-amber-400">{service.tag}</span>
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Rate Limits */}
        <div className="forge-panel surface-card-strong p-5">
          <h3 className="mb-4 text-sm font-semibold text-zinc-200">Rate Limiting</h3>
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
                {RATE_LIMITS.map((row, i) => (
                  <tr key={i} className="border-b border-zinc-700/20 hover:bg-zinc-800/20">
                    <td className="px-3 py-2 text-zinc-200">{row.tier}</td>
                    <td className="px-3 py-2 font-mono text-amber-400">{row.limit}</td>
                    <td className="px-3 py-2 text-zinc-500">{row.paths}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-zinc-500">
            All responses include <code className="rounded bg-zinc-800/60 px-1 py-0.5 font-mono text-[10px]">X-RateLimit-*</code> headers. On 429, check <code className="rounded bg-zinc-800/60 px-1 py-0.5 font-mono text-[10px]">Retry-After</code>.
          </p>
        </div>

        {/* Error Format */}
        <div className="forge-panel surface-card-strong p-5">
          <h3 className="mb-3 text-sm font-semibold text-zinc-200">Error Format</h3>
          <p className="text-xs text-zinc-400">All errors return this envelope:</p>
          <div className="mt-3 rounded-lg bg-zinc-900/60 p-3 font-mono text-xs text-zinc-300">
            <pre className="overflow-x-auto">{`{
  "code": "validation_error",
  "message": "Field 'email' is required",
  "details": { "field": "email", "constraint": "required" }
}`}</pre>
          </div>
        </div>

        {/* Getting Started */}
        <div className="forge-panel surface-card-strong p-5">
          <h3 className="mb-3 text-sm font-semibold text-zinc-200">Getting Started</h3>
          <ol className="space-y-3 text-sm text-zinc-400">
            <li className="flex gap-3">
              <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-amber-500/20 text-center text-xs leading-5 text-amber-300">1</span>
              <span>Read <a href="/docs/API.md" className="text-amber-400 hover:text-amber-300">docs/API.md</a> for authentication and architecture overview</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-amber-500/20 text-center text-xs leading-5 text-amber-300">2</span>
              <span>Explore endpoints in the <a href={docsURL} target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300">interactive Swagger UI</a></span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-amber-500/20 text-center text-xs leading-5 text-amber-300">3</span>
              <span>Download our <a href="#/docs" className="text-amber-400 hover:text-amber-300">TypeScript SDK</a> (v1.16.2)</span>
            </li>
            <li className="flex gap-3">
              <span className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-amber-500/20 text-center text-xs leading-5 text-amber-300">4</span>
              <span>Use our <a href="#/docs" className="text-amber-400 hover:text-amber-300">Postman collection</a> (v1.16.4) for testing</span>
            </li>
          </ol>
        </div>

        {/* Support */}
        <div className="rounded-lg border border-zinc-700/40 bg-zinc-900/20 p-4">
          <p className="text-xs text-zinc-400">
            Questions? Check <a href="/docs/API.md" className="text-amber-400 hover:text-amber-300">docs/API.md</a> or open an issue on <a href="https://github.com/rodmen07/portfolio" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:text-amber-300">GitHub</a>.
          </p>
        </div>
      </div>
    </PageLayout>
  )
}

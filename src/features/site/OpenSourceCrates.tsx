import { trackPortfolioEvent } from '../../utils/analytics'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'

// ---------------------------------------------------------------------------
// Open-source crates showcase (About page). Three real, published, MIT (or
// dual MIT/Apache-2.0) licensed Rust crates with real CI, not demoware.
//
// Descriptions are grounded in each crate's own Cargo.toml `description`
// field plus its README (re-verified 2026-07-20 against the crate sources at
// d:\Projects\cargo_crates\, not paraphrased from memory): svccat's workspace
// check and SPDX SBOM export come from its README's "SBOM export" and
// "workspace check" sections; slokit's sloth-compatible generator and
// error-budget/burn-rate library core are its own Cargo.toml description;
// axum-api-kit's extractors/middleware feature set comes from its README's
// "extractors"/"middleware" sections. Versions match each crate's current
// Cargo.toml `[package].version`.
// ---------------------------------------------------------------------------
interface CrateLink {
  readonly label: string
  readonly href: string
}

interface CrateEntry {
  readonly name: string
  readonly version: string
  readonly description: string
  readonly links: readonly CrateLink[]
  readonly downloadBadge: string
}

const CRATES: readonly CrateEntry[] = [
  {
    name: 'svccat',
    version: '1.5.0',
    description:
      'Multi-repo service-catalog CLI: detects drift between a declared manifest and what actually lives in your repos, checks an entire workspace at once, and exports an SPDX SBOM.',
    links: [
      { label: 'crates.io', href: 'https://crates.io/crates/svccat' },
      { label: 'docs.rs', href: 'https://docs.rs/svccat' },
      { label: 'GitHub', href: 'https://github.com/rodmen07/svccat' },
    ],
    downloadBadge: 'https://img.shields.io/crates/d/svccat.svg',
  },
  {
    name: 'slokit',
    version: '1.0.0',
    description:
      'SLO and error-budget engine for Rust: an embeddable library for error-budget and burn-rate math, plus a generator that turns sloth-compatible specs into multi-window multi-burn-rate Prometheus alert rules.',
    links: [
      { label: 'crates.io', href: 'https://crates.io/crates/slokit' },
      { label: 'docs.rs', href: 'https://docs.rs/slokit' },
      { label: 'GitHub', href: 'https://github.com/rodmen07/slokit' },
    ],
    downloadBadge: 'https://img.shields.io/crates/d/slokit.svg',
  },
  {
    name: 'axum-api-kit',
    version: '1.4.0',
    description:
      'Response types, extractors, and middleware for Axum JSON APIs: ApiError, ListResponse, and HealthResponse, pagination and validated-JSON extractors, and request-id/tracing middleware, API-frozen since 1.0.',
    links: [
      { label: 'crates.io', href: 'https://crates.io/crates/axum-api-kit' },
      { label: 'docs.rs', href: 'https://docs.rs/axum-api-kit' },
      { label: 'GitHub', href: 'https://github.com/rodmen07/axum-api-kit' },
    ],
    downloadBadge: 'https://img.shields.io/crates/d/axum-api-kit.svg',
  },
]

export function OpenSourceCrates() {
  return (
    <section className="forge-panel surface-card rounded-3xl border border-zinc-500/30 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-8">
      <p className="text-scale-xs font-semibold uppercase tracking-[0.24em] text-accent">Open source</p>
      <h2 className="mt-2 text-xl font-semibold text-text-primary sm:text-2xl">Published Rust crates</h2>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-text-secondary">
        Three crates I maintain in the open: published to crates.io, documented on docs.rs, and built with real CI on
        every push.
      </p>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {CRATES.map((crate) => (
          <Card key={crate.name} variant="interactive" padding="md" className="flex flex-col">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-text-primary">{crate.name}</h3>
              <span className="text-scale-xs text-text-muted">v{crate.version}</span>
            </div>
            <p className="mt-2 flex-1 text-xs leading-relaxed text-text-secondary">{crate.description}</p>
            <img
              src={crate.downloadBadge}
              alt={`${crate.name} crates.io downloads`}
              className="mt-3 h-5 w-fit"
              loading="lazy"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {crate.links.map((link) => (
                <Button
                  key={link.label}
                  as="a"
                  variant="neutral"
                  size="sm"
                  href={link.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    trackPortfolioEvent('consulting_cta_click', {
                      location: 'open-source-crates',
                      label: `${crate.name} ${link.label}`,
                    })
                  }
                >
                  {link.label}
                </Button>
              ))}
            </div>
          </Card>
        ))}
      </div>
    </section>
  )
}

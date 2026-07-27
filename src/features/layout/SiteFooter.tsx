// ---------------------------------------------------------------------------
// SiteFooter (v1.20.3, decision D-3): the site's one persistent <footer>
// landmark. Mounted in src/main.tsx as a SIBLING of <Root />, outside the
// route-conditional chain, so it renders on every route - including the lazy
// ones - rather than having to be threaded through PageLayout, App.tsx and
// each page that uses neither.
//
// TWO CONSTRAINTS THIS COMPONENT IS BUILT AROUND:
//
// 1. It must not satisfy the boot watchdog. `installLoadWatchdog` in
//    src/main.tsx decides the app rendered by looking for
//    `main, section, nav, [data-app-ready]` inside #root, and this footer is
//    the FIRST thing on the page that renders unconditionally. A <nav> here -
//    the obvious markup for a list of footer links - would satisfy that query
//    on every load, permanently disabling the failure screen for a broken
//    page. So the links are a plain <ul>, which is valid, accessible markup
//    for a footer's link list and keeps the watchdog meaningful.
//    siteFooter.test.ts reads that selector out of main.tsx and asserts the
//    rendered footer matches none of it, so the coupling cannot silently rot.
//
// 2. Tokens only. Every colour is a semantic token utility from
//    src/styles/tokens.css (surface-*, border-*, text-*, accent), and the
//    focus ring is the same var(--focus-ring) recipe TopNav's brand link
//    uses. No raw palette class and no opacity-suffixed class enters the tree,
//    so this file structurally cannot reintroduce the v1.18.4 ghost-class bug
//    (a class invisible in one theme) and the repo-wide opacity/type-scale
//    guards stay green.
// ---------------------------------------------------------------------------
import { FOOTER_LINKS, isExternalFooterHref } from './footerLinks'
import { trackPortfolioEvent } from '../../utils/analytics'
import { PORTFOLIO_EVENTS } from '../../utils/analyticsEvents'

const LINK_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-border-soft bg-surface-control px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-border-strong hover:bg-surface-hover hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]'

export function SiteFooter() {
  // Read at render rather than hard-coded: a pinned year is a fact that rots
  // on 1 January, which is the same defect class v1.20 exists to remove.
  const year = new Date().getFullYear()

  return (
    <footer
      aria-label="Site footer"
      className="border-t border-border-soft bg-surface-1 px-2 py-6 text-text-primary sm:px-4 lg:px-8 xl:px-10"
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold tracking-tight text-accent">RM Cloud Consulting</p>
          <p className="mt-1 text-scale-xs text-text-muted">
            © {year} Roderick Mendoza. Managed hosting, deployment support, and ongoing maintenance.
          </p>
        </div>

        <ul className="flex flex-wrap items-center gap-2">
          {FOOTER_LINKS.map((link) => {
            const external = isExternalFooterHref(link.href)

            return (
              <li key={link.href}>
                <a
                  href={link.href}
                  className={LINK_CLASS}
                  onClick={() =>
                    trackPortfolioEvent(PORTFOLIO_EVENTS.footer_link_click, { location: 'site-footer', label: link.label })
                  }
                  {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
                >
                  {link.label}
                  {external && <span className="sr-only"> (opens in a new tab)</span>}
                </a>
              </li>
            )
          })}
        </ul>
      </div>
    </footer>
  )
}

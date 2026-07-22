# v1.18 Theme Proposal: One Product (Frontend / UI / UX)

- **Status:** APPROVED WITH DEFAULTS (2026-07-19). D1-D11 all accepted as proposed: dark default theme, "RM Cloud Consulting" / "RMCC" branding, TopNav everywhere (SideNav retired), zinc + amber palette with the rose-indigo gradient dropped, system font stack at 16px base with a 12px floor, calm hero motion, full-viewport FocusCard sections retired, "free 30-minute discovery call" first-person copy, the shortened contact form, v1.18.5 performance minor included, axe-core as the only new dev dependency. Implementation is unblocked.
- **Date:** 2026-07-19
- **Surface:** infraportal repo only (React 19 + Vite + Tailwind v3, hash router, GitHub Pages at rodmen07.github.io/infraportal).
- **Mandate:** the user directed development focus to frontend/UI/UX. Process follows the v1.17 precedent (design doc first, explicit user review gate, weekly minors, no new runtime dependencies).
- **Audience:** prospective employers evaluating engineering craft, and prospective clients evaluating a consultant. **Primary conversion:** the Cal.com booking CTA (`SCHEDULING_URL`, defaulting to cal.com/roderick-mendoza-nr7vdc/30min).

---

## 1. Problem statement

Between 2026-06 and 2026-07 the site shipped fast: a monetization funnel (consultation intake, lead scoring, retainers, lead magnet), a full API reference with executable Try-it panels, patch notes, a CRM admin demo, and a client portal. Each feature is individually competent. Together they do not feel like one designed product:

- Three different theming mechanisms coexist, and several named surface classes have no CSS definition at all, so whole cards render invisible in dark mode.
- The home page and the subpages use two different navigation systems, under three different brand names.
- Every section of every funnel page is stretched to a full viewport height, so most of each screen is empty.
- The primary conversion action (book a call) competes with a seven-field form, an animated gradient badge, and copy that cannot decide whether discovery is free or paid.

v1.18 should make the site feel like one product designed by one person on purpose, and convert better because of it.

---

## 2. UX audit (2026-07-19)

Method: walked every route in `src/main.tsx` as a first-time visitor would (cold load, no localStorage), in both themes, at mobile and desktop widths, reading the actual source for every claim. Evidence cites file and line. Severity: **P0** breaks the one-product feel or the funnel, **P1** visibly hurts quality or trust, **P2** polish.

### F1. Ghost surface classes: cards are invisible in dark mode (P0)

`surface-card` and `surface-card-strong` are used across pages but **defined nowhere** in the repo (no match in any CSS file). `forge-panel`, `forge-grid`, and `interactive-card` exist **only** as `[data-theme="light"]` overrides (src/index.css lines 242-318); they have no dark-mode base styles.

Consequence: any panel styled only with these classes has no background and no border in dark mode. Affected today: the PageLayout title header (src/pages/PageLayout.tsx line 26), every ApiDocsPage card (src/pages/ApiDocsPage.tsx lines 22, 55, 87, 121), PatchNotesPage version cards (src/pages/PatchNotesPage.tsx line 67), the CaseStudiesPage hero and its stat tiles (src/pages/CaseStudiesPage.tsx lines 17, 25-36), ServicesPage stat tiles and the "What is included" panel (src/pages/ServicesPage.tsx lines 39, 50, 87), and the ContactPage hero (src/pages/ContactPage.tsx line 71). They render as floating text with a drop shadow. Panels that happen to also carry inline utilities (the home page sections in src/App.tsx) look correct, which is why the rot is uneven and easy to miss.

### F2. Three coexisting theming mechanisms (P0)

1. Dark-authored Tailwind utilities, patched for light mode by a ~250-line override sheet of `!important` rules keyed to exact utility class names (src/index.css lines 222-478, self-described as "dark-island remediation"). Any new component that uses a dark utility not in the list silently becomes a dark island in light mode.
2. Per-component JS branching on `useTheme()` with parallel dark/light class records (src/features/consulting/PricingCard.tsx lines 12-46).
3. A small set of `--fx-*` CSS variables (src/index.css lines 5-13) consumed only by `.btn-accent`, `.btn-neutral`, and `.fx-chip`.

The override sheet already conflicts with itself: `.interactive-card` is defined twice for light mode (lines 259 and 312); the second wins and introduces a sky-blue tint that diverges from the amber system.

### F3. Default theme mismatch and first-load flash (P0)

`index.html` hardcodes `data-theme="dark"` (line 2) and its inline script only applies a saved theme. `ThemeProvider` defaults to `'light'` when localStorage is empty (src/features/layout/ThemeContext.tsx line 16). A first-time visitor therefore boots dark, then flips to light after React mounts. The default first impression is the light theme, which is the patched override-sheet rendering, while the hand-authored coherent dark theme sits behind the toggle.

### F4. Two navigation systems, three brand names (P0)

- Home renders `TopNav` only: a sticky pill cluster branded "Managed Hosting" (src/features/layout/TopNav.tsx line 47).
- Every subpage uses `PageLayout`, where TopNav is mobile-only (`lg:hidden`, src/pages/PageLayout.tsx line 21) and desktop gets **only a floating hamburger** (SideNav drawer, closed by default) while `lg:pl-64` (line 12) permanently reserves a 256px gutter for the closed drawer. Desktop subpages have no visible navigation, no brand, and an off-center content column.
- Mobile subpages render **both** the hamburger and TopNav, at the same height.
- Brand names: "Managed Hosting" (TopNav), "RMCC" (src/features/layout/SideNav.tsx line 53), "RM Cloud Consulting" (index.html title), and the npm package is still `task-portal-service` (package.json line 2).
- Nav has no `aria-current`; there is no skip-to-content link anywhere in src.

### F5. Full-viewport section scroll pattern (P0)

`FocusCard` wraps every section in `min-h-screen flex items-center justify-center py-12` (src/features/layout/FocusCard.tsx line 8). Home is 5 viewport-height sections; Pricing 5; About 5; Case Studies 7. Visitors scroll a viewport of mostly empty space per card, and on tall desktop monitors a single small card floats in a sea of background. Nothing below the hero is visible above the fold, including all proof and all CTAs.

### F6. Hero tone fights the professional identity (P1)

The h1 floats up and down forever (`animate-float-slow`, src/features/site/HeroSection.tsx line 64). Above it, an amber-rose-indigo gradient pill pulses with a wiggling sparkle emoji (lines 58-62); it is secretly a button whose payoff is a slide-over containing the global animation preference checkbox (lines 106-123). The motion system is otherwise well built (global `prefers-reduced-motion` support plus a manual override), but the default presentation reads as promotional, not professional, and the animated badge outcompetes the actual booking CTA.

### F7. Funnel copy contradictions (P0 for conversion)

- ContactPage: "Every engagement starts with a free 30-minute discovery call" (src/pages/ContactPage.tsx line 76). HeroSection fallback CTA: "Start paid discovery" (line 87). ContactCTA heading: "Start a paid engagement". Whether discovery is free or paid is unresolved on the highest-intent pages.
- Voice flips between "I" (HeroSection, HowItWorksSection, ContactCTA prose) and "we" (src/pages/ServicesPage.tsx lines 45, 89; ContactCTA line 186 "We typically reply"). For a solo consultant, "we" reads as inflation to exactly the audiences this site targets.

### F8. CTA hierarchy is inverted and repetitive (P0 for conversion)

The primary conversion (Cal.com booking) renders as one link among several, while the seven-field consultation form (`ContactCTA`: name, email, engagement, budget, timeline, referral, message) is the default closer embedded on Home, About, Services, Pricing, Case Studies, and Contact. Four pages end with the identical two full-viewport blocks (HowItWorksSection + ContactCTA), so every page has the same bottom half. Inside the form: a "Recent requests" strip echoes the visitor's own localStorage submissions back at them on a public page (src/features/site/ContactCTA.tsx lines 198-208), which to a tester looks like fake social proof; and a "$500 referral" gift-emoji panel (lines 211-224) pitches referrals to people who have not yet become clients.

### F9. No proof on the landing page, no shareability metadata (P0 for conversion)

Home shows zero social proof: no case-study strip, no metrics, no GitHub presence, no testimonials. The strongest assets for both audiences (5 case studies, the executable API reference, published crates) are one or two clicks deep with no teaser. `index.html` has **no meta description and no OpenGraph or Twitter card tags**, so sharing the portfolio on LinkedIn (the stated distribution channel for the drafted post) produces a bare link with no preview.

### F10. Typography has no scale (P1)

Base font-size is raised to 18px (src/index.css line 16), yet the UI is dominated by `text-sm`, `text-xs`, and 163 occurrences of arbitrary `text-[10px]`/`text-[11px]` across 44 files. Uppercase micro-labels use at least five different letter-spacing values (`tracking-[0.2em]`, `[0.22em]`, `[0.24em]`, `wide`, `widest`). The scale is effectively inverted: oversized body default, undersized interface text, no named steps.

### F11. Accessibility basics are half-installed (P1)

Good: modals declare `role="dialog"` and `aria-modal` (BulkEditModal, BulkImportModal, ProjectCloneModal), theme toggle and hamburger have aria-labels, reduced-motion is handled globally, focus-visible rules exist for buttons and inputs (src/index.css lines 136-148). Gaps: no skip link; no `aria-current` on nav; `SlideOver` (src/features/site/SlideOver.tsx) and the SideNav drawer have no Escape handling and no focus trap; the acknowledged `text-zinc-500`-on-dark contrast failure is documented in a CSS comment (src/index.css line 386) but not fixed; 10-11px text is used for real content, not just decoration.

### F12. Bundle: everything ships to the landing page (P1)

Only ApiDocsPage is lazy (src/main.tsx lines 40-45). The 2,176-line CrmAdminPage, 1,084-line PortalPage, all five case-study pages, the 507-line MedallionDemo, ReportsPage, AuditPage, and the portal auth pages are all eagerly imported into the initial chunk: **~800 KB pre-gzip JS** (dist/assets/index-*.js) plus 66 KB CSS, and `highlight.js/styles/github-dark.css` loads globally for every visitor (src/main.tsx line 7).

### F13. Demo surfaces are routable but unframed (P2)

`#/crm/admin`, `#/portal`, `#/crm/reports`, `#/admin/*`, `#/observaboard` are reachable by URL but unlinked for anonymous visitors, and none of them explain to a visitor what they are looking at or that the data is a labeled demo dataset (the mock boundary is documented in code, not in the UI chrome). They are portfolio evidence hidden from the portfolio audience. (Deliberately deferred; see Section 6.)

### F14. Working well, protect it (context)

The API reference is genuinely strong (custom renderer, executable Try-it panels, honest disabled states, deep links). The mock-boundary discipline is exemplary. Lead scoring, analytics events, and the FormSubmit relay work. The dark theme's core identity (zinc surfaces, amber accent, generous radii, uppercase kickers) is attractive and distinctive. v1.18 should formalize that identity, not replace it.

---

## 3. Candidate themes

### A. Design-system consolidation

Tokens (color roles, type scale, spacing, radii) defined once for both themes; real shared primitives (Surface/Card, Button, Badge, Table); one theming mechanism; a11y pass (focus, contrast, keyboard). Fixes F1, F2, F3, F10, F11 at the root and makes every later feature cheaper. Risk: can burn weeks with no visitor-visible payoff if it stops at plumbing.

### B. First-impression and funnel polish

Landing narrative, calm hero, proof strip, CTA hierarchy, copy coherence, form shortening, social metadata, mobile pass. Fixes F5 through F9 and is the most direct conversion lever. Risk: polishing on top of F1/F2 means building new surfaces on a broken system and re-doing them later; the new hero would still go invisible-card in dark mode the first time it uses a ghost class.

### C. Demo showcase UX

Guided "what am I looking at" affordances, demo entry points, tour chrome for the admin/portal/playground surfaces (F13). Differentiates for employers, but since the 2026-06-26 pivot the demos are the secondary surface, and any tour chrome built before Theme A exists would be built twice. Best value after A and B.

### D. Performance / perceived speed

Route-level code splitting, chunk budget, coherent loading states (F12). Measurable and low-risk, but an 800 KB chunk on GitHub Pages is a quality smell more than a conversion killer, and it does not address the coherence mandate.

### Comparison

| | Fixes | Conversion impact | Coherence impact | Depends on | Cost |
|---|---|---|---|---|---|
| A. Design system | F1 F2 F3 F10 F11 | Indirect | **Highest** | nothing | 2 minors |
| B. Funnel polish | F5 F6 F7 F8 F9 | **Highest** | High | A (surfaces, tokens) | 1-2 minors |
| C. Demo showcase | F13 | Low-medium | Medium | A, ideally B | 1-2 minors |
| D. Performance | F12 | Low | Low-medium | nothing | 1 minor |

---

## 4. Recommendation

**A tight sequence: Theme A as the spine, with Theme B landing as soon as the system can carry it.** Two minors of consolidation (tokens, surfaces, navigation), then the conversion re-land on top of the new system, then one sweep that finishes components and accessibility. Theme D's highest-value item (route splitting plus loading states) is an optional fifth slice; Theme C is explicitly deferred to a v1.19 candidate.

Rationale: F1-F4 mean any pure-polish theme builds on sand, and the audit shows polish work would immediately trip over ghost classes, the override sheet, and the split navigation. But pure plumbing is not defensible on a conversion site either, so the sequence is ordered to reach visitor-visible payoff by the third minor, and every minor ships something a visitor or reviewer can see.

One structural principle for the whole theme: **tokens live in CSS variables defined for both themes; components consume semantic classes or Tailwind utilities mapped to those variables.** The light-mode override sheet and the JS theme-branching both retire via strangler: existing rules are deleted only when the surfaces they patch have moved onto tokens.

**Correction (post-hoc, pre-merge QA on v1.18.4 PR2):** the original text here read "the sheet's deletion is a v1.18.4 exit criterion, not a day-one rewrite," and Section 5's v1.18.4 PR2 carried a matching "Done when: ... override sheet deleted" bar. Neither survived contact with the ~40 case-study/admin/portal files still on raw Tailwind utilities: migrating all of them onto tokens is a large, cross-cutting rewrite this milestone deliberately kept out of its safely-reviewable scope (see the v1.18.4 PR2 entry below), so the sheet is not deleted at the end of v1.18.4 - it is measurably larger (124 to 229 `[data-theme="light"]` selectors across the milestone) because closing the milestone's real contrast bugs required more overrides, not fewer, while that migration is still undone. Full deletion is now v1.18.6's job (added below), with its own checkable done-when. v1.18.4's own done-when is corrected to match what it actually delivers: no invisible or wrong-state colour in either theme, and a ratchet gate so the sheet cannot grow further without a deliberate, reviewed bump.

---

## 5. Milestones

Cadence: one minor per week, each one or two small PRs, same verification bar as v1.16/v1.17 (`npm run build`, `npm run test`, tsc CI gate, npm audit CI, green Pages deploy on merge). No new runtime dependencies anywhere in this theme. Dev-dependency additions only where a milestone names one, subject to D11.

### v1.18.1 - Token foundation and real surfaces

- **PR 1:** `src/styles/tokens.css` (or a `@layer base` block in index.css): semantic roles as CSS variables for both themes (`--surface-0/1/2`, `--border-soft/strong`, `--text-primary/secondary/muted`, `--accent`, `--accent-contrast`, success/warning/danger, radius and spacing steps, named type scale). Map them into `tailwind.config.js` `theme.extend` (colors, borderRadius, fontSize) so utilities like `bg-surface-1` work. Give `forge-panel`, `forge-grid`, `surface-card`, `surface-card-strong`, and `interactive-card` real definitions in both themes built from the variables (fixing F1 by definition, not by hunting call sites). Resolve F3: index.html, the pre-mount script, and ThemeProvider agree on one default (see D1), eliminating the first-load flash.
- **PR 2:** migrate the shared chrome onto tokens: TopNav, SideNav, PageLayout, `.btn-accent`/`.btn-neutral`, form input recipe, `fx-chip`. Delete the override-sheet rules those surfaces needed. Add a **token integrity test** (Vitest): scan `src/**/*.tsx` for the named surface classes and assert each has a definition in the CSS source, so a ghost class can never ship again.
- **Done when:** build, Vitest (including the new integrity test), tsc, and Pages deploy are green; a both-themes walk of all routes shows zero invisible panels; no `!important` in any newly written rule.
- **Proves to the audience:** employers see design-system thinking in the repo (tokens, integrity tests); every visitor stops seeing borderless ghost cards on API Docs, Patch Notes, Services, Case Studies, and Contact.

### v1.18.2 - One navigation, one page anatomy

- **PR 1:** single navigation system on every route per D3 (proposed: TopNav everywhere, SideNav retired). One brand name everywhere per D2. Add `aria-current="page"` to active items, a skip-to-content link, Escape handling and a focus trap for any surviving drawer and for SlideOver.
- **PR 2:** retire the `min-h-screen` FocusCard pattern (D7): sections flow with a consistent spacing rhythm from the tokens; funnel pages adopt one page-header pattern; each page keeps exactly one closing CTA block instead of the stacked HowItWorks + ContactCTA tail (the removed duplication is Home/About/Services/Pricing/CaseStudies content restructuring, coordinated with v1.18.3 copy).
- **Done when:** every route shares identical chrome; a keyboard-only walk works (skip link, visible focus, Escape closes overlays); an axe smoke test (Vitest + jsdom, dev-only, per D11) passes on Home, Pricing, Contact, API Docs; deploy green.
- **Proves to the audience:** the site stops feeling like two stitched products; desktop subpages get their navigation back (currently a lone hamburger and a 256px empty gutter).

### v1.18.3 - Home and funnel re-land

- **PR 1:** hero rewrite: calm motion per D6 (no floating h1, no wiggle, no pulsing gradient badge; keep the one-time rise-in and the reduced-motion override, relocated out of the hero), one identity line naming what the visitor gets, **one primary CTA: Book a 30-minute call** (Cal.com), secondary CTA to case studies. Add a proof strip to Home: case-study stats, GitHub and crates.io links, the "decommissioned to $0 on purpose" story as a credibility line. Fix F7: canonical discovery offer per D8, single first-person voice. Shorten the contact form per D9; remove the "Recent requests" localStorage echo; demote the referral panel to the Contact page footer.
- **PR 2:** shareability and consistency: meta description, OpenGraph and Twitter card tags, a static social-card image in `public/`; the same CTA hierarchy (primary book-call, secondary form) applied to Services, Pricing, Case Studies, About. Keep all `trackPortfolioEvent` names stable so the analytics history stays comparable; extend Vitest coverage over the changed lead-intake path.
- **Done when:** build and tests green; both-theme render of the new home verified; a link-preview check of the deployed URL shows title, description, and image; the booking CTA is the first interactive element in the hero and appears exactly once per viewport-length of content; deploy green.
- **Proves to the audience:** clients get a clear story and one obvious next step; employers get proof above the fold; the LinkedIn post finally unfurls into a real preview.

### v1.18.4 - Component consolidation, type scale, and a11y finish

- **PR 1:** shared primitives in `src/components/ui/`: `Badge`/`StatusPill` (replacing the ad hoc severity, completion, status, and priority pills in PatchNotes, Consultations, SupportQueue, CrmAdmin, Portal), `Button` (absorbing `.btn-accent`/`.btn-neutral` and the three inline amber pill recipes), `Card`, and a `DataTable` shell (header, row hover, empty state) adopted by the ApiDocs rate-limit table and the Consultations and SupportQueue lists. PricingCard's JS theme-branching migrates to tokens, removing mechanism 2 of F2.
- **PR 2:** typography and contrast: apply the named type scale per D5, floor interface text at 12px (replacing the 163 arbitrary 10-11px uses where they carry content; a small allowlist may keep decorative kickers), fix the documented zinc-500-on-dark contrast failure, and reduce the light-mode override sheet where genuinely dead (delete rules with zero remaining consumers once PR1's primitive migration removes them - **not** a full-sheet deletion, corrected below). Every opacity-suffixed `text-*`/`bg-*`/`border-*` override this PR adds or touches must be verified against its *actual* consumers, including any `hover:`/`focus:`/`open:` variant those consumers use - a bare-class override does not cover a variant-prefixed class, because Tailwind compiles them to different selectors (`.border-amber-400\/60` versus `.hover\:border-amber-400\/60:hover`); `opacityColorThemeCoverage.test.ts` checks this per the exact compiled selector, not by class name alone. In place of the (unachievable, see below) "no new overrides" gate, add a **ratchet** gate: the override-sheet selector count must not exceed its current value without a deliberate, documented bump in the same PR.
- **Done when:** primitives exist with unit tests and the named pages use them; no colour class (bare or variant-prefixed) renders un-themed or wrong-state in either theme, enforced by `opacityColorThemeCoverage.test.ts`; the override-sheet ratchet gate (`tokens.test.ts`) is green and its ceiling matches the shipped count exactly; axe smoke and the type-scale gate green; both-theme walk clean; deploy green.
- **Proves to the audience:** tables, badges, and buttons look related everywhere; every interactive state (hover, focus, open) is themed as carefully as the resting state; reviewers reading the repo find a `ui/` layer instead of 2,000-line pages defining their own pills.

**Correction (post-hoc, pre-merge QA):** this milestone's original text called for the override sheet to be *deleted* by the end of PR2, with a "no new `[data-theme="light"] .` overrides" gate. Neither happened nor could have: PR2's own real contrast fixes required *adding* overrides (the two originally-named bugs, plus - caught only by a second adversarial pass - 17 more `hover:`/`focus:`/`open:` variants of existing classes that a first attempt's bare-class overrides silently failed to cover), while the ~40 files still on raw Tailwind utilities remain unmigrated. The sheet closes this milestone at 229 `[data-theme="light"]` selectors, up from 124 at the start of v1.18.4, not zero. Full deletion is retargeted to the new v1.18.6 milestone below, which owns the actual token migration those 40 files need.

**Correction (post-merge QA):** PR1's scope list above still names CrmAdmin among the pages whose ad hoc pills move onto `Badge`/`StatusPill`. `CrmAdminPage.tsx` was not touched (zero-line diff versus main on both PR branches) - out of scope per this same document's own "scope creep into CrmAdminPage/PortalPage internals" risk fence in Section 6. PatchNotes, Consultations, SupportQueue, and Portal migrated as described; CrmAdmin's ad hoc pills remain unmigrated and are a candidate for v1.18.6 or a later pass, not something PR1 delivered.

### v1.18.6 - Override-sheet retirement (RE-SCOPED 2026-07-22 after a measured analysis; user-approved plan)

**Why re-scoped.** The original done-when ("selector count reaches zero") is architecturally unachievable within this milestone, and a single-codemod approach is unsafe. A verified measurement of `main` on 2026-07-22 (boundary-matched, not a raw grep) established:

- The sheet is ~230 `[data-theme="light"]` rules; **~179 target raw palette classes** (the migration surface) and **~49 target structural/component/base selectors** (`body`, `.forge-panel`, `.btn-*`, `.text-white`, `.about-fact-card`) that are NOT part of this migration and always stay.
- Of the 179 palette rules: **4 are already dead** (zero `.tsx` consumers - deletable now), **97 sit behind ≤3 non-fenced files each** (cheap), **18 behind 4-10**, only **4 are true hotspots** (11+ files: `bg-zinc-900/80`, `border-zinc-500/30`, `text-amber-200`, `border-amber-500/30`), and — the dominant fact — **56 have a consumer inside `CrmAdminPage.tsx` or `PortalPage.tsx`**, the two files fenced off for code-health in Section 6.
- **Those 56 rules cannot be retired here** without splitting/unfencing those pages (a separate, large code-health effort). So a perfect v1.18.6 leaves the sheet at ~105 rules (≈49 structural + 56 fenced), never zero.
- **A blanket class→token codemod is unsafe:** of ~280 raw palette classes in use, only ~14-23 map pixel-faithfully; ~73% are consolidations that shift a colour in at least one theme, and a name-based map mis-buckets because the correct target depends on the *rendered post-override* value, not the class name (e.g. `text-zinc-500` maps clean but `text-zinc-400` does not - inverted). The scanner tests verify **structure, not appearance**: nothing catches a wrong-but-theme-aware mapping, bare (non-opacity) classes have no consumer-vs-override guard, and the `*/`-in-a-comment PostCSS build break is not caught by any PR check (`npm run build` runs only in the post-merge Pages deploy).

**Approved approach: HYBRID (user, 2026-07-22).**

- **PR 1 - curated codemod:** a scripted, allow-list class→token map of ONLY the ~14-23 verified pixel-clean classes (covers ~24% of all raw-palette call sites, including several of the highest-traffic clean classes), plus deletion of the 4 already-dead rules and any override rule those clean migrations render fully consumer-free. No consolidation classes in this PR.
- **Then class-oriented:** one class (or tight family) per PR for the ~97 easy + 18 medium consolidation classes, each PR eliminating the class across all its non-fenced consumers, deleting its override rule, dropping the ratchet ceiling, and carrying a manual both-theme walk. Front-load the files that unblock clusters (`MedallionDemo.tsx`, `OnboardingChecklist.tsx`).
- **The 4 hotspots** land as their own dedicated PRs (largest blast radius, so smallest scope each).

**Mandatory guardrails (the safety net does NOT cover these):**
- Add a `build` job to the required PR checks BEFORE starting (closes the un-gated `*/` PostCSS hazard that shipped in v1.18.4; also the already-filed MED bug). Until then, every PR must run `npm run build` locally.
- Every PR: a human both-theme + both-width walk of the touched surfaces (no automated colour-value guard exists), and confirm each deleted override truly has zero remaining consumers (trust the opacity-coverage test for opacity-suffixed classes; grep by hand for bare built-ins).

- **Done when (RE-SCOPED):** every **non-fence-blocked** palette override rule is retired — the `[data-theme="light"]` selector count reaches its structural floor (~49 structural + the 56 fence-blocked = ~105), NOT zero. The ratchet stays (it now guards the floor, not zero). Both-theme walk clean; deploy green. Full retirement to zero is explicitly **deferred to the CrmAdminPage/PortalPage split below.**
- **Proves to the audience:** light mode is first-class for every surface a visitor actually sees (marketing, case studies, portal-facing chrome); the residual patch surface is confined to two admin-only internal pages, tracked for a dedicated split.

### CH-1 - Split CrmAdminPage / PortalPage, then retire the last 56 override rules (dependent milestone, filed 2026-07-22)

The 2,187-line `CrmAdminPage.tsx` and ~1,100-line `PortalPage.tsx` are fenced from v1.18.x for code-health (Section 6). They hold **56 override rules hostage**: those rules cannot be deleted while these two files keep using the raw classes. This milestone splits each page into smaller modules (a behavior-preserving refactor, existing tests unchanged), migrates the extracted pieces onto tokens, and then deletes the final 56 rules to bring the sheet to its true structural floor. Large; sequenced after v1.18.6's non-fenced retirement. Candidate for a v1.19 code-health theme.

### v1.18.5 (optional, per D10) - Perceived performance

- **PR 1:** lazy-load CrmAdminPage, PortalPage (and portal auth pages), the five case-study pages, and MedallionDemo behind route-level Suspense with skeletons from the existing `Skeleton.tsx` system; a chunk-budget script (plain Node, no new deps) fails CI if the initial JS chunk exceeds the budget (proposed: 300 KB pre-gzip, roughly 90 KB gzip, from ~800 KB today).
- **Done when:** budget script green in CI; landing-page network trace shows only the initial chunk plus the route being viewed; route transitions show branded skeletons, not blank frames; deploy green.
- **Proves to the audience:** the landing page loads like a marketing site, not an app download; employers see bundle discipline enforced in CI.

---

## 6. Explicitly out of scope for v1.18

- Theme C (guided demo tours, demo entry-point marketing): proposed as the leading v1.19 candidate once the system and funnel are coherent.
- New features, new pages, or any backend/infra rebuild (USER-ONLY decision).
- README truth pass and the stale DynamoDB blurb (already separate roadmap lines).
- The coordinated Vite major upgrade (separate roadmap line; the chunk-budget script must not depend on it).
- Adopting a router library, or converting the hash router (GitHub Pages constraint stands).
- Any rebrand beyond tokenizing the existing identity (see D2, D4).

## 7. User decisions (the review gate)

**APPROVED 2026-07-19: "defaults approved."** All eleven decisions below are accepted as proposed and are now the binding spec for v1.18.1 through v1.18.5.

| # | Decision | Proposed default | Notes |
|---|---|---|---|
| D1 | Default theme for first-time visitors | **Dark** | The site is authored dark-first and the dark theme is the coherent one; light remains fully supported and becomes first-class in v1.18.4. Blocks v1.18.1. |
| D2 | One brand name | **"RM Cloud Consulting"**, compact mark "RMCC" | Matches the page title and favicon; "Managed Hosting" becomes a descriptor line, not the brand slot. Blocks v1.18.2. |
| D3 | Navigation model | **TopNav on every route; retire SideNav** | Marketing-standard header for a funnel site; admin links stay in the authed admin row that already exists. Alternative: persistent desktop sidebar everywhere. Blocks v1.18.2. |
| D4 | Palette direction | **Keep zinc + amber accent; emerald = success, red/orange/yellow = status only; drop the rose-indigo gradient** | Formalized as tokens. Alternative directions (e.g. slate + blue "enterprise") are a rebrand and out of scope. |
| D5 | Typography | **System font stack stays; html base returns to 16px; named scale with a 12px interface floor** | Zero-cost and fits the infra identity. Option: self-host Inter variable (~40 KB) if a more designed feel is wanted. |
| D6 | Hero motion | **Calm: remove floating h1, wiggle, pulsing badge; keep one-time reveals and the reduced-motion override** | The animation preference control moves out of the hero slide-over (proposed: About page). |
| D7 | Scroll pattern | **Retire the full-viewport FocusCard sections in favor of continuous flow** | Today's one-card-per-screen look is a deliberate aesthetic; confirm it goes. Blocks v1.18.2 PR 2. |
| D8 | Discovery offer and voice | **"Free 30-minute discovery call" everywhere; first-person "I"** | Matches the Cal.com 30min link. If discovery should be paid, say so and copy inverts consistently instead. |
| D9 | Contact form length | **Name, email, message, plus one optional "what do you need" select; budget/timeline move into the call** | Lead scoring keeps working with defaults for the removed fields. Alternative: keep all seven fields. |
| D10 | Include v1.18.5 (performance) in the theme | **Yes, as the optional fifth minor** | Can be dropped to keep the theme at four weeks. |
| D11 | Dev-dependency additions | **Allow axe-core (+ jsdom integration) for a11y smoke tests; nothing else; zero runtime deps** | Screenshot tooling (Playwright) deliberately not proposed; the gate stays a manual both-theme route walk per milestone. |

## 8. Risks

- **Visual regressions without screenshot tooling.** Mitigation: the strangler rule (override-sheet rules deleted only when their surfaces are tokenized), the token integrity test, and a required both-theme, both-width route-walk checklist in every PR description. If this proves too fragile, revisit D11.
- **The override sheet is deleted too early, or a bare-class override is trusted to cover a variant-prefixed consumer it cannot match.** Mitigation: full deletion is v1.18.6's job, not v1.18.4's (corrected post-hoc, see Section 5); until then the sheet and the tokens coexist, its size is ratcheted (`tokens.test.ts`) so it cannot silently grow, and `opacityColorThemeCoverage.test.ts` checks coverage against each class's actual compiled selector (including `hover:`/`focus:`/`open:` variants) rather than by bare class name alone.
- **Scope creep into CrmAdminPage/PortalPage internals** (3,200 lines combined). Mitigation: v1.18 touches their shared chrome and shared primitives only; internal logic, state, and the mock boundaries are untouched.
- **Copy and form changes distort the analytics baseline.** Mitigation: `trackPortfolioEvent` names are frozen; new events may be added, none renamed; the lead relay path keeps its Vitest coverage.
- **Conversion regression from removing familiar CTAs.** Mitigation: nothing is deleted from the funnel, only re-ranked; the form remains one click away everywhere; before/after CTA-click events remain comparable.
- **Cadence.** Four required minors plus one optional fits the one-minor-per-week cadence with the theme's original scope complete by mid-August 2026; v1.18.6 (override-sheet retirement, added post-hoc once v1.18.4 could not carry full deletion) extends that by one more week and is scoped separately rather than reopening v1.18.4.
- **Hash-router metadata limits.** OG tags are site-wide, not per-route; acceptable for a portfolio (the shared link is the site itself) and noted so it is not mistaken for a bug.

## 9. Verification bar

Unchanged from the roadmap, applied per milestone: `npm run build`, `npm run test` (Vitest), the tsc CI gate, npm audit CI, and a green GitHub Pages deploy on merge, plus the milestone-specific gates listed in Section 5 (token integrity test, axe smoke, typography gate, chunk budget, override-sheet ratchet gate).

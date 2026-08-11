/** @type {import('tailwindcss').Config} */
export default {
  // v1.28.1 (D-31): test files are excluded from the extractor's corpus.
  //
  // Tailwind's extractor reads RAW TEXT, not code: any token that looks like a
  // utility emits a rule, including one that appears only inside a string
  // literal, an assertion message, or a comment. `src/**/*.test.ts` is 98 files
  // of prose ABOUT class names, so every utility a test names by hand shipped a
  // live rule to production for no rendered element (TAILWIND-TESTPROSE-LEAK-1,
  // first found in PR #145 and re-caught by hand in #146 x2, #147, #152, #153).
  //
  // Measured on this branch: the negation removes exactly 17 utilities from the
  // built stylesheet and nothing else, each independently re-verified at zero
  // whole-token consumers across the non-test sources -- see the PR body for
  // the entry-by-entry accounting. The mechanism is proven in BOTH directions
  // by src/styles/testProseLeak.test.ts, which builds the real config through
  // PostCSS and asserts a class named only in a test file emits no rule while
  // the same class in a component does.
  //
  // Order matters to Tailwind: the negation must come AFTER the positive glob
  // it narrows. `.test.tsx` is named even though zero such files exist today,
  // so the class cannot reappear through a new file kind.
  content: ['./index.html', './src/**/*.{ts,tsx}', '!./src/**/*.test.{ts,tsx}'],
  theme: {
    extend: {
      // v1.18.1 PR1 token foundation: mapped from the CSS custom properties
      // in src/styles/tokens.css so utilities like bg-surface-1,
      // border-border-soft, and text-text-muted resolve per-theme via
      // var(...). See docs/design/V1_18_UX_THEME.md section 5 (v1.18.1) and
      // section 7 (D4). Radius and font-size keys are deliberately namespaced
      // (radius-*, scale-*) instead of reusing Tailwind's default sm/md/lg/xl
      // keys, so this mapping cannot silently reflow the ~50 existing
      // rounded-* / text-* call sites across the app; that migration is the
      // v1.18.4 typography/consolidation milestone's job, not this one.
      colors: {
        surface: {
          0: 'var(--surface-0)',
          1: 'var(--surface-1)',
          2: 'var(--surface-2)',
          control: 'var(--control-bg)',
          hover: 'var(--surface-hover)',
        },
        border: {
          soft: 'var(--border-soft)',
          strong: 'var(--border-strong)',
        },
        text: {
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
          subtle: 'var(--text-subtle)',
        },
        // v1.18.1 PR2: the translucent accent roles are explicit keys rather
        // than opacity modifiers (bg-accent/20) because Tailwind cannot apply
        // an alpha channel to a bare var() colour.
        accent: {
          DEFAULT: 'var(--accent)',
          contrast: 'var(--accent-contrast)',
          soft: 'var(--accent-soft)',
          'soft-hover': 'var(--accent-soft-hover)',
          line: 'var(--accent-line)',
          'line-hover': 'var(--accent-line-hover)',
          text: 'var(--accent-text)',
        },
        // v1.18.4: soft/line/text triples so the Badge primitive can express
        // every ad hoc per-page status colour (PatchNotes severity,
        // Consultations status/priority, SupportQueue status, Portal status)
        // through one recipe, mirroring the accent set above exactly.
        success: {
          DEFAULT: 'var(--success)',
          soft: 'var(--success-soft)',
          line: 'var(--success-line)',
          text: 'var(--success-text)',
        },
        warning: {
          DEFAULT: 'var(--warning)',
          soft: 'var(--warning-soft)',
          line: 'var(--warning-line)',
          text: 'var(--warning-text)',
        },
        danger: {
          DEFAULT: 'var(--danger)',
          soft: 'var(--danger-soft)',
          line: 'var(--danger-line)',
          text: 'var(--danger-text)',
        },
        // A fourth status rung (D4 sanctions orange as status-only,
        // distinct from amber-as-accent) and a fifth for "new"/"pending"/
        // "informational" states that are neither success nor a problem.
        caution: {
          DEFAULT: 'var(--caution)',
          soft: 'var(--caution-soft)',
          line: 'var(--caution-line)',
          text: 'var(--caution-text)',
        },
        info: {
          DEFAULT: 'var(--info)',
          soft: 'var(--info-soft)',
          line: 'var(--info-line)',
          text: 'var(--info-text)',
        },
        // v1.18.4: the Badge primitive's `neutral` tone (and PatchNotesPage's
        // upcoming-version pill) read `bg-neutral-bg` / `border-neutral-border`
        // / `ring-neutral-border`. Tailwind ships its own built-in `neutral`
        // grey scale (numeric shades only), which does not define a `bg` or
        // `border` sub-key, so without this entry those three classes were
        // ghost classes - exactly audit finding F1's failure mode, just for a
        // config-level colour role instead of a hand-authored CSS class.
        // `--neutral-bg` / `--neutral-border` already existed in
        // src/styles/tokens.css (v1.18.1 PR2) for `.btn-neutral`; this just
        // exposes the same two roles as Tailwind utilities.
        neutral: {
          bg: 'var(--neutral-bg)',
          border: 'var(--neutral-border)',
        },
      },
      borderRadius: {
        'radius-sm': 'var(--radius-sm)',
        'radius-md': 'var(--radius-md)',
        'radius-lg': 'var(--radius-lg)',
        'radius-xl': 'var(--radius-xl)',
      },
      fontSize: {
        'scale-2xs': 'var(--text-2xs)',
        'scale-xs': 'var(--text-xs)',
        'scale-sm': 'var(--text-sm)',
        'scale-base': 'var(--text-base)',
        'scale-md': 'var(--text-md)',
        'scale-lg': 'var(--text-lg)',
        'scale-xl': 'var(--text-xl)',
        'scale-2xl': 'var(--text-2xl)',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(16px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s ease-out both',
        'fade-in': 'fade-in 0.4s ease-out both',
        'slide-in-right': 'slide-in-right 0.4s ease-out both',
      },
    },
  },
  plugins: [],
}

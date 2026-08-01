import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/**
 * Files that still call setState synchronously inside an effect body, held at
 * "warn" while the rule runs at its plugin default ("error") everywhere else.
 *
 * react-hooks 7.1 (required by the eslint 10 peer range) added
 * `set-state-in-effect` to its recommended set at "error". Adopting it whole
 * would have meant rewriting 17 data-loading effects inside a toolchain
 * major, so PR #105 held the rule at "warn" GLOBALLY - which left every new
 * component unguarded too, since `npm run lint` is `eslint .` with no
 * `--max-warnings`, so a warning has never failed the Linting gate.
 *
 * This list inverts that: new code is gated, the known sites are not. Two of
 * the original 14 files (the portal register and reset-password pages, which
 * parsed their URL in a mount effect) were fixed outright, so the list starts
 * at 12 covering 15 sites. Nine are fetch-then-setState loaders whose real fix
 * is moving data loading out of effects; three read a localStorage-backed
 * store when a prop changes; three prune a selection set against freshly
 * loaded rows.
 *
 * **The list may only shrink.** `src/features/site/setStateInEffect.test.ts`
 * re-lints every entry and fails on one that no longer violates, so a fixed
 * file cannot silently keep its exemption. Per-site triage is tracked as the
 * DEP-MAJ-2 follow-up in the autodev portfolio backlog.
 */
const SET_STATE_IN_EFFECT_LEGACY = [
  'src/features/crm/AccountsTab.tsx',
  'src/features/crm/ActivitiesTab.tsx',
  'src/features/crm/ContactsTab.tsx',
  'src/features/crm/OpportunitiesTab.tsx',
  'src/features/crm/ProjectsTab.tsx',
  'src/features/crm/SpendTab.tsx',
  'src/features/health/ServiceHealthIndicators.tsx',
  'src/features/onboarding/OnboardingChecklist.tsx',
  'src/features/support/SupportRequestPanel.tsx',
  'src/pages/AuditPage.tsx',
  'src/pages/PortalPage.tsx',
  'src/pages/ReportsPage.tsx',
]

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // `react-hooks/set-state-in-effect` is deliberately NOT listed here: it
      // stays at the recommended "error", so a new cascading-render effect
      // fails the Linting gate. The known pre-existing sites are exempted by
      // path in the next block, never globally.
    },
  },
  {
    files: SET_STATE_IN_EFFECT_LEGACY,
    rules: {
      // See SET_STATE_IN_EFFECT_LEGACY above. This list may only shrink, and
      // setStateInEffect.test.ts fails on an entry that no longer violates.
      'react-hooks/set-state-in-effect': 'warn',
    },
  },
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
])

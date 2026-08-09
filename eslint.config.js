import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

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
      // stays at the recommended "error" for EVERY file, so a cascading-render
      // effect fails the Linting gate. The path-scoped exemption list that
      // once held the legacy loaders at "warn" emptied and was deleted in
      // v1.23.2 (D-12; history in ROADMAP.md), and
      // src/features/site/setStateInEffect.test.ts asserts the mechanism
      // stays gone.
    },
  },
  {
    // eslint-plugin-react-refresh 0.5.x (DEP-REFRESH-1, filed 2026-08-04)
    // extended `only-export-components` to flag locally-declared,
    // never-exported component bindings too, including `lazy()` calls -
    // it did not check those under 0.4.x. `src/main.tsx` is the app's entry
    // point: it has ZERO module exports (nothing ever imports from it), so
    // the rule's actual concern - a Fast Refresh boundary getting confused
    // about what a file exports - cannot apply here regardless of how many
    // route components or lazy() bindings it declares locally. Scoped to
    // this one file rather than three new per-line disables (on top of the
    // three that already existed for Root/LazyRoute/FailureMessage, now
    // redundant and removed) or a repo-wide rule change.
    files: ['src/main.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
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

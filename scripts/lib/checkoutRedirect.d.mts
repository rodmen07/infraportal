/**
 * Types for scripts/lib/checkoutRedirect.mjs.
 *
 * The generator scripts are plain node ESM (they run outside the Vite/TS
 * build), but `src/features/consulting/checkoutTier.test.ts` imports this
 * helper so the redirect URL the customer actually receives is tested against
 * the SAME code the generator runs, rather than against a copy that can drift.
 * `tsconfig.json` only includes `src`, so this declaration is what lets the
 * typecheck job resolve that one cross-boundary import.
 */
export declare function buildCheckoutRedirectUrl(
  baseUrl: string,
  params: Record<string, string>,
): string

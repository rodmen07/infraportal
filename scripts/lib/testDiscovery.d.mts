/**
 * Hand-written declarations for testDiscovery.mjs so the Vitest suites under
 * src/ (which tsc typechecks) can import the script module. Keep in sync with
 * the implementation next door — same arrangement as specSnapshot.d.mts.
 */

export type DiscoveryStatus =
  | 'ok'
  | 'missing-report'
  | 'unreadable-report'
  | 'foreign-report'
  | 'stale-report'
  | 'under-run'
  | 'unexpected-files'

export interface DiscoveryResult {
  status: DiscoveryStatus
  onDiskCount: number
  reportedCount: number
  reportPath: string
  missing: string[]
  unexpected: string[]
  foreign: string[]
  ageMs?: number
  detail?: string
}

export interface VitestJsonReport {
  startTime?: unknown
  testResults?: unknown
  [key: string]: unknown
}

export declare const TEST_REPORT_PATH: string
export declare const INCLUDE_GLOBS: string[]
export declare const MAX_REPORT_AGE_MS: number
export declare const STATUSES: readonly DiscoveryStatus[]

export declare function relativeToRoot(absPath: string, root: string): string | null

export declare function discoverTestFilesOnDisk(root: string, globs?: string[]): string[]

export declare function reportedTestFiles(
  report: VitestJsonReport,
  root: string,
): { files: string[]; foreign: string[] }

export declare function compareDiscovery(input: {
  onDisk: string[]
  reported: string[]
}): { ok: boolean; missing: string[]; unexpected: string[] }

export declare function checkTestDiscovery(options?: {
  root: string
  reportPath?: string
  now?: number
  maxAgeMs?: number
  globs?: string[]
}): DiscoveryResult

export declare function formatResult(result: DiscoveryResult): string

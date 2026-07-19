/**
 * Hand-written declarations for specSnapshot.mjs so the Vitest suites under
 * src/ (which tsc typechecks) can import the script module. Keep in sync
 * with the implementation next door.
 */

export declare const SERVICE_IDS: string[]
export declare const MANIFEST_FILE_NAME: string
export declare const MANIFEST_NOTE: string

export declare function specFileName(id: string): string

export declare function countOperations(spec: { paths?: Record<string, unknown> }): number

export interface SnapshotSource {
  id: string
  text: string
  label?: string
}

export interface SnapshotManifestService {
  id: string
  name: string
  title: string
  version: string
  summary: string
  operationCount: number
  tags: string[]
}

export interface SnapshotBuild {
  files: Map<string, string>
  services: SnapshotManifestService[]
  totalOperations: number
}

export declare function buildSnapshotFiles(sources: SnapshotSource[]): SnapshotBuild

export type SnapshotComparisonStatus = 'match' | 'drift' | 'missing' | 'stale'

export interface SnapshotComparisonEntry {
  file: string
  status: SnapshotComparisonStatus
  freshBytes: number | null
  committedBytes: number | null
}

export interface SnapshotComparison {
  clean: boolean
  entries: SnapshotComparisonEntry[]
}

export declare function compareSnapshotDirs(freshDir: string, committedDir: string): SnapshotComparison

export declare function formatComparisonReport(report: SnapshotComparison): string[]

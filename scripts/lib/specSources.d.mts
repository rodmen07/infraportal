/**
 * Hand-written declarations for specSources.mjs so the Vitest suites under
 * src/ (which tsc typechecks) can import the script module. Keep in sync
 * with the implementation next door.
 */

export declare const RAW_BASE: string
export declare const DEFAULT_REF: string

export declare class SpecSourceError extends Error {
  constructor(message: string)
}

export interface SpecSource {
  id: string
  text: string
  label: string
}

export interface LoadedSpecSources {
  sources: SpecSource[]
  description: string
}

export interface ResolvedSpecSources extends LoadedSpecSources {
  source: 'local' | 'remote'
  ref: string
}

export declare function assertUsableSpecBody(text: string, label: string): void

export declare function parseSourceArgs(
  argv?: string[],
  env?: Record<string, string | undefined>,
): { source: 'local' | 'remote'; ref: string; dir: string | undefined }

export declare function loadLocalSources(options?: {
  repoRoot: string
  dir?: string
  env?: Record<string, string | undefined>
  serviceIds?: string[]
}): LoadedSpecSources

export declare function loadRemoteSources(options?: {
  ref?: string
  serviceIds?: string[]
  fetchImpl?: typeof fetch
}): Promise<LoadedSpecSources>

export declare function loadSpecSources(options?: {
  repoRoot: string
  argv?: string[]
  env?: Record<string, string | undefined>
  fetchImpl?: typeof fetch
}): Promise<ResolvedSpecSources>

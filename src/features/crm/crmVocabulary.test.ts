/**
 * Spec-drift guard for the CRM vocabularies (QA, 2026-08-05).
 *
 * The defect class this file exists for has shipped here before: the admin UI
 * offered deliverable statuses projects-service rejects (fixed in PR #29,
 * guarded since by `projectStatusVocabulary.test.ts`). The five CRM tabs
 * carried the same shape unguarded: hand-written status/stage/platform
 * literals that the services enforce server-side, with nothing failing when
 * `npm run sync-specs` pulls a vocabulary change upstream.
 *
 * This suite reads BOTH sources: the UI tuples in `vocabulary.ts` and the
 * committed OpenAPI snapshots in `src/api-specs/`. The schema/property scan
 * is DISCOVERED by walking every schema in the parsed spec rather than
 * hand-enumerating schema names, with a zero-match hard failure per
 * vocabulary, so an upstream schema ADDED with the same property (e.g. a new
 * request type carrying `status`) is swept in automatically instead of going
 * quietly unwatched.
 *
 * Free-form surfaces get SENTINELS: opportunities `stage` and activities
 * `activity_type` have no spec enum today, and the sentinel asserts exactly
 * that. The day upstream locks either vocabulary, the sentinel reddens and
 * the UI tuple gets locked to the new enum instead of silently drifting.
 */
import { describe, expect, it } from 'vitest'
import accountsSpec from '../../api-specs/accounts-service.json'
import activitiesSpec from '../../api-specs/activities-service.json'
import contactsSpec from '../../api-specs/contacts-service.json'
import opportunitiesSpec from '../../api-specs/opportunities-service.json'
import spendSpec from '../../api-specs/spend-service.json'
import { ACTIVITY_COLOR, LIFECYCLE_COLOR, STAGE_COLOR, STATUS_COLOR } from './ui'
import {
  ACCOUNT_STATUSES,
  ACTIVITY_TYPES,
  CONTACT_LIFECYCLE_STAGES,
  OPPORTUNITY_STAGES,
  PLATFORM_COLOR,
  PLATFORM_LABELS,
  SOURCE_COLOR,
  SPEND_GRANULARITIES,
  SPEND_PLATFORMS,
  SPEND_SOURCES,
  SYNC_PLATFORMS,
} from './vocabulary'

type Spec = {
  components?: {
    schemas?: Record<string, { properties?: Record<string, { enum?: unknown }> }>
  }
}

type DiscoveredEnum = { schema: string; property: string; values: string[] }

/**
 * Walks EVERY schema and EVERY property of a spec, collecting each enum it
 * finds. Discovery, not enumeration: a schema added upstream is included
 * without anyone editing this file.
 */
function discoverEnums(spec: Spec): DiscoveredEnum[] {
  const found: DiscoveredEnum[] = []
  for (const [schema, def] of Object.entries(spec.components?.schemas ?? {})) {
    for (const [property, prop] of Object.entries(def.properties ?? {})) {
      if (Array.isArray(prop.enum)) {
        found.push({ schema, property, values: prop.enum as string[] })
      }
    }
  }
  return found
}

/**
 * Every discovered enum for `property`, minus named exclusions (each
 * exclusion is itself asserted where it is declared, so it cannot rot into a
 * blind spot). Zero matches is a HARD FAILURE: an empty sweep means the spec
 * lost the vocabulary (or the property was renamed), not that the UI is
 * clean.
 */
function enumsFor(spec: Spec, property: string, exclude: string[] = []): DiscoveredEnum[] {
  const matches = discoverEnums(spec).filter(
    (e) => e.property === property && !exclude.includes(e.schema),
  )
  expect(
    matches.length,
    `no schema in the spec carries an enum on '${property}' - the guard has nothing to check`,
  ).toBeGreaterThan(0)
  return matches
}

describe('account status vocabulary is locked to the committed accounts spec', () => {
  // HealthResponse.status is the shared health shape, not the account
  // vocabulary; the exclusion is asserted so it stays what we think it is.
  it('the HealthResponse exclusion is really the health shape', () => {
    const health = discoverEnums(accountsSpec as Spec).filter((e) => e.schema === 'HealthResponse')
    expect(health).toEqual([{ schema: 'HealthResponse', property: 'status', values: ['ok', 'degraded'] }])
  })

  it('every status enum in the spec matches ACCOUNT_STATUSES in content and order', () => {
    const found = enumsFor(accountsSpec as Spec, 'status', ['HealthResponse'])
    // The vocabulary appears on the read, create, update AND list-query
    // shapes; fewer means the spec dropped one of them.
    expect(found.length).toBeGreaterThanOrEqual(4)
    for (const e of found) {
      expect(e.values, `${e.schema}.status`).toEqual([...ACCOUNT_STATUSES])
    }
  })

  it('every account status has a badge colour', () => {
    for (const s of ACCOUNT_STATUSES) {
      expect(STATUS_COLOR[s], `STATUS_COLOR.${s}`).toBeTruthy()
    }
  })
})

describe('contact lifecycle vocabulary is locked to the committed contacts spec', () => {
  it('every lifecycle_stage enum in the spec matches CONTACT_LIFECYCLE_STAGES', () => {
    const found = enumsFor(contactsSpec as Spec, 'lifecycle_stage')
    expect(found.length).toBeGreaterThanOrEqual(4)
    for (const e of found) {
      expect(e.values, `${e.schema}.lifecycle_stage`).toEqual([...CONTACT_LIFECYCLE_STAGES])
    }
  })

  it('every lifecycle stage has a badge colour', () => {
    for (const s of CONTACT_LIFECYCLE_STAGES) {
      expect(LIFECYCLE_COLOR[s], `LIFECYCLE_COLOR.${s}`).toBeTruthy()
    }
  })
})

describe('spend vocabularies are locked to the committed spend spec', () => {
  it('every platform enum in the spec matches SPEND_PLATFORMS in content and order', () => {
    // SyncResult.platform is the deliberately smaller syncable subset,
    // asserted separately below.
    const found = enumsFor(spendSpec as Spec, 'platform', ['SyncResult'])
    expect(found.length).toBeGreaterThanOrEqual(3)
    for (const e of found) {
      expect(e.values, `${e.schema}.platform`).toEqual([...SPEND_PLATFORMS])
    }
  })

  it('the sync buttons match the SyncResult.platform enum exactly', () => {
    const found = discoverEnums(spendSpec as Spec).filter((e) => e.schema === 'SyncResult' && e.property === 'platform')
    expect(found).toHaveLength(1)
    expect(found[0].values).toEqual([...SYNC_PLATFORMS])
  })

  it('every granularity enum in the spec matches SPEND_GRANULARITIES', () => {
    const found = enumsFor(spendSpec as Spec, 'granularity')
    expect(found.length).toBeGreaterThanOrEqual(2)
    for (const e of found) {
      expect(e.values, `${e.schema}.granularity`).toEqual([...SPEND_GRANULARITIES])
    }
  })

  it('every source enum in the spec matches SPEND_SOURCES', () => {
    const found = enumsFor(spendSpec as Spec, 'source')
    for (const e of found) {
      expect(e.values, `${e.schema}.source`).toEqual([...SPEND_SOURCES])
    }
  })

  it('every platform has a label and a badge colour; every source has a badge colour', () => {
    for (const p of SPEND_PLATFORMS) {
      expect(PLATFORM_LABELS[p], `PLATFORM_LABELS.${p}`).toBeTruthy()
      expect(PLATFORM_COLOR[p], `PLATFORM_COLOR.${p}`).toBeTruthy()
    }
    for (const s of SPEND_SOURCES) {
      expect(SOURCE_COLOR[s], `SOURCE_COLOR.${s}`).toBeTruthy()
    }
  })

  it('the syncable platforms are a strict subset of the spend platforms', () => {
    for (const p of SYNC_PLATFORMS) {
      expect([...SPEND_PLATFORMS], `SYNC_PLATFORMS contains '${p}'`).toContain(p)
    }
    expect(SYNC_PLATFORMS.length).toBeLessThan(SPEND_PLATFORMS.length)
  })
})

describe('free-form sentinels: surfaces the specs deliberately leave open', () => {
  // If either sentinel reddens, upstream has LOCKED the vocabulary: replace
  // the sentinel with an equality lock against the new enum (the account /
  // contact shape above) instead of loosening anything here.
  it('opportunities stage has no spec enum (UI ordering is a UI choice)', () => {
    const staged = discoverEnums(opportunitiesSpec as Spec).filter((e) => e.property === 'stage')
    expect(staged).toEqual([])
    // The tuple the UI offers is still colour-complete.
    for (const s of OPPORTUNITY_STAGES) {
      expect(STAGE_COLOR[s], `STAGE_COLOR.${s}`).toBeTruthy()
    }
  })

  it('activities activity_type has no spec enum (UI ordering is a UI choice)', () => {
    const typed = discoverEnums(activitiesSpec as Spec).filter((e) => e.property === 'activity_type')
    expect(typed).toEqual([])
    for (const t of ACTIVITY_TYPES) {
      expect(ACTIVITY_COLOR[t], `ACTIVITY_COLOR.${t}`).toBeTruthy()
    }
  })
})

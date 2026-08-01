// @vitest-environment jsdom
/**
 * Guard for the portal dashboard's three store-backed panels
 * (SET-STATE-RATCHET slice 1, 2026-08-01).
 *
 * `PortalPage` renders ServiceHealthIndicators, OnboardingChecklist and
 * SupportRequestPanel as siblings over the same two localStorage stores. Each
 * one copied its store into component state inside a mount effect keyed on
 * `projectId`, so a write from one panel was invisible to the other two until
 * the page remounted: completing the final onboarding step left the health
 * summary directly above the checklist still reading "83% complete", and
 * filing a support request left it still reading "No open requests". The three
 * were the `set-state-in-effect` exemption list's localStorage family.
 *
 * They now read through `useSyncExternalStore`. This file asserts the two
 * halves of that contract which a source scan cannot see -- that a write really
 * does reach a mounted reader, and that repeated reads of unchanged data return
 * the SAME reference (React bails out of a store whose snapshot getter returns
 * a fresh object per render) -- and then guards the source side so a future
 * panel cannot reintroduce the mirror. Contract C is what keeps the harness
 * below honest: it reads the component sources and the store sources, so the
 * derivation duplicated here cannot drift away from the one that ships.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { computeServiceHealth, type HealthIndicator } from '../health/serviceHealth'
import {
  DEFAULT_ONBOARDING_STEPS,
  getCompletedStepIdsSnapshot,
  onboardingPercentFor,
  setStepCompleted,
  subscribeToOnboardingStore,
} from '../onboarding/onboardingStore'
import {
  clearSupportRequests,
  createSupportRequest,
  getSupportRequestsSnapshot,
  removeSupportRequest,
  subscribeToSupportStore,
} from '../support/supportStore'

const PROJECT = 'project-under-test'
const OTHER_PROJECT = 'project-untouched'

const SRC = path.join(process.cwd(), 'src')
const read = (relative: string) => readFileSync(path.join(SRC, relative), 'utf-8')

const HEALTH_PANEL = 'features/health/ServiceHealthIndicators.tsx'
const ONBOARDING_STORE = 'features/onboarding/onboardingStore.ts'
const SUPPORT_STORE = 'features/support/supportStore.ts'

/** Every component that reads one of the two portal stores. */
const STORE_READERS = [
  HEALTH_PANEL,
  'features/onboarding/OnboardingChecklist.tsx',
  'features/support/SupportRequestPanel.tsx',
]

/** A snapshot getter is only safe to read if its store is also subscribed to. */
const SNAPSHOT_SUBSCRIPTIONS: ReadonlyArray<readonly [string, string]> = [
  ['getCompletedStepIdsSnapshot', 'subscribeToOnboardingStore'],
  ['getSupportRequestsSnapshot', 'subscribeToSupportStore'],
]

/**
 * The derivation ServiceHealthIndicators performs, driven through the exact
 * protocol `useSyncExternalStore` uses: read once, re-read on every
 * notification. Contract C asserts the component still computes it from these
 * same two functions.
 */
function readHealth(projectId: string): HealthIndicator[] {
  return computeServiceHealth({
    onboardingPercent: onboardingPercentFor(getCompletedStepIdsSnapshot(projectId).length),
    openSupportCount: getSupportRequestsSnapshot(projectId).filter((r) => r.status === 'open')
      .length,
  })
}

function mountHealthPanel(projectId: string) {
  let rereads = 0
  let snapshot = readHealth(projectId)

  const reread = () => {
    rereads += 1
    snapshot = readHealth(projectId)
  }

  const unsubscribes = [subscribeToOnboardingStore(reread), subscribeToSupportStore(reread)]

  return {
    indicator: (id: string) => snapshot.find((entry) => entry.id === id),
    rereads: () => rereads,
    unmount: () => unsubscribes.forEach((off) => off()),
  }
}

describe('portal store subscriptions', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  describe('contract A: a sibling panel\'s write reaches a mounted reader', () => {
    it('updates the health summary when the checklist completes onboarding', () => {
      const panel = mountHealthPanel(PROJECT)
      expect(panel.indicator('onboarding')).toMatchObject({
        level: 'pending',
        detail: '0% complete',
      })

      // Exactly what OnboardingChecklist's toggle does, one step at a time.
      for (const step of DEFAULT_ONBOARDING_STEPS) setStepCompleted(PROJECT, step.id, true)

      expect(panel.indicator('onboarding')).toMatchObject({
        level: 'good',
        detail: 'All launch steps complete',
      })
      panel.unmount()
    })

    it('updates the health summary when a support request is filed and withdrawn', () => {
      const panel = mountHealthPanel(PROJECT)
      expect(panel.indicator('support')).toMatchObject({
        level: 'good',
        detail: 'No open requests',
      })

      const request = createSupportRequest({
        projectId: PROJECT,
        category: 'Bug',
        subject: 'Checkout page is blank',
        message: 'Nothing renders after payment.',
      })
      expect(panel.indicator('support')).toMatchObject({
        level: 'attention',
        detail: '1 open request',
      })

      removeSupportRequest(PROJECT, request.id)
      expect(panel.indicator('support')).toMatchObject({
        level: 'good',
        detail: 'No open requests',
      })
      panel.unmount()
    })

    it('stops re-reading once the reader unmounts', () => {
      const panel = mountHealthPanel(PROJECT)
      setStepCompleted(PROJECT, DEFAULT_ONBOARDING_STEPS[0].id, true)
      const before = panel.rereads()
      expect(before).toBeGreaterThan(0)

      panel.unmount()
      setStepCompleted(PROJECT, DEFAULT_ONBOARDING_STEPS[1].id, true)
      createSupportRequest({
        projectId: PROJECT,
        category: 'Question',
        subject: 'After unmount',
        message: 'Should not be observed.',
      })

      expect(panel.rereads()).toBe(before)
    })
  })

  describe('contract B: snapshots are reference-stable while the bytes are', () => {
    it('returns the same onboarding array for repeated reads', () => {
      setStepCompleted(PROJECT, DEFAULT_ONBOARDING_STEPS[0].id, true)
      expect(getCompletedStepIdsSnapshot(PROJECT)).toBe(getCompletedStepIdsSnapshot(PROJECT))
    })

    it('returns the same support array for repeated reads', () => {
      createSupportRequest({
        projectId: PROJECT,
        category: 'Maintenance',
        subject: 'Rotate certificates',
        message: 'Before the renewal window.',
      })
      expect(getSupportRequestsSnapshot(PROJECT)).toBe(getSupportRequestsSnapshot(PROJECT))
    })

    it('returns a new reference after a write to that project', () => {
      const before = getCompletedStepIdsSnapshot(PROJECT)
      setStepCompleted(PROJECT, DEFAULT_ONBOARDING_STEPS[0].id, true)
      expect(getCompletedStepIdsSnapshot(PROJECT)).not.toBe(before)
    })

    it('leaves another project\'s snapshot untouched, so a broad notification is a no-op', () => {
      const untouched = getCompletedStepIdsSnapshot(OTHER_PROJECT)
      const untouchedRequests = getSupportRequestsSnapshot(OTHER_PROJECT)

      setStepCompleted(PROJECT, DEFAULT_ONBOARDING_STEPS[0].id, true)
      createSupportRequest({
        projectId: PROJECT,
        category: 'Change request',
        subject: 'Add a staging domain',
        message: 'Same shape as production.',
      })

      expect(getCompletedStepIdsSnapshot(OTHER_PROJECT)).toBe(untouched)
      expect(getSupportRequestsSnapshot(OTHER_PROJECT)).toBe(untouchedRequests)
    })

    it('reflects a cleared project on the next read', () => {
      createSupportRequest({
        projectId: PROJECT,
        category: 'Bug',
        subject: 'Cleared later',
        message: 'Then gone.',
      })
      expect(getSupportRequestsSnapshot(PROJECT)).toHaveLength(1)

      clearSupportRequests(PROJECT)
      expect(getSupportRequestsSnapshot(PROJECT)).toEqual([])
    })
  })

  describe('contract C: the shipped sources still hold up both ends', () => {
    const unsubscribedSnapshots = (source: string) =>
      SNAPSHOT_SUBSCRIPTIONS.filter(
        ([snapshot, subscribe]) => source.includes(snapshot) && !source.includes(subscribe),
      ).map(([snapshot]) => snapshot)

    it('reads every store panel through useSyncExternalStore', () => {
      for (const reader of STORE_READERS) {
        expect(read(reader)).toContain('useSyncExternalStore')
      }
    })

    it('mirrors no store into state inside an effect', () => {
      // The exact shape that caused the defect: the panels hold no effect at
      // all now, so the rule cannot come back through the same door.
      for (const reader of STORE_READERS) {
        expect(read(reader)).not.toMatch(/\buseEffect\b/)
      }
    })

    it('reads the snapshot getters rather than the plain getters', () => {
      for (const reader of STORE_READERS) {
        const source = read(reader)
        expect(source).not.toMatch(/\bgetCompletedStepIds\s*\(/)
        expect(source).not.toMatch(/\bgetSupportRequests\s*\(/)
      }
    })

    it('subscribes to every store it snapshots', () => {
      const offenders = STORE_READERS.filter(
        (reader) => unsubscribedSnapshots(read(reader)).length > 0,
      )
      expect(offenders).toEqual([])
    })

    it('rejects a reader that snapshots without subscribing (negative control)', () => {
      // Without this the assertion above could pass by matching nothing.
      const synthetic = `
        export function Rogue({ projectId }: { projectId: string }) {
          const rows = getSupportRequestsSnapshot(projectId)
          return rows.length
        }
      `
      expect(unsubscribedSnapshots(synthetic)).toEqual(['getSupportRequestsSnapshot'])
    })

    it('derives the health summary from the same two functions this file does', () => {
      const source = read(HEALTH_PANEL)
      expect(source).toContain('computeServiceHealth(')
      expect(source).toContain('onboardingPercentFor(')
      expect(source).toContain("status === 'open'")
    })

    it('exports a subscription and a snapshot from both stores', () => {
      const onboarding = read(ONBOARDING_STORE)
      expect(onboarding).toContain('export const subscribeToOnboardingStore')
      expect(onboarding).toContain('export function getCompletedStepIdsSnapshot')

      const support = read(SUPPORT_STORE)
      expect(support).toContain('export const subscribeToSupportStore')
      expect(support).toContain('export function getSupportRequestsSnapshot')
    })

    it('notifies subscribers from every localStorage write in both stores', () => {
      // The ratchet that matters most: a mutator added later without a notify
      // reopens exactly this defect, and no runtime test would name it.
      for (const store of [ONBOARDING_STORE, SUPPORT_STORE]) {
        const source = read(store)
        const writes = source.match(/window\.localStorage\.(setItem|removeItem)\(/g) ?? []
        const notifies = source.match(/subscription\.notify\(\)/g) ?? []
        expect(writes.length).toBeGreaterThan(0)
        expect({ store, notifies: notifies.length }).toEqual({
          store,
          notifies: writes.length,
        })
      }
    })
  })

  describe('contract D: a write in another tab reaches this one', () => {
    const prefixOf = (relative: string) => {
      const match = /const STORAGE_PREFIX = '([^']+)'/.exec(read(relative))
      if (!match) throw new Error(`STORAGE_PREFIX not found in ${relative}`)
      return match[1]
    }

    it('notifies on a key the store owns, ignores one it does not', () => {
      let calls = 0
      const off = subscribeToSupportStore(() => {
        calls += 1
      })

      window.dispatchEvent(
        new StorageEvent('storage', { key: `${prefixOf(SUPPORT_STORE)}${PROJECT}` }),
      )
      expect(calls).toBe(1)

      window.dispatchEvent(
        new StorageEvent('storage', { key: `${prefixOf(ONBOARDING_STORE)}${PROJECT}` }),
      )
      expect(calls).toBe(1)

      // A null key is another tab calling localStorage.clear().
      window.dispatchEvent(new StorageEvent('storage', { key: null }))
      expect(calls).toBe(2)

      off()
      window.dispatchEvent(
        new StorageEvent('storage', { key: `${prefixOf(SUPPORT_STORE)}${PROJECT}` }),
      )
      expect(calls).toBe(2)
    })

    it('uses distinct prefixes, so the two stores cannot notify for each other', () => {
      expect(prefixOf(SUPPORT_STORE)).not.toBe(prefixOf(ONBOARDING_STORE))
    })
  })
})

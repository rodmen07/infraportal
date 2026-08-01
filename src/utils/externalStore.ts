/**
 * The subscription and snapshot seam the localStorage-backed portal stores need
 * in order to be read with `useSyncExternalStore`.
 *
 * The client portal renders three sibling panels over the same two stores
 * (ServiceHealthIndicators, OnboardingChecklist, SupportRequestPanel). Each one
 * used to copy its store into component state inside a mount effect keyed on
 * `projectId`, so a write made by one panel was invisible to the other two
 * until the page remounted: ticking the last onboarding step left the health
 * panel still reading "83% complete", and filing a support request left it
 * still reading "No open requests".
 *
 * A store can only be subscribed to if it says when it changed, and it can only
 * be read on every render if repeated reads of unchanged data return the SAME
 * reference. This module supplies both halves; the stores own the keys.
 */

export type StoreListener = () => void

export interface StoreSubscription {
  /** Subscribe in the shape `useSyncExternalStore` expects; returns an unsubscribe. */
  subscribe: (listener: StoreListener) => () => void
  /** Called by the store's own writers, after the underlying value changed. */
  notify: () => void
}

/**
 * Creates a subscription for one store, identified by the localStorage keys it
 * owns.
 *
 * The `storage` listener is attached only while somebody is subscribed, and it
 * covers the second direction these panels can drift: a write made in another
 * tab (the admin support queue resolving a request, say) reaches this tab's
 * readers too, which the old mount effects could never do.
 */
export function createStoreSubscription(ownsKey: (key: string) => boolean): StoreSubscription {
  const listeners = new Set<StoreListener>()

  // Iterate a copy: a listener is allowed to unsubscribe while being notified.
  const notify = () => {
    for (const listener of [...listeners]) listener()
  }

  const onStorage = (event: StorageEvent) => {
    // A null key is `localStorage.clear()` in another tab, which invalidates
    // every key this store owns.
    if (event.key === null || ownsKey(event.key)) notify()
  }

  const subscribe = (listener: StoreListener) => {
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.addEventListener('storage', onStorage)
    }
    listeners.add(listener)

    return () => {
      listeners.delete(listener)
      if (listeners.size === 0 && typeof window !== 'undefined') {
        window.removeEventListener('storage', onStorage)
      }
    }
  }

  return { subscribe, notify }
}

/**
 * Wraps a store read in a cache keyed on the exact serialized bytes it came
 * from.
 *
 * `useSyncExternalStore` calls the snapshot getter on every render and bails
 * out with "The result of getSnapshot should be cached" when a fresh object
 * comes back each time, so re-parsing per render is not merely wasteful, it
 * loops. Keying on the raw string makes the cache exactly as fresh as the data
 * and needs no equality function to stay honest: identical bytes parse to an
 * identical value, so the previous reference is returned; different bytes
 * recompute.
 */
export function createRawSnapshotCache<T>(compute: (id: string) => T) {
  const cache = new Map<string, { raw: string; value: T }>()

  return (id: string, raw: string): T => {
    const cached = cache.get(id)
    if (cached && cached.raw === raw) return cached.value

    const value = compute(id)
    cache.set(id, { raw, value })
    return value
  }
}

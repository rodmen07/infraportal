// Pure navigation helpers for the guided tour. Separated from the step data and
// the React component so the stepping logic is deterministic and unit-testable.

/** Clamp an arbitrary index into `[0, length - 1]` (or 0 for an empty tour). */
export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0
  if (index < 0) return 0
  if (index > length - 1) return length - 1
  return index
}

/** The next index, clamped so advancing past the end stays on the last step. */
export function nextIndex(index: number, length: number): number {
  return clampIndex(index + 1, length)
}

/** The previous index, clamped so going back past the start stays on the first step. */
export function prevIndex(index: number, length: number): number {
  return clampIndex(index - 1, length)
}

export function isFirst(index: number): boolean {
  return index <= 0
}

export function isLast(index: number, length: number): boolean {
  return index >= length - 1
}

/** A 1-based progress label, e.g. "Step 2 of 6". */
export function progressLabel(index: number, length: number): string {
  return `Step ${clampIndex(index, length) + 1} of ${length}`
}

import { useEffect, useState } from 'react'

/**
 * Track the user's `prefers-reduced-motion` setting reactively. Returns `true`
 * when the user has asked for reduced motion, so callers can drop pulses,
 * spinners, and transitions. SSR/test-safe: falls back to `false` when
 * `matchMedia` is unavailable.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}

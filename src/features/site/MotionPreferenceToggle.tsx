import { useEffect, useState } from 'react'

// v1.18.3 (D6): relocated out of the hero slide-over. The hero used to hide
// this control behind a pulsing gradient badge that competed with the
// booking CTA (finding F6); the control itself is unchanged; only its home
// moved to the About page, a lower-intent surface where an extra "replay the
// entrance animations" preference fits better than on the primary
// conversion path.
//
// This is additive motion only: prefers-reduced-motion (src/index.css) is
// the one authority that turns animation off, honored globally regardless
// of this checkbox. Turning this on only replays the one-time `.reveal`-
// family entrances already present on the page; it never re-enables motion
// for a visitor who has asked their system for less of it.
export function MotionPreferenceToggle() {
  const [motionEnabled, setMotionEnabled] = useState<boolean>(false)

  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return
    const saved = localStorage.getItem('motionEnabled')
    const enabled = saved === '1'
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMotionEnabled(enabled)
    if (enabled) document.documentElement.setAttribute('data-motion', 'full')
    else document.documentElement.removeAttribute('data-motion')
  }, [])

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      if (motionEnabled) localStorage.setItem('motionEnabled', '1')
      else localStorage.removeItem('motionEnabled')

      if (motionEnabled) document.documentElement.setAttribute('data-motion', 'full')
      else document.documentElement.removeAttribute('data-motion')

      // Replay the one-time entrance/overlay animations still in the DOM so
      // the toggle feels responsive. The infinite-loop classes it used to
      // also replay (pulse/float/wiggle/pop) were retired with the hero
      // badge in v1.18.3 and no longer exist anywhere in the app.
      const animClasses = ['reveal', 'slide-over-enter', 'overlay-fade']
      const selector = animClasses.map((c) => `.${c}`).join(',')
      const nodes = Array.from(document.querySelectorAll(selector)) as HTMLElement[]
      nodes.forEach((el) => {
        const present = animClasses.filter((c) => el.classList.contains(c))
        if (present.length === 0) return
        el.classList.remove(...present)
        // force reflow
        // eslint-disable-next-line @typescript-eslint/no-unused-expressions
        el.offsetWidth
        el.classList.add(...present)
      })
    } catch {
      // noop - error triggering reflow animation
    }
  }, [motionEnabled])

  return (
    <section className="surface-card rounded-2xl p-5">
      <p className="text-sm font-semibold text-text-primary">Animation preference</p>
      <p className="mt-1 text-xs leading-relaxed text-text-muted">
        This site keeps motion calm by default and always honors your system&apos;s reduced-motion setting.
        Turn this on to replay the page&apos;s entrance animations.
      </p>
      <label className="mt-3 flex items-center gap-2 text-sm text-text-secondary">
        <input
          type="checkbox"
          checked={motionEnabled}
          onChange={(e) => setMotionEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-border-soft bg-surface-1"
        />
        Enable extra animations
      </label>
    </section>
  )
}

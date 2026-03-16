import { useRef, useState, useEffect, useCallback } from 'react'

interface FocusCardProps {
  children: React.ReactNode
  className?: string
  /** Max rotateX angle (degrees) at full distance from center. Default 35. */
  maxAngle?: number
  /** Minimum opacity when fully rotated away. Default 0.38. */
  minOpacity?: number
  /** Distance (as fraction of vh) at which rotation/fade max out. Default 0.65. */
  fadeRadius?: number
}

/**
 * Full-viewport section that sits on a shared vertical wheel.
 * The perspective CSS property on the parent container (App.tsx) provides the
 * shared vanishing point — all cards rotate around the same cylinder axis.
 * translateZ pushes off-center cards back along the Z-axis for genuine depth.
 * A gradient overlay darkens the "far edge" to simulate a curved surface.
 * Respects prefers-reduced-motion.
 */
export function FocusCard({
  children,
  className,
  maxAngle = 35,
  minOpacity = 0.38,
  fadeRadius = 0.65,
}: FocusCardProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [sectionStyle, setSectionStyle] = useState<React.CSSProperties>({})
  const [gradient, setGradient] = useState('')
  const rafRef = useRef<number>(0)

  const update = useCallback(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const elementCenter = rect.top + rect.height / 2
    const viewportCenter = window.innerHeight / 2
    const maxDist = window.innerHeight * fadeRadius

    // positive → card is above center (top tilts away)
    // negative → card is below center (bottom tilts away)
    const signed = viewportCenter - elementCenter
    const t = Math.min(Math.abs(signed) / maxDist, 1)
    const angle = (signed / (maxDist || 1)) * maxAngle

    // Quadratic depth: cards further from center recede along the cylinder surface
    const depth = t * t * 120

    const opacity = 1 - t * (1 - minOpacity)
    const scale = 1 - t * 0.04

    setSectionStyle({
      opacity,
      // No CSS transition on transform — scroll-driven, must be immediate
      transform: `rotateX(${angle}deg) translateZ(${-depth}px) scale(${scale})`,
      transition: 'opacity 150ms ease',
    })

    // Gradient darkens the "far edge" to simulate a curved cylinder surface
    const overlayAlpha = (t * 0.28).toFixed(3)
    if (t < 0.04) {
      setGradient('')
    } else if (angle > 0) {
      // Top is tilting away — darken the top edge
      setGradient(`linear-gradient(to top, transparent 55%, rgba(0,0,0,${overlayAlpha}))`)
    } else {
      // Bottom is tilting away — darken the bottom edge
      setGradient(`linear-gradient(to bottom, transparent 55%, rgba(0,0,0,${overlayAlpha}))`)
    }
  }, [maxAngle, minOpacity, fadeRadius])

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const onScroll = () => {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = requestAnimationFrame(update)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', update)
    update()

    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', update)
      cancelAnimationFrame(rafRef.current)
    }
  }, [update])

  return (
    <div
      ref={ref}
      style={sectionStyle}
      className={`min-h-[120vh] flex items-center justify-center py-12 focus-card-section ${className ?? ''}`}
    >
      <div className="relative w-full">
        {children}
        {gradient && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 rounded-3xl"
            style={{ background: gradient }}
          />
        )}
      </div>
    </div>
  )
}

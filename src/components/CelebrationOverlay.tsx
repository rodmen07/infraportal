import { useEffect, useMemo, useState } from 'react'

interface CelebrationOverlayProps {
  trigger: number
}

const EMBER_COUNT = 44
const SPARK_COUNT = 18

export function CelebrationOverlay({ trigger }: CelebrationOverlayProps) {
  const [active, setActive] = useState(false)

  const embers = useMemo(
    () =>
      Array.from({ length: EMBER_COUNT }, (_, index) => ({
        id: index,
        left: ((index * 13) % 100) + '%',
        delay: ((index % 11) * 0.06).toFixed(2) + 's',
        duration: (1.7 + (index % 6) * 0.16).toFixed(2) + 's',
        drift: ((index % 7) - 3).toString(),
      })),
    [],
  )

  const sparks = useMemo(
    () =>
      Array.from({ length: SPARK_COUNT }, (_, index) => ({
        id: index,
        left: ((index * 19 + 7) % 100) + '%',
        delay: ((index % 9) * 0.09).toFixed(2) + 's',
        duration: (0.72 + (index % 4) * 0.08).toFixed(2) + 's',
      })),
    [],
  )

  useEffect(() => {
    if (!trigger) {
      return
    }

    setActive(true)
    const timerId = window.setTimeout(() => {
      setActive(false)
    }, 2600)

    return () => {
      window.clearTimeout(timerId)
    }
  }, [trigger])

  if (!active) {
    return null
  }

  return (
    <div className="celebration-layer" aria-hidden="true">
      <div className="celebration-forge-flare">
        <span className="forge-flare-ring ring-left" />
        <span className="forge-flare-ring ring-center" />
        <span className="forge-flare-ring ring-right" />
      </div>

      {sparks.map((spark) => (
        <span
          key={spark.id}
          className="celebration-spark"
          style={{
            left: spark.left,
            animationDelay: spark.delay,
            animationDuration: spark.duration,
          }}
        />
      ))}

      {embers.map((ember) => (
        <span
          key={ember.id}
          className="celebration-ember"
          style={{
            left: ember.left,
            animationDelay: ember.delay,
            animationDuration: ember.duration,
            ['--ember-drift' as string]: ember.drift,
          }}
        />
      ))}
    </div>
  )
}

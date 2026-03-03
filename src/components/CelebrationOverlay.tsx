import { useEffect, useMemo, useState } from 'react'

interface CelebrationOverlayProps {
  trigger: number
}

const CONFETTI_COUNT = 42

export function CelebrationOverlay({ trigger }: CelebrationOverlayProps) {
  const [active, setActive] = useState(false)

  const confettiPieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_COUNT }, (_, index) => ({
        id: index,
        left: ((index * 17) % 100) + '%',
        delay: ((index % 12) * 0.08).toFixed(2) + 's',
        duration: (2.6 + (index % 5) * 0.2).toFixed(2) + 's',
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
      <div className="celebration-fireworks">
        <span className="celebration-firework firework-left" />
        <span className="celebration-firework firework-center" />
        <span className="celebration-firework firework-right" />
      </div>

      {confettiPieces.map((piece) => (
        <span
          key={piece.id}
          className="celebration-confetti"
          style={{
            left: piece.left,
            animationDelay: piece.delay,
            animationDuration: piece.duration,
          }}
        />
      ))}
    </div>
  )
}

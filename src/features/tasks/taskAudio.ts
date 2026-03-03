interface ToneStep {
  frequency: number
  startOffset: number
  duration: number
  type: OscillatorType
  gain: number
}

function playToneSequence(steps: ToneStep[]): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const audioContext = new window.AudioContext()
    for (const step of steps) {
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      const startTime = audioContext.currentTime + step.startOffset
      const endTime = startTime + step.duration

      oscillator.type = step.type
      oscillator.frequency.setValueAtTime(step.frequency, startTime)

      gainNode.gain.setValueAtTime(0.0001, startTime)
      gainNode.gain.exponentialRampToValueAtTime(step.gain, startTime + 0.02)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime)

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      oscillator.start(startTime)
      oscillator.stop(endTime)
    }

    const totalDuration = Math.max(
      ...steps.map((step) => step.startOffset + step.duration),
      0,
    )

    window.setTimeout(() => {
      void audioContext.close()
    }, Math.ceil((totalDuration + 0.3) * 1000))
  } catch {
  }
}

export function playTaskCompletionSound(): void {
  playToneSequence([
    { frequency: 318, startOffset: 0, duration: 0.08, type: 'square', gain: 0.07 },
    { frequency: 642, startOffset: 0.006, duration: 0.1, type: 'triangle', gain: 0.06 },
    { frequency: 960, startOffset: 0.014, duration: 0.07, type: 'sawtooth', gain: 0.035 },
    { frequency: 214, startOffset: 0.08, duration: 0.16, type: 'triangle', gain: 0.02 },
  ])
}

export function playCelebrationSound(): void {
  playToneSequence([
    { frequency: 254, startOffset: 0, duration: 0.2, type: 'triangle', gain: 0.04 },
    { frequency: 508, startOffset: 0.01, duration: 0.13, type: 'square', gain: 0.055 },
    { frequency: 774, startOffset: 0.02, duration: 0.11, type: 'sawtooth', gain: 0.03 },
    { frequency: 212, startOffset: 0.2, duration: 0.32, type: 'triangle', gain: 0.022 },
    { frequency: 284, startOffset: 0.32, duration: 0.18, type: 'square', gain: 0.04 },
    { frequency: 568, startOffset: 0.332, duration: 0.1, type: 'triangle', gain: 0.035 },
    { frequency: 860, startOffset: 0.34, duration: 0.08, type: 'sawtooth', gain: 0.02 },
    { frequency: 188, startOffset: 0.5, duration: 0.34, type: 'triangle', gain: 0.018 },
  ])
}

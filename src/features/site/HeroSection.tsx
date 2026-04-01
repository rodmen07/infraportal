import { useState, useEffect } from 'react'
import type { SiteContent } from '../../types'
import { SlideOver } from './SlideOver'

interface HeroSectionProps {
  content: SiteContent
}

export function HeroSection({ content }: HeroSectionProps) {
  const [open, setOpen] = useState(false)
  const tagline = content.heroTagline || 'AI + Cloud Launchpad'
  const [motionEnabled, setMotionEnabled] = useState<boolean>(false)

  useEffect(() => {
    const saved = typeof window !== 'undefined' ? localStorage.getItem('motionEnabled') : null
    const enabled = saved === '1'
    setMotionEnabled(enabled)
    if (typeof document !== 'undefined') {
      if (enabled) document.documentElement.setAttribute('data-motion', 'full')
      else document.documentElement.removeAttribute('data-motion')
    }
  }, [])

  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      if (motionEnabled) localStorage.setItem('motionEnabled', '1')
      else localStorage.removeItem('motionEnabled')

      if (motionEnabled) document.documentElement.setAttribute('data-motion', 'full')
      else document.documentElement.removeAttribute('data-motion')

      // replay animations on toggle
      const animClasses = ['reveal', 'animate-pulse-strong', 'animate-float-slow', 'animate-wiggle', 'animate-pop', 'slide-over-enter', 'overlay-fade']
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
    } catch (e) {
      // noop
    }
  }, [motionEnabled])

  return (
    <>
      <header className="forge-panel rounded-3xl border border-amber-300/20 bg-zinc-900/80 p-8 text-center shadow-2xl shadow-black/50 backdrop-blur-xl sm:p-12">
        <button
          onClick={() => setOpen(true)}
          className="reveal mb-6 inline-flex items-center justify-center rounded-full bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-500 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white shadow-lg shadow-rose-500/30 hover:brightness-105 active:scale-95 animate-pulse-strong glow-ring"
        >
          <span className="mr-2 animate-wiggle">✨</span>
          {tagline}
        </button>

        <h1 className="reveal animate-float-slow text-3xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
          {content.title}
        </h1>
        <p className="reveal reveal-delay-1 mx-auto mt-4 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
          {content.subtitle}
        </p>
        <div className="reveal reveal-delay-2 mt-8 flex flex-wrap justify-center gap-3">
          <a
            href="#/case-studies"
            className="rounded-xl border border-amber-400/40 bg-amber-500/15 px-5 py-2.5 text-sm font-semibold text-amber-200 transition hover:border-amber-400/60 hover:bg-amber-500/25 hover:text-amber-100 animate-pop"
          >
            See the work →
          </a>
          <a
            href="#/contact"
            className="rounded-xl border border-zinc-600/50 bg-zinc-800/60 px-5 py-2.5 text-sm font-semibold text-zinc-300 transition hover:border-zinc-500/60 hover:bg-zinc-700/60 hover:text-zinc-100 animate-pop"
          >
            Book a free call →
          </a>
        </div>
      </header>

      <SlideOver open={open} onClose={() => setOpen(false)} title={tagline}>
        <p>
          I help startup teams ship fast on AWS + GCP with Terraform, Databricks-ready
          data foundations, and production-grade engineering from day one.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              checked={motionEnabled}
              onChange={(e) => setMotionEnabled(e.target.checked)}
              className="h-4 w-4 rounded bg-zinc-800 border-zinc-600"
            />
            Enable animations (override system)
          </label>
          <button
            type="button"
            onClick={() => setMotionEnabled((s) => !s)}
            className="btn-neutral"
          >
            Toggle
          </button>
        </div>

        <div className="mt-4 flex gap-2">
          <a href="#/case-studies" className="btn-accent">
            See the work
          </a>
          <a href="#/contact" className="btn-neutral">
            Book a free call
          </a>
        </div>
      </SlideOver>
    </>
  )
}

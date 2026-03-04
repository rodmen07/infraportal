import { useState } from 'react'
import type { FaqContent } from '../../types'

interface FaqSectionProps {
  content: FaqContent
}

export function FaqSection({ content }: FaqSectionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  if (!content.items.length) {
    return null
  }

  return (
    <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <h2 className="mb-4 text-center text-xl font-semibold text-white">{content.title}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {content.items.map((item, index) => (
          <article key={item.question} className="rounded-xl border border-zinc-500/35 bg-zinc-800/70 p-4 transition hover:border-amber-300/40">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 text-left"
              onClick={() => setOpenIndex((current) => (current === index ? null : index))}
              aria-expanded={openIndex === index}
            >
              <h3 className="text-sm font-semibold text-amber-200">{item.question}</h3>
              <span className="text-xs text-zinc-400">{openIndex === index ? '−' : '+'}</span>
            </button>
            <div className={`overflow-hidden transition-all duration-300 ${openIndex === index ? 'mt-2 max-h-44 opacity-100' : 'max-h-0 opacity-0'}`}>
              <p className="text-sm text-zinc-300">{item.answer}</p>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

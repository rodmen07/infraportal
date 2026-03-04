import type { FaqContent } from '../../types'

interface FaqSectionProps {
  content: FaqContent
}

export function FaqSection({ content }: FaqSectionProps) {
  if (!content.items.length) {
    return null
  }

  return (
    <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <h2 className="mb-4 text-center text-xl font-semibold text-white">{content.title}</h2>
      <div className="grid gap-3 md:grid-cols-2">
        {content.items.map((item) => (
          <article key={item.question} className="rounded-xl border border-zinc-500/35 bg-zinc-800/70 p-4">
            <h3 className="text-sm font-semibold text-amber-200">{item.question}</h3>
            <p className="mt-2 text-sm text-zinc-300">{item.answer}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

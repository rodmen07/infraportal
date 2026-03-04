import type { HomeSectionsContent } from '../../types'

interface HomeSectionsProps {
  content: HomeSectionsContent
}

export function HomeSections({ content }: HomeSectionsProps) {
  if (!content.cards.length) {
    return null
  }

  return (
    <section className="forge-panel rounded-3xl border border-zinc-500/30 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <h2 className="mb-4 text-center text-xl font-semibold text-white">{content.title}</h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {content.cards.map((card) => (
          <article key={card.heading} className="interactive-card rounded-xl border border-zinc-500/35 bg-zinc-800/70 p-4 text-center">
            {card.image && (
              <img
                src={card.image}
                alt={card.heading}
                className="mx-auto mb-3 h-28 w-full rounded-lg border border-zinc-500/35 object-cover"
                loading="lazy"
              />
            )}
            <h3 className="text-sm font-semibold text-amber-200">{card.heading}</h3>
            <p className="mt-2 text-sm text-zinc-300">{card.body}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

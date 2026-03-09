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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {content.cards.map((card) => (
          <article key={card.heading} className="interactive-card flex flex-col rounded-xl border border-zinc-500/35 bg-zinc-800/70 p-4 text-center">
            {card.image && (
              <img
                src={card.image}
                alt={card.heading}
                className="mx-auto mb-3 h-28 w-full rounded-lg border border-zinc-500/35 object-cover"
                loading="lazy"
              />
            )}
            <h3 className="text-sm font-semibold text-amber-200">{card.heading}</h3>
            <p className="mt-2 flex-1 text-sm text-zinc-300">{card.body}</p>
            {card.link && (
              <a
                href={card.link}
                className="mt-4 inline-block rounded-lg border border-zinc-600/50 bg-zinc-700/50 px-3 py-1.5 text-xs font-medium text-zinc-300 transition hover:border-zinc-500/60 hover:bg-zinc-600/60 hover:text-white"
              >
                Learn more →
              </a>
            )}
          </article>
        ))}
      </div>
    </section>
  )
}

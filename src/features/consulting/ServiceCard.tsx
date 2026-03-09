import type { ServiceItem } from '../../types'

export function ServiceCard({ title, description, tags }: ServiceItem) {
  return (
    <article className="surface-card interactive-card flex flex-col gap-3 rounded-xl p-5 reveal">
      <h3 className="text-sm font-semibold leading-tight text-amber-200">{title}</h3>
      <p className="flex-1 text-sm leading-relaxed text-zinc-300">{description}</p>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span key={tag} className="fx-chip">
              {tag}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}

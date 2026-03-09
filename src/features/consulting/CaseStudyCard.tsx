import type { CaseStudy } from '../../types'

interface CaseStudyCardProps extends CaseStudy {
  featured?: boolean
}

export function CaseStudyCard({ title, subtitle, description, techStack, highlights, githubUrl, detailUrl, featured }: CaseStudyCardProps) {
  return (
    <article className={`forge-panel surface-card interactive-card flex flex-col gap-5 p-6 ${featured ? 'shadow-2xl shadow-black/40' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold leading-tight text-white">{title}</h3>
          <p className="mt-1 text-sm text-amber-300/85">{subtitle}</p>
        </div>
        <div className="flex shrink-0 gap-2">
          {detailUrl && (
            <a
              href={detailUrl}
              className="btn-accent px-3 py-1.5 text-xs"
            >
              View case study →
            </a>
          )}
          {githubUrl && (
            <a
              href={githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-neutral px-3 py-1.5 text-xs"
            >
              GitHub →
            </a>
          )}
        </div>
      </div>

      <p className="text-sm leading-relaxed text-zinc-300">{description}</p>

      {highlights.length > 0 && (
        <ul className="flex flex-col gap-2">
          {highlights.map((h) => (
            <li key={h} className="flex items-start gap-2 text-sm leading-relaxed text-zinc-400">
              <span className="mt-[1px] shrink-0 text-amber-400">›</span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
      )}

      {techStack.length > 0 && (
        <div className="flex flex-wrap gap-2 border-t border-zinc-700/40 pt-4">
          {techStack.map((tech) => (
            <span key={tech} className="fx-chip">
              {tech}
            </span>
          ))}
        </div>
      )}
    </article>
  )
}

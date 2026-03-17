/**
 * Lightweight markdown renderer for AI consulting responses.
 * Handles: **bold**, *italic*, `code`, bullet lists (- or •), and paragraph breaks.
 * No external dependency — keeps the bundle lean.
 */

type Segment = { type: 'text' | 'bold' | 'italic' | 'code'; content: string }

function parseInline(text: string): Segment[] {
  const segments: Segment[] = []
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g
  let last = 0
  let match: RegExpExecArray | null

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      segments.push({ type: 'text', content: text.slice(last, match.index) })
    }
    if (match[2] !== undefined) segments.push({ type: 'bold', content: match[2] })
    else if (match[3] !== undefined) segments.push({ type: 'italic', content: match[3] })
    else if (match[4] !== undefined) segments.push({ type: 'code', content: match[4] })
    last = match.index + match[0].length
  }

  if (last < text.length) segments.push({ type: 'text', content: text.slice(last) })
  return segments
}

function renderInline(text: string) {
  return parseInline(text).map((seg, i) => {
    if (seg.type === 'bold') return <strong key={i} className="font-semibold text-zinc-100">{seg.content}</strong>
    if (seg.type === 'italic') return <em key={i} className="italic">{seg.content}</em>
    if (seg.type === 'code') return <code key={i} className="rounded bg-zinc-700/60 px-1 py-0.5 font-mono text-xs text-amber-300">{seg.content}</code>
    return <span key={i}>{seg.content}</span>
  })
}

interface Props {
  content: string
  className?: string
}

export function MarkdownResponse({ content, className = '' }: Props) {
  // Split into blocks on blank lines
  const blocks = content.split(/\n{2,}/)

  return (
    <div className={`space-y-3 ${className}`}>
      {blocks.map((block, bi) => {
        const lines = block.split('\n').map(l => l.trim()).filter(Boolean)
        if (lines.length === 0) return null

        // Bullet list block — all lines start with - or •
        const allBullets = lines.every(l => /^[-•]\s/.test(l))
        if (allBullets) {
          return (
            <ul key={bi} className="space-y-1 pl-4">
              {lines.map((line, li) => (
                <li key={li} className="flex gap-2 text-sm leading-relaxed text-zinc-200">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400/70" />
                  <span>{renderInline(line.replace(/^[-•]\s/, ''))}</span>
                </li>
              ))}
            </ul>
          )
        }

        // Mixed block — join lines and render as paragraph
        const text = lines.join(' ')
        return (
          <p key={bi} className="text-sm leading-relaxed text-zinc-200">
            {renderInline(text)}
          </p>
        )
      })}
    </div>
  )
}

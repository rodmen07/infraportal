export function formatRelativeTime(iso: string): string {
  if (!iso) return ''
  const parsed = new Date(iso).getTime()
  if (!Number.isFinite(parsed)) return ''

  const diff = Date.now() - parsed
  if (diff <= 0) return 'just now'

  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

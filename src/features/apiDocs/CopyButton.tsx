/**
 * Small copy-to-clipboard button (v1.17.3), shared by the snippets section
 * and the per-operation "Copy link" affordance. Accepts either the text or a
 * lazy producer so link targets can read window.location at click time; no
 * browser global is touched during render, keeping the node-env render-smoke
 * suite happy.
 */

import { useState } from 'react'

export function CopyButton({
  text,
  label = 'Copy',
  copiedLabel = 'Copied',
}: {
  text: string | (() => string)
  label?: string
  copiedLabel?: string
}) {
  const [copied, setCopied] = useState(false)

  const copy = () => {
    const value = typeof text === 'function' ? text() : text
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
    if (!clipboard?.writeText) return
    clipboard
      .writeText(value)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {
        // Clipboard access denied; leave the label unchanged.
      })
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={`rounded border px-1.5 py-0.5 text-scale-xs transition ${
        copied
          ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
          : 'border-zinc-700/50 bg-zinc-800/60 text-text-muted hover:border-amber-400/40 hover:text-amber-200'
      }`}
    >
      {copied ? copiedLabel : label}
    </button>
  )
}

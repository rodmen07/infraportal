import { useState } from 'react'
import type { Task } from '../types'

interface GoalDiagramProps {
  goal: string
  tasks: Task[]
}

const BOARD_COLUMNS = 3
const LABEL_MAX_LENGTH = 72

interface BoardTile {
  step: number
  label: string
  completed: boolean
}

function normalizeLabel(value: string): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (compact.length <= LABEL_MAX_LENGTH) {
    return compact
  }

  return `${compact.slice(0, LABEL_MAX_LENGTH - 1).trimEnd()}…`
}

function toTiles(tasks: Task[]): BoardTile[] {
  return tasks.map((task, index) => ({
    step: index + 1,
    label: normalizeLabel(task.title),
    completed: task.completed,
  }))
}

function toRows(tiles: BoardTile[]): BoardTile[][] {
  const rows: BoardTile[][] = []

  for (let index = 0; index < tiles.length; index += BOARD_COLUMNS) {
    const row = tiles.slice(index, index + BOARD_COLUMNS)
    const rowIndex = rows.length
    rows.push(rowIndex % 2 === 0 ? row : [...row].reverse())
  }

  return rows
}

function buildExportText(goal: string, tiles: BoardTile[]): string {
  const lines: string[] = []
  lines.push(`TaskForge Gameboard Plan`)
  lines.push(`Goal: ${normalizeLabel(goal)}`)
  lines.push('')

  for (const tile of tiles) {
    lines.push(`${tile.step}. [${tile.completed ? 'x' : ' '}] ${tile.label}`)
  }

  lines.push('')
  lines.push('Finish: Goal achieved')

  return lines.join('\n')
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
  }

  return false
}

function downloadTextFile(filename: string, text: string): void {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
  const objectUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = objectUrl
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(objectUrl)
}

function safeFilename(input: string): string {
  const normalized = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return normalized || 'gameboard-plan'
}

export function GoalDiagram({ goal, tasks }: GoalDiagramProps) {
  const [exportStatus, setExportStatus] = useState('')
  const tiles = toTiles(tasks)
  const rows = toRows(tiles)
  const exportText = buildExportText(goal, tiles)

  const handleCopy = async () => {
    const copied = await copyToClipboard(exportText)
    setExportStatus(copied ? 'Copied board to clipboard.' : 'Clipboard unavailable in this browser.')
  }

  const handleDownload = () => {
    downloadTextFile(`${safeFilename(goal)}-taskforge-board.txt`, exportText)
    setExportStatus('Downloaded board as text file.')
  }

  if (tiles.length === 0) {
    return (
      <p className="rounded-xl border border-white/15 bg-slate-900/60 px-3 py-2 text-sm text-slate-300">
        Add a generated task list to render your gameboard path.
      </p>
    )
  }

  return (
    <div className="goal-diagram rounded-2xl border border-white/15 bg-slate-950/80 p-4">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-lg border border-white/20 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-700"
          onClick={() => {
            void handleCopy()
          }}
        >
          Copy Board
        </button>
        <button
          type="button"
          className="rounded-lg border border-white/20 bg-slate-800/80 px-3 py-2 text-xs font-semibold text-slate-100 transition hover:bg-slate-700"
          onClick={handleDownload}
        >
          Export .txt
        </button>
        {exportStatus && <span className="text-xs text-slate-300">{exportStatus}</span>}
      </div>

      <div className="mb-4 rounded-xl border border-indigo-300/30 bg-indigo-500/10 px-4 py-3 text-sm font-semibold text-indigo-100">
        🎯 Start: {normalizeLabel(goal)}
      </div>

      <div className="space-y-3">
        {rows.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {row.map((tile) => (
                <div
                  key={`tile-${tile.step}`}
                  className={`aspect-square rounded-2xl border p-3 shadow-lg ${
                    tile.completed
                      ? 'board-tile-complete border-emerald-300/40 bg-emerald-500/15 text-emerald-100'
                      : tile.step % 2 === 0
                        ? 'border-cyan-300/40 bg-cyan-500/10 text-cyan-100'
                        : 'border-violet-300/40 bg-violet-500/10 text-violet-100'
                  }`}
                >
                  <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/30 bg-slate-900/70 text-sm font-semibold text-white">
                    {tile.step}
                  </div>
                  <p className={`text-sm font-medium leading-snug ${tile.completed ? 'line-through opacity-80' : ''}`}>
                    {tile.label}
                  </p>
                </div>
              ))}
            </div>

            {rowIndex < rows.length - 1 && (
              <p className="text-center text-xs font-semibold tracking-wide text-slate-400">
                ↓ continue to next row
              </p>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-emerald-300/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100">
        🏁 Finish: Goal achieved
      </div>
    </div>
  )
}

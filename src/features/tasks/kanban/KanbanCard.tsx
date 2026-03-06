import { useState } from 'react'
import type { Task, TaskStatus } from '../../../types'

const DIFFICULTY_LABELS: Record<number, string> = {
  1: '1 SP',
  2: '2 SP',
  3: '3 SP',
  4: '4 SP',
  5: '5 SP',
  6: '6 SP',
}

const DIFFICULTY_COLORS: Record<number, string> = {
  1: 'border-amber-700/60 bg-amber-900/30 text-amber-300',
  2: 'border-zinc-500/60 bg-zinc-700/30 text-zinc-300',
  3: 'border-slate-400/60 bg-slate-600/30 text-slate-200',
  4: 'border-gray-300/60 bg-gray-500/20 text-gray-200',
  5: 'border-yellow-400/60 bg-yellow-500/20 text-yellow-200',
  6: 'border-cyan-300/60 bg-cyan-400/20 text-cyan-100',
}

interface KanbanCardProps {
  task: Task
  isWorking: boolean
  disabled: boolean
  onDelete: (task: Task) => void
  onStatusChange: (task: Task, status: TaskStatus) => void
  onTitleSave: (task: Task, title: string) => void
  onDueDateChange: (task: Task, due_date: string | null) => void
  onViewNotes: (task: Task) => void
}

export function KanbanCard({ task, isWorking, disabled, onDelete, onStatusChange, onTitleSave, onDueDateChange, onViewNotes }: KanbanCardProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(task.title)

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('text/plain', String(task.id))
    event.dataTransfer.effectAllowed = 'move'
    setIsDragging(true)
  }

  const handleDragEnd = () => {
    setIsDragging(false)
  }

  const difficultyLabel = DIFFICULTY_LABELS[task.difficulty] ?? `Lvl ${task.difficulty}`
  const difficultyColor = DIFFICULTY_COLORS[task.difficulty] ?? DIFFICULTY_COLORS[1]

  const today = new Date().toISOString().slice(0, 10)
  const isOverdue = task.due_date && task.due_date < today && task.status !== 'done'

  const statusOptions: { value: TaskStatus; label: string }[] = [
    { value: 'todo', label: 'To Do' },
    { value: 'doing', label: 'In Progress' },
    { value: 'done', label: 'Done' },
  ]

  return (
    <div
      draggable={!disabled && !isWorking}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`kanban-card-enter group relative rounded-xl border border-zinc-500/30 bg-zinc-900/90 p-3 shadow-md shadow-black/20 transition-all duration-200 ${
        isDragging
          ? 'scale-[1.03] rotate-1 opacity-60 shadow-xl shadow-amber-500/10'
          : 'hover:-translate-y-0.5 hover:border-zinc-400/40 hover:shadow-lg'
      } ${isWorking ? 'animate-pulse opacity-70' : ''} ${
        disabled ? 'cursor-not-allowed opacity-60' : 'cursor-grab active:cursor-grabbing'
      }`}
    >
      {/* Title */}
      {editingTitle ? (
        <input
          autoFocus
          className="w-full rounded border border-amber-400/50 bg-zinc-800 px-1.5 py-0.5 text-sm font-medium text-zinc-100 outline-none ring-1 ring-amber-400/30"
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={() => {
            onTitleSave(task, titleDraft)
            setEditingTitle(false)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              onTitleSave(task, titleDraft)
              setEditingTitle(false)
            } else if (e.key === 'Escape') {
              setTitleDraft(task.title)
              setEditingTitle(false)
            }
          }}
          maxLength={120}
        />
      ) : (
        <p
          className={`text-sm font-medium leading-snug ${task.status === 'done' ? 'text-zinc-500 line-through' : 'text-zinc-100'} ${!disabled && !isWorking ? 'cursor-text' : ''}`}
          onDoubleClick={() => {
            if (!disabled && !isWorking) {
              setTitleDraft(task.title)
              setEditingTitle(true)
            }
          }}
          title={!disabled && !isWorking ? 'Double-click to edit' : undefined}
        >
          {task.title}
        </p>
      )}

      {/* Meta row */}
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${difficultyColor}`}>
          {difficultyLabel}
        </span>
        {task.source === 'ai_generated' && (
          <span className="inline-flex items-center rounded-md border border-purple-300/25 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-200/90">
            AI
          </span>
        )}
        {task.goal && (
          <span className="inline-flex items-center rounded-md border border-amber-300/25 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-200/80 truncate max-w-[120px]" title={task.goal}>
            {task.goal}
          </span>
        )}
        {task.due_date && (
          <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${
            isOverdue
              ? 'border-rose-400/40 bg-rose-500/10 text-rose-300'
              : 'border-zinc-600/40 bg-zinc-700/30 text-zinc-400'
          }`}>
            {isOverdue ? '⚠ ' : ''}{task.due_date}
          </span>
        )}
        <span className="ml-auto text-[10px] text-zinc-500">
          +{task.difficulty} SP
        </span>
      </div>

      {/* Actions row — visible on hover */}
      <div className="mt-2 flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
        <input
          type="date"
          className="rounded border border-zinc-600/50 bg-zinc-800/90 px-1.5 py-0.5 text-[11px] text-zinc-200 outline-none ring-amber-400 focus:ring"
          value={task.due_date ?? ''}
          disabled={disabled || isWorking}
          onChange={(e) => onDueDateChange(task, e.target.value || null)}
          aria-label="Set due date"
          title="Due date"
        />
        <select
          className="flex-1 rounded-lg border border-zinc-600/50 bg-zinc-800/90 px-2 py-1 text-[11px] text-zinc-200 outline-none ring-amber-400 focus:ring"
          value={task.status}
          disabled={disabled || isWorking}
          onChange={(event) => onStatusChange(task, event.target.value as TaskStatus)}
          aria-label="Change task status"
        >
          {statusOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          type="button"
          className="rounded-lg border border-zinc-600/40 bg-zinc-700/40 px-2 py-1 text-[11px] text-zinc-300 transition hover:bg-zinc-600/50 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled || isWorking}
          onClick={() => onViewNotes(task)}
          aria-label="View notes"
        >
          Notes
        </button>
        <button
          type="button"
          className="rounded-lg border border-red-400/25 bg-red-500/10 px-2 py-1 text-[11px] text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={disabled || isWorking}
          onClick={() => onDelete(task)}
          aria-label="Delete task"
        >
          Delete
        </button>
      </div>
    </div>
  )
}

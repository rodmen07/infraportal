import { useState } from 'react'
import type { Task, TaskStatus } from '../../../types'
import type { KanbanColumn } from './kanbanHelpers'
import { KanbanCard } from './KanbanCard'

interface KanbanColumnPanelProps {
  column: KanbanColumn
  tasks: Task[]
  workingTaskId: number | null
  disabled: boolean
  onDrop: (taskId: number, targetStatus: TaskStatus) => void
  onDelete: (task: Task) => void
  onStatusChange: (task: Task, status: TaskStatus) => void
}

export function KanbanColumnPanel({
  column,
  tasks,
  workingTaskId,
  disabled,
  onDrop,
  onDelete,
  onStatusChange,
}: KanbanColumnPanelProps) {
  const [isDragOver, setIsDragOver] = useState(false)

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setIsDragOver(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    if (event.currentTarget.contains(event.relatedTarget as Node)) {
      return
    }
    setIsDragOver(false)
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragOver(false)
    const taskId = Number(event.dataTransfer.getData('text/plain'))
    if (!Number.isNaN(taskId) && taskId > 0) {
      onDrop(taskId, column.id)
    }
  }

  const columnCountColors: Record<TaskStatus, string> = {
    todo: 'bg-sky-500/20 text-sky-300',
    doing: 'bg-amber-500/20 text-amber-300',
    done: 'bg-emerald-500/20 text-emerald-300',
  }

  return (
    <div
      className={`flex flex-col rounded-2xl border p-3 transition-all duration-200 ${column.accentClass} ${
        isDragOver
          ? 'border-amber-300/50 bg-amber-500/10 ring-2 ring-amber-400/20 scale-[1.01]'
          : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column header */}
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-100">{column.label}</h3>
        <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${columnCountColors[column.id]}`}>
          {tasks.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-1 flex-col gap-2 min-h-[120px]">
        {tasks.length === 0 ? (
          <p className="flex flex-1 items-center justify-center text-center text-xs text-zinc-500 italic px-2">
            {column.emptyMessage}
          </p>
        ) : (
          tasks.map((task) => (
            <KanbanCard
              key={task.id}
              task={task}
              isWorking={workingTaskId === task.id}
              disabled={disabled}
              onDelete={onDelete}
              onStatusChange={onStatusChange}
            />
          ))
        )}
      </div>
    </div>
  )
}

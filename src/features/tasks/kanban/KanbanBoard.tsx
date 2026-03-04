import { useMemo } from 'react'
import type { Task, TaskStatus } from '../../../types'
import { KANBAN_COLUMNS, groupTasksByStatus } from './kanbanHelpers'
import { KanbanColumnPanel } from './KanbanColumnPanel'

interface KanbanBoardProps {
  tasks: Task[]
  workingTaskId: number | null
  disabled: boolean
  onStatusChange: (task: Task, status: TaskStatus) => void
  onDelete: (task: Task) => void
}

export function KanbanBoard({
  tasks,
  workingTaskId,
  disabled,
  onStatusChange,
  onDelete,
}: KanbanBoardProps) {
  const grouped = useMemo(() => groupTasksByStatus(tasks), [tasks])

  const handleDrop = (taskId: number, targetStatus: TaskStatus) => {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === targetStatus) {
      return
    }
    onStatusChange(task, targetStatus)
  }

  return (
    <div className="grid gap-3 md:grid-cols-3">
      {KANBAN_COLUMNS.map((column) => (
        <KanbanColumnPanel
          key={column.id}
          column={column}
          tasks={grouped[column.id]}
          workingTaskId={workingTaskId}
          disabled={disabled}
          onDrop={handleDrop}
          onDelete={onDelete}
          onStatusChange={onStatusChange}
        />
      ))}
    </div>
  )
}

import type { Task, TaskStatus } from '../../../types'

export interface KanbanColumn {
  id: TaskStatus
  label: string
  accentClass: string
  emptyMessage: string
}

export const KANBAN_COLUMNS: KanbanColumn[] = [
  {
    id: 'todo',
    label: 'To Do',
    accentClass: 'border-sky-400/40 bg-sky-500/5',
    emptyMessage: 'No tasks waiting. Create one to get started.',
  },
  {
    id: 'doing',
    label: 'In Progress',
    accentClass: 'border-amber-400/40 bg-amber-500/5',
    emptyMessage: 'Nothing in progress. Drag a task here to begin.',
  },
  {
    id: 'done',
    label: 'Done',
    accentClass: 'border-emerald-400/40 bg-emerald-500/5',
    emptyMessage: 'No completed tasks yet.',
  },
]

export function groupTasksByStatus(tasks: Task[]): Record<TaskStatus, Task[]> {
  const grouped: Record<TaskStatus, Task[]> = {
    todo: [],
    doing: [],
    done: [],
  }

  for (const task of tasks) {
    const status = (['todo', 'doing', 'done'].includes(task.status) ? task.status : 'todo') as TaskStatus
    grouped[status].push(task)
  }

  return grouped
}

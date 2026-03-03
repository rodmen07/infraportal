import type { FormEvent } from 'react'
import type { PlannerTone, Task } from '../../types'
import type { PlannerStatus } from './useTaskManager'

interface TaskManagerSectionProps {
  pendingCount: number
  tasksLoading: boolean
  taskError: string
  goalInput: string
  planning: boolean
  creatingPlanTasks: boolean
  plannerStatus: PlannerStatus
  plannedTasks: string[]
  taskTitle: string
  submitting: boolean
  tasks: Task[]
  workingTaskId: number | null
  onRefresh: () => void
  onGoalInputChange: (value: string) => void
  onGeneratePlan: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onCreatePlannedTasks: () => Promise<void>
  onTaskTitleChange: (value: string) => void
  onCreateTask: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onToggleTask: (task: Task) => Promise<void>
  onDeleteTask: (task: Task) => Promise<void>
}

function plannerToneClass(tone: PlannerTone): string {
  switch (tone) {
    case 'success':
      return 'border-emerald-300/40 bg-emerald-500/10 text-emerald-200'
    case 'warning':
      return 'border-amber-300/40 bg-amber-500/10 text-amber-200'
    default:
      return 'border-orange-300/40 bg-orange-500/10 text-orange-200'
  }
}

export function TaskManagerSection({
  pendingCount,
  tasksLoading,
  taskError,
  goalInput,
  planning,
  creatingPlanTasks,
  plannerStatus,
  plannedTasks,
  taskTitle,
  submitting,
  tasks,
  workingTaskId,
  onRefresh,
  onGoalInputChange,
  onGeneratePlan,
  onCreatePlannedTasks,
  onTaskTitleChange,
  onCreateTask,
  onToggleTask,
  onDeleteTask,
}: TaskManagerSectionProps) {
  return (
    <section className="forge-panel rounded-3xl border border-amber-300/20 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">Task Manager</h2>
        <button
          type="button"
          className="rounded-xl border border-zinc-500/40 bg-zinc-800/80 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onRefresh}
          disabled={tasksLoading}
        >
          Refresh
        </button>
      </div>

      <p className="mb-4 text-sm text-zinc-300">
        Pending tasks: <strong>{pendingCount}</strong>
      </p>

      <form className="mb-3 space-y-3" onSubmit={onGeneratePlan}>
        <textarea
          className="w-full rounded-xl border border-zinc-500/40 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 outline-none ring-amber-400 placeholder:text-zinc-500 focus:ring"
          placeholder="Describe your long-term goal..."
          value={goalInput}
          onChange={(event) => onGoalInputChange(event.target.value)}
          rows={4}
          disabled={planning || creatingPlanTasks}
        />
        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={planning || creatingPlanTasks}
        >
          {planning ? 'Generating plan…' : 'Generate Composite Tasks'}
        </button>
      </form>

      <p className={`mb-4 rounded-xl border px-3 py-2 text-sm ${plannerToneClass(plannerStatus.tone)}`}>
        {plannerStatus.message}
      </p>

      {plannedTasks.length > 0 && (
        <div className="mb-4 rounded-2xl border border-zinc-500/35 bg-zinc-800/70 p-4">
          <h3 className="mb-2 text-base font-semibold text-white">Generated Plan</h3>
          <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-zinc-200">
            {plannedTasks.map((task, index) => (
              <li key={`${task}-${index}`}>{task}</li>
            ))}
          </ol>
          <button
            type="button"
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void onCreatePlannedTasks()
            }}
            disabled={creatingPlanTasks}
          >
            {creatingPlanTasks ? 'Creating tasks…' : 'Create All Planned Tasks'}
          </button>
        </div>
      )}

      <form className="mb-4 flex flex-col gap-2 sm:flex-row" onSubmit={onCreateTask}>
        <input
          type="text"
          className="flex-1 rounded-xl border border-zinc-500/40 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 outline-none ring-amber-400 placeholder:text-zinc-500 focus:ring"
          placeholder="Add a task title"
          value={taskTitle}
          onChange={(event) => onTaskTitleChange(event.target.value)}
          maxLength={120}
          disabled={submitting}
        />
        <button
          type="submit"
          className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? 'Adding…' : 'Add Task'}
        </button>
      </form>

      {taskError && (
        <p className="mb-4 rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {taskError}
        </p>
      )}

      {tasksLoading ? (
        <p className="text-sm text-zinc-300">Loading tasks…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-zinc-300">No tasks yet. Create your first one.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task, index) => {
            const isWorking = workingTaskId === task.id
            return (
              <li
                key={task.id}
                className={`flex items-center justify-between gap-3 rounded-xl border border-zinc-500/35 bg-zinc-900/70 p-3 ${task.completed ? 'task-complete-pulse' : ''}`}
              >
                <label className="flex items-center gap-3 text-sm text-zinc-100">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-400/40 bg-zinc-800/80 text-xs font-semibold text-zinc-200">
                    {index + 1}
                  </span>
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={task.completed}
                    disabled={isWorking}
                    onChange={() => {
                      void onToggleTask(task)
                    }}
                  />
                  <span className={task.completed ? 'line-through text-zinc-500' : ''}>
                    {task.title}
                  </span>
                </label>
                <button
                  type="button"
                  className="rounded-lg border border-red-300/30 bg-red-500/10 px-3 py-1.5 text-sm text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isWorking}
                  onClick={() => {
                    void onDeleteTask(task)
                  }}
                >
                  Delete
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

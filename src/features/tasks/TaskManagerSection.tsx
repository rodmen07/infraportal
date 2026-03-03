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
      return 'border-emerald-300/40 bg-emerald-400/10 text-emerald-200'
    case 'warning':
      return 'border-amber-300/40 bg-amber-400/10 text-amber-200'
    default:
      return 'border-blue-300/40 bg-blue-400/10 text-blue-200'
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
    <section className="rounded-3xl border border-white/15 bg-slate-900/70 p-6 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">Task Manager</h2>
        <button
          type="button"
          className="rounded-xl border border-white/15 bg-slate-800/80 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onRefresh}
          disabled={tasksLoading}
        >
          Refresh
        </button>
      </div>

      <p className="mb-4 text-sm text-slate-300">
        Pending tasks: <strong>{pendingCount}</strong>
      </p>

      <form className="mb-3 space-y-3" onSubmit={onGeneratePlan}>
        <textarea
          className="w-full rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none ring-indigo-400 placeholder:text-slate-500 focus:ring"
          placeholder="Describe your long-term goal..."
          value={goalInput}
          onChange={(event) => onGoalInputChange(event.target.value)}
          rows={4}
          disabled={planning || creatingPlanTasks}
        />
        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={planning || creatingPlanTasks}
        >
          {planning ? 'Generating plan…' : 'Generate Composite Tasks'}
        </button>
      </form>

      <p className={`mb-4 rounded-xl border px-3 py-2 text-sm ${plannerToneClass(plannerStatus.tone)}`}>
        {plannerStatus.message}
      </p>

      {plannedTasks.length > 0 && (
        <div className="mb-4 rounded-2xl border border-white/15 bg-slate-800/50 p-4">
          <h3 className="mb-2 text-base font-semibold text-white">Generated Plan</h3>
          <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-slate-200">
            {plannedTasks.map((task, index) => (
              <li key={`${task}-${index}`}>{task}</li>
            ))}
          </ol>
          <button
            type="button"
            className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
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
          className="flex-1 rounded-xl border border-white/15 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none ring-indigo-400 placeholder:text-slate-500 focus:ring"
          placeholder="Add a task title"
          value={taskTitle}
          onChange={(event) => onTaskTitleChange(event.target.value)}
          maxLength={120}
          disabled={submitting}
        />
        <button
          type="submit"
          className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={submitting}
        >
          {submitting ? 'Adding…' : 'Add Task'}
        </button>
      </form>

      {taskError && (
        <p className="mb-4 rounded-xl border border-rose-300/40 bg-rose-400/10 px-3 py-2 text-sm text-rose-200">
          {taskError}
        </p>
      )}

      {tasksLoading ? (
        <p className="text-sm text-slate-300">Loading tasks…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-slate-300">No tasks yet. Create your first one.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((task, index) => {
            const isWorking = workingTaskId === task.id
            return (
              <li
                key={task.id}
                className={`flex items-center justify-between gap-3 rounded-xl border border-white/15 bg-slate-900/70 p-3 ${task.completed ? 'task-complete-pulse' : ''}`}
              >
                <label className="flex items-center gap-3 text-sm text-slate-100">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20 bg-slate-800/80 text-xs font-semibold text-slate-200">
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
                  <span className={task.completed ? 'line-through text-slate-500' : ''}>
                    {task.title}
                  </span>
                </label>
                <button
                  type="button"
                  className="rounded-lg border border-rose-300/40 bg-rose-400/10 px-3 py-1.5 text-sm text-rose-200 transition hover:bg-rose-400/20 disabled:cursor-not-allowed disabled:opacity-60"
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

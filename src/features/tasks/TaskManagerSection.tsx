import { useMemo, useState, type FormEvent } from 'react'
import type { PlannerTone, Task } from '../../types'
import type { GemCounts, GoalProgress, PlannerStatus } from './useTaskManager'

interface TaskManagerSectionProps {
  authLocked: boolean
  pendingCount: number
  forgedPoints: number
  gemCounts: GemCounts
  goalProgress: GoalProgress[]
  tasksLoading: boolean
  taskError: string
  goalInput: string
  plannedTaskDifficulty: number
  planning: boolean
  creatingPlanTasks: boolean
  deletingAllTasks: boolean
  plannerStatus: PlannerStatus
  plannedTasks: string[]
  taskTitle: string
  taskDifficulty: number
  taskGoal: string
  submitting: boolean
  tasks: Task[]
  workingTaskId: number | null
  onRefresh: () => void
  onGoalInputChange: (value: string) => void
  onPlannedTaskDifficultyChange: (value: number) => void
  onGeneratePlan: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onCreatePlannedTasks: () => Promise<void>
  onTaskTitleChange: (value: string) => void
  onTaskDifficultyChange: (value: number) => void
  onTaskGoalChange: (value: string) => void
  onCreateTask: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onSetTaskDifficulty: (task: Task, difficulty: number) => Promise<void>
  onToggleTask: (task: Task) => Promise<void>
  onDeleteTask: (task: Task) => Promise<void>
  onDeleteAllTasks: () => Promise<void>
  onResetGeneratedPlan: () => void
}

type ConfirmAction = 'delete-all' | 'reset-generated' | null
type TaskVisibilityFilter = 'all' | 'active' | 'completed'
type TaskSortMode = 'newest' | 'oldest' | 'difficulty-desc' | 'difficulty-asc'

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
  authLocked,
  pendingCount,
  forgedPoints,
  gemCounts,
  goalProgress,
  tasksLoading,
  taskError,
  goalInput,
  plannedTaskDifficulty,
  planning,
  creatingPlanTasks,
  deletingAllTasks,
  plannerStatus,
  plannedTasks,
  taskTitle,
  taskDifficulty,
  taskGoal,
  submitting,
  tasks,
  workingTaskId,
  onRefresh,
  onGoalInputChange,
  onPlannedTaskDifficultyChange,
  onGeneratePlan,
  onCreatePlannedTasks,
  onTaskTitleChange,
  onTaskDifficultyChange,
  onTaskGoalChange,
  onCreateTask,
  onSetTaskDifficulty,
  onToggleTask,
  onDeleteTask,
  onDeleteAllTasks,
  onResetGeneratedPlan,
}: TaskManagerSectionProps) {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [taskSearch, setTaskSearch] = useState('')
  const [visibilityFilter, setVisibilityFilter] = useState<TaskVisibilityFilter>('all')
  const [sortMode, setSortMode] = useState<TaskSortMode>('newest')
  const canResetGeneratedPlan = plannedTasks.length > 0 || goalInput.trim().length > 0

  const confirmDialog = useMemo(() => {
    if (confirmAction === 'delete-all') {
      return {
        title: 'Remove all tasks?',
        message: `This will permanently remove all ${tasks.length} current task${tasks.length === 1 ? '' : 's'}. This action cannot be undone.`,
        confirmLabel: deletingAllTasks ? 'Removing…' : 'Remove All',
      }
    }

    if (confirmAction === 'reset-generated') {
      return {
        title: 'Reset generated tasks?',
        message: 'This will clear the AI-generated task list and current goal input.',
        confirmLabel: 'Reset',
      }
    }

    return null
  }, [confirmAction, deletingAllTasks, tasks.length])

  const closeConfirmDialog = () => {
    if (deletingAllTasks) {
      return
    }
    setConfirmAction(null)
  }

  const handleConfirmAction = async () => {
    if (confirmAction === 'delete-all') {
      await onDeleteAllTasks()
      setConfirmAction(null)
      return
    }

    if (confirmAction === 'reset-generated') {
      onResetGeneratedPlan()
      setConfirmAction(null)
    }
  }

  const visibleTasks = useMemo(() => {
    const normalizedSearch = taskSearch.trim().toLowerCase()
    let filtered = tasks.filter((task) => {
      if (visibilityFilter === 'active' && task.completed) {
        return false
      }
      if (visibilityFilter === 'completed' && !task.completed) {
        return false
      }

      if (!normalizedSearch) {
        return true
      }

      const haystack = `${task.title} ${task.goal || ''}`.toLowerCase()
      return haystack.includes(normalizedSearch)
    })

    switch (sortMode) {
      case 'oldest':
        return filtered
      case 'difficulty-desc':
        filtered = [...filtered].sort((a, b) => b.difficulty - a.difficulty)
        return filtered
      case 'difficulty-asc':
        filtered = [...filtered].sort((a, b) => a.difficulty - b.difficulty)
        return filtered
      default:
        return [...filtered].reverse()
    }
  }, [sortMode, taskSearch, tasks, visibilityFilter])

  return (
    <section className="forge-panel relative rounded-3xl border border-amber-300/20 bg-zinc-900/80 p-6 shadow-2xl shadow-black/50 backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">Task Manager</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              setConfirmAction('delete-all')
            }}
            disabled={authLocked || tasksLoading || deletingAllTasks || tasks.length === 0}
          >
            {deletingAllTasks ? 'Removing…' : 'Remove All Tasks'}
          </button>
          <button
            type="button"
            className="rounded-xl border border-zinc-500/40 bg-zinc-800/80 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={onRefresh}
            disabled={authLocked || tasksLoading || deletingAllTasks}
          >
            Refresh
          </button>
        </div>
      </div>

      <p className="mb-4 text-sm text-zinc-300">
        Pending tasks: <strong>{pendingCount}</strong>
      </p>

      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <p className="rounded-xl border border-orange-300/30 bg-orange-500/10 px-3 py-2 text-sm text-orange-100">
          Forged Rings (points): <strong>{forgedPoints}</strong>
        </p>
        <div className="rounded-xl border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-100">
          Gems — Ruby: <strong>{gemCounts.ruby}</strong>, Sapphire: <strong>{gemCounts.sapphire}</strong>, Emerald: <strong>{gemCounts.emerald}</strong>
        </div>
      </div>

      {goalProgress.length > 0 && (
        <div className="mb-4 rounded-2xl border border-zinc-500/35 bg-zinc-800/70 p-4">
          <h3 className="mb-2 text-base font-semibold text-white">Goal Tracking</h3>
          <ul className="space-y-1 text-sm text-zinc-200">
            {goalProgress.map((item) => (
              <li key={item.goal}>
                <span className="font-medium text-amber-200">{item.goal}</span>: {item.completed}/{item.total} complete
              </li>
            ))}
          </ul>
        </div>
      )}

      {authLocked && (
        <p className="mb-4 rounded-xl border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Sign in to manage tasks and persist your session.
        </p>
      )}

      <form className="mb-3 space-y-3" onSubmit={onGeneratePlan}>
        <textarea
          className="w-full rounded-xl border border-zinc-500/40 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 outline-none ring-amber-400 placeholder:text-zinc-500 focus:ring"
          placeholder="Describe your short-term goal..."
          value={goalInput}
          onChange={(event) => onGoalInputChange(event.target.value)}
          rows={4}
          disabled={authLocked || planning || creatingPlanTasks}
        />
        <button
          type="submit"
          className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={authLocked || planning || creatingPlanTasks}
        >
          {planning ? 'Generating plan…' : 'Generate Composite Tasks'}
        </button>
      </form>

      <p className={`mb-4 rounded-xl border px-3 py-2 text-sm ${plannerToneClass(plannerStatus.tone)}`}>
        {plannerStatus.message}
      </p>

      <div className="mb-4 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          className="rounded-xl border border-zinc-500/40 bg-zinc-900/70 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={() => {
            setConfirmAction('reset-generated')
          }}
          disabled={authLocked || creatingPlanTasks || !canResetGeneratedPlan}
        >
          Reset Generated Tasks
        </button>
      </div>

      {plannedTasks.length > 0 && (
        <div className="mb-4 rounded-2xl border border-zinc-500/35 bg-zinc-800/70 p-4">
          <h3 className="mb-2 text-base font-semibold text-white">Generated Plan</h3>
          <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-zinc-200">
            {plannedTasks.map((task, index) => (
              <li key={`${task}-${index}`}>{task}</li>
            ))}
          </ol>
          <div className="mb-3 flex items-center gap-2 text-sm text-zinc-200">
            <label htmlFor="planned-task-difficulty">Difficulty:</label>
            <select
              id="planned-task-difficulty"
              className="rounded-lg border border-zinc-500/40 bg-zinc-900/80 px-2 py-1 text-sm text-zinc-100"
              value={plannedTaskDifficulty}
              onChange={(event) => onPlannedTaskDifficultyChange(Number(event.target.value))}
              disabled={authLocked || creatingPlanTasks}
            >
              {[1, 2, 3, 4, 5].map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => {
              void onCreatePlannedTasks()
            }}
            disabled={authLocked || creatingPlanTasks}
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
          disabled={authLocked || submitting}
        />
        <input
          type="text"
          className="flex-1 rounded-xl border border-zinc-500/40 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 outline-none ring-amber-400 placeholder:text-zinc-500 focus:ring"
          placeholder="Goal for this task"
          value={taskGoal}
          onChange={(event) => onTaskGoalChange(event.target.value)}
          maxLength={160}
          disabled={authLocked || submitting}
        />
        <select
          className="rounded-xl border border-zinc-500/40 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 outline-none ring-amber-400 focus:ring"
          value={taskDifficulty}
          onChange={(event) => onTaskDifficultyChange(Number(event.target.value))}
          disabled={authLocked || submitting}
          aria-label="Task difficulty"
        >
          {[1, 2, 3, 4, 5].map((value) => (
            <option key={value} value={value}>
              D{value}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-900 transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
          disabled={authLocked || submitting}
        >
          {submitting ? 'Adding…' : 'Add Task'}
        </button>
      </form>

      {taskError && (
        <p className="mb-4 rounded-xl border border-rose-300/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {taskError}
        </p>
      )}

      <div className="mb-4 grid gap-2 md:grid-cols-3">
        <input
          type="text"
          className="rounded-xl border border-zinc-500/40 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 outline-none ring-amber-400 placeholder:text-zinc-500 focus:ring"
          placeholder="Search tasks or goals"
          value={taskSearch}
          onChange={(event) => setTaskSearch(event.target.value)}
          disabled={tasksLoading}
        />
        <select
          className="rounded-xl border border-zinc-500/40 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 outline-none ring-amber-400 focus:ring"
          value={visibilityFilter}
          onChange={(event) => setVisibilityFilter(event.target.value as TaskVisibilityFilter)}
          disabled={tasksLoading}
          aria-label="Filter tasks"
        >
          <option value="all">All tasks</option>
          <option value="active">Active only</option>
          <option value="completed">Completed only</option>
        </select>
        <select
          className="rounded-xl border border-zinc-500/40 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-100 outline-none ring-amber-400 focus:ring"
          value={sortMode}
          onChange={(event) => setSortMode(event.target.value as TaskSortMode)}
          disabled={tasksLoading}
          aria-label="Sort tasks"
        >
          <option value="newest">Sort: Newest first</option>
          <option value="oldest">Sort: Oldest first</option>
          <option value="difficulty-desc">Sort: Difficulty high → low</option>
          <option value="difficulty-asc">Sort: Difficulty low → high</option>
        </select>
      </div>

      <p className="mb-3 text-xs text-zinc-400">
        Showing {visibleTasks.length} of {tasks.length} tasks
      </p>

      {tasksLoading ? (
        <p className="text-sm text-zinc-300">Loading tasks…</p>
      ) : tasks.length === 0 ? (
        <p className="text-sm text-zinc-300">No tasks yet. Create your first one.</p>
      ) : visibleTasks.length === 0 ? (
        <p className="text-sm text-zinc-300">No tasks match your current filters.</p>
      ) : (
        <ul className="space-y-2">
          {visibleTasks.map((task, index) => {
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
                    disabled={authLocked || isWorking}
                    onChange={() => {
                      void onToggleTask(task)
                    }}
                  />
                  <span className={task.completed ? 'line-through text-zinc-500' : ''}>
                    {task.title}
                  </span>
                  {task.goal && (
                    <span className="rounded-md border border-amber-300/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
                      {task.goal}
                    </span>
                  )}
                </label>
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-lg border border-zinc-500/40 bg-zinc-900/80 px-2 py-1 text-xs text-zinc-100"
                    value={task.difficulty}
                    disabled={authLocked || isWorking}
                    onChange={(event) => {
                      void onSetTaskDifficulty(task, Number(event.target.value))
                    }}
                    aria-label="Update task difficulty"
                  >
                    {[1, 2, 3, 4, 5].map((value) => (
                      <option key={value} value={value}>
                        D{value}
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-amber-200">+{task.difficulty} ring{task.difficulty === 1 ? '' : 's'}</span>
                <button
                  type="button"
                  className="rounded-lg border border-red-300/30 bg-red-500/10 px-3 py-1.5 text-sm text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={authLocked || isWorking}
                  onClick={() => {
                    void onDeleteTask(task)
                  }}
                >
                  Delete
                </button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {confirmDialog && (
        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-3xl bg-zinc-950/80 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-500/40 bg-zinc-900/95 p-4 shadow-xl">
            <h3 className="text-base font-semibold text-white">{confirmDialog.title}</h3>
            <p className="mt-2 text-sm text-zinc-200">{confirmDialog.message}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-xl border border-zinc-500/40 bg-zinc-800/80 px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={closeConfirmDialog}
                disabled={deletingAllTasks}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-xl border border-red-300/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => {
                  void handleConfirmAction()
                }}
                disabled={deletingAllTasks && confirmAction === 'delete-all'}
              >
                {confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}

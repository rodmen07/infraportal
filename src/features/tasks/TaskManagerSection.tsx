import { useMemo, useState, type FormEvent } from 'react'
import type { PlannerTone, Task, TaskStatus } from '../../types'
import type { GoalProgress, PlannerStatus, WritingTier } from './useTaskManager'
import { writingTierForPoints, WRITING_TIER_ORDER } from './useTaskManager'
import { KanbanBoard } from './kanban/KanbanBoard'

const DIFFICULTY_TIERS = [
  { value: 1, label: '1 SP' },
  { value: 2, label: '2 SP' },
  { value: 3, label: '3 SP' },
  { value: 4, label: '4 SP' },
  { value: 5, label: '5 SP' },
  { value: 6, label: '6 SP' },
] as const

const WRITING_TIER_COLORS: Record<WritingTier, string> = {
  'poem':        'border-zinc-500/50 bg-zinc-800/50 text-zinc-300',
  'paragraph':   'border-blue-400/40 bg-blue-500/10 text-blue-200',
  'short story': 'border-purple-400/40 bg-purple-500/10 text-purple-200',
  'novel':       'border-amber-300/40 bg-amber-500/10 text-amber-200',
  'epic':        'border-emerald-300/40 bg-emerald-500/10 text-emerald-100',
}

const GOAL_MAX_LENGTH = 500

interface TaskManagerSectionProps {
  authLocked: boolean
  pendingCount: number
  storyPoints: number
  goalProgress: GoalProgress[]
  tasksLoading: boolean
  taskError: string
  goalInput: string
  plannedTaskDifficulty: number
  plannedTaskCount: number
  plannedTaskFeedback: string
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
  clearingGoal: string | null
  onRefresh: () => void
  onGoalInputChange: (value: string) => void
  onPlannedTaskDifficultyChange: (value: number) => void
  onPlannedTaskCountChange: (value: number) => void
  onPlannedTaskFeedbackChange: (value: string) => void
  onGeneratePlan: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onRegeneratePlan: () => Promise<void>
  onRemovePlannedTask: (index: number) => void
  onCreatePlannedTasks: () => Promise<void>
  onTaskTitleChange: (value: string) => void
  onTaskDifficultyChange: (value: number) => void
  onTaskGoalChange: (value: string) => void
  onCreateTask: (event: FormEvent<HTMLFormElement>) => Promise<void>
  onSetTaskDifficulty: (task: Task, difficulty: number) => Promise<void>
  onToggleTask: (task: Task) => Promise<void>
  onDeleteTask: (task: Task) => Promise<void>
  onDeleteAllTasks: () => Promise<void>
  onUpdateTaskStatus: (task: Task, status: TaskStatus) => Promise<void>
  onResetGeneratedPlan: () => void
  onClearPlanTasks: (goal: string) => Promise<void>
}

type ConfirmAction = 'delete-all' | 'reset-generated' | null
type TaskVisibilityFilter = 'all' | 'active' | 'completed'
type TaskSortMode = 'newest' | 'oldest' | 'difficulty-desc' | 'difficulty-asc'
type TaskViewMode = 'kanban' | 'list'

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
  storyPoints,
  goalProgress,
  tasksLoading,
  taskError,
  goalInput,
  plannedTaskDifficulty,
  plannedTaskCount,
  plannedTaskFeedback,
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
  clearingGoal,
  onRefresh,
  onGoalInputChange,
  onPlannedTaskDifficultyChange,
  onPlannedTaskCountChange,
  onPlannedTaskFeedbackChange,
  onGeneratePlan,
  onRegeneratePlan,
  onRemovePlannedTask,
  onCreatePlannedTasks,
  onTaskTitleChange,
  onTaskDifficultyChange,
  onTaskGoalChange,
  onCreateTask,
  onSetTaskDifficulty,
  onToggleTask,
  onDeleteTask,
  onDeleteAllTasks,
  onUpdateTaskStatus,
  onResetGeneratedPlan,
  onClearPlanTasks,
}: TaskManagerSectionProps) {
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null)
  const [taskSearch, setTaskSearch] = useState('')
  const [visibilityFilter, setVisibilityFilter] = useState<TaskVisibilityFilter>('all')
  const [sortMode, setSortMode] = useState<TaskSortMode>('newest')
  const [viewMode, setViewMode] = useState<TaskViewMode>('kanban')
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
      {/* ── Header ── */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-white">Task Manager</h2>
        <button
          type="button"
          className="rounded-xl border border-zinc-500/40 bg-zinc-800/80 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
          onClick={onRefresh}
          disabled={authLocked || tasksLoading || deletingAllTasks}
        >
          Refresh
        </button>
      </div>

      {/* ── Gamification stats ── */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2">
        <p className="rounded-xl border border-orange-300/30 bg-orange-500/10 px-3 py-2 text-sm text-orange-100">
          Story Points: <strong>{storyPoints}</strong>
        </p>
        <div className="flex items-center gap-2 rounded-xl border border-zinc-500/30 bg-zinc-800/60 px-3 py-2 text-sm text-zinc-100">
          <span className="text-zinc-400">Tier:</span>
          {(() => {
            const tier = writingTierForPoints(storyPoints)
            const color = WRITING_TIER_COLORS[tier]
            return (
              <span className={`inline-flex items-center rounded-lg border px-2 py-0.5 text-xs font-semibold capitalize ${color}`}>
                {tier}
              </span>
            )
          })()}
          <span className="ml-auto flex items-center gap-1">
            {WRITING_TIER_ORDER.map((t) => {
              const active = WRITING_TIER_ORDER.indexOf(writingTierForPoints(storyPoints)) >= WRITING_TIER_ORDER.indexOf(t)
              return (
                <span
                  key={t}
                  title={t}
                  className={`inline-block h-2 w-4 rounded-sm ${active ? WRITING_TIER_COLORS[t].split(' ').find(c => c.startsWith('bg-')) ?? 'bg-zinc-600' : 'bg-zinc-700/50'}`}
                />
              )
            })}
            <a
              href="#/tiers"
              className="ml-1 text-[10px] text-zinc-500 transition hover:text-zinc-300"
              title="View tier progression"
            >
              ?
            </a>
          </span>
        </div>
      </div>

      <p className="mb-4 text-sm text-zinc-300">
        Pending tasks: <strong>{pendingCount}</strong>
      </p>

      {authLocked && (
        <p className="mb-4 rounded-xl border border-amber-300/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          Sign in to manage tasks and persist your session.
        </p>
      )}

      {/* ── AI Planner ── */}
      <div className="mb-4 rounded-2xl border border-zinc-700/40 bg-zinc-800/40 p-4">
        <div className="mb-3 flex items-center gap-2">
          <span className="rounded-md border border-purple-400/30 bg-purple-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-purple-300">AI Planner</span>
          <span className="text-xs text-zinc-500">Describe a goal and generate a focused task plan</span>
        </div>

        <form className="space-y-3" onSubmit={onGeneratePlan}>
          <div className="relative">
            <textarea
              className="w-full rounded-xl border border-zinc-600/50 bg-zinc-900/70 px-3 py-2 pb-6 text-sm text-zinc-100 outline-none ring-amber-400 placeholder:text-zinc-500 focus:ring"
              placeholder="Describe your short-term goal (e.g. 'Refactor the auth module to use JWTs')"
              value={goalInput}
              onChange={(event) => onGoalInputChange(event.target.value)}
              rows={3}
              maxLength={GOAL_MAX_LENGTH}
              disabled={authLocked || planning || creatingPlanTasks}
            />
            <span className={`absolute bottom-2 right-3 text-xs ${goalInput.length >= GOAL_MAX_LENGTH ? 'text-rose-400' : 'text-zinc-500'}`}>
              {goalInput.length}/{GOAL_MAX_LENGTH}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-zinc-300">
              <label htmlFor="plan-step-count" className="shrink-0 text-xs font-medium text-zinc-400">Steps</label>
              <select
                id="plan-step-count"
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/70 px-2 py-1 text-xs text-zinc-100 outline-none ring-amber-400 focus:ring"
                value={plannedTaskCount}
                onChange={(event) => onPlannedTaskCountChange(Number(event.target.value))}
                disabled={authLocked || planning || creatingPlanTasks}
              >
                {[3, 4, 5, 6, 7, 8, 9, 10, 12, 15].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={authLocked || planning || creatingPlanTasks}
            >
              {planning ? 'Generating…' : 'Generate Plan'}
            </button>
          </div>
        </form>

        {(plannerStatus.tone !== 'info' || goalInput.trim().length > 0 || planning) && (
          <p className={`mt-3 rounded-xl border px-3 py-2 text-sm ${plannerToneClass(plannerStatus.tone)}`}>
            {plannerStatus.message}
          </p>
        )}
      </div>

      {/* ── Generated plan preview ── */}
      {plannedTasks.length > 0 && (
        <div className="mb-4 rounded-2xl border border-amber-400/20 bg-zinc-800/60 p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-white">
              Review plan <span className="ml-1 rounded-full border border-amber-400/30 bg-amber-500/15 px-2 py-0.5 text-xs font-semibold text-amber-300">{plannedTasks.length}</span>
            </h3>
            <button
              type="button"
              className="text-xs text-zinc-500 transition hover:text-zinc-300"
              onClick={() => { setConfirmAction('reset-generated') }}
              disabled={creatingPlanTasks}
            >
              Discard ×
            </button>
          </div>

          <ol className="mb-4 space-y-1.5">
            {plannedTasks.map((task, index) => (
              <li
                key={`${task}-${index}`}
                className="flex items-start gap-2 rounded-lg border border-zinc-700/40 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200"
              >
                <span className="mt-0.5 shrink-0 text-xs font-semibold text-zinc-500">{index + 1}.</span>
                <span className="flex-1">{task}</span>
                <button
                  type="button"
                  className="ml-1 shrink-0 rounded p-0.5 text-zinc-500 transition hover:bg-zinc-700 hover:text-zinc-200 disabled:opacity-40"
                  onClick={() => onRemovePlannedTask(index)}
                  disabled={creatingPlanTasks}
                  aria-label="Remove task"
                >
                  ×
                </button>
              </li>
            ))}
          </ol>

          {/* Feedback + regenerate */}
          <div className="mb-4 rounded-xl border border-zinc-700/40 bg-zinc-900/50 p-3">
            <p className="mb-2 text-xs font-medium text-zinc-400">Refine with feedback</p>
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1 rounded-lg border border-zinc-600/50 bg-zinc-900/70 px-3 py-1.5 text-xs text-zinc-100 outline-none ring-amber-400 placeholder:text-zinc-500 focus:ring"
                placeholder='e.g. "make tasks smaller", "focus on testing", "add documentation tasks"'
                value={plannedTaskFeedback}
                onChange={(event) => onPlannedTaskFeedbackChange(event.target.value)}
                maxLength={500}
                disabled={authLocked || planning || creatingPlanTasks}
              />
              <button
                type="button"
                className="shrink-0 rounded-lg border border-zinc-600/50 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={() => { void onRegeneratePlan() }}
                disabled={authLocked || planning || creatingPlanTasks}
              >
                {planning ? 'Regenerating…' : 'Regenerate'}
              </button>
            </div>
          </div>

          {/* Difficulty + create */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label htmlFor="planned-task-difficulty" className="text-xs font-medium text-zinc-400">Difficulty</label>
              <select
                id="planned-task-difficulty"
                className="rounded-lg border border-zinc-600/50 bg-zinc-900/80 px-2 py-1 text-xs text-zinc-100"
                value={plannedTaskDifficulty}
                onChange={(event) => onPlannedTaskDifficultyChange(Number(event.target.value))}
                disabled={authLocked || creatingPlanTasks}
              >
                {DIFFICULTY_TIERS.map((tier) => (
                  <option key={tier.value} value={tier.value}>{tier.label}</option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => { void onCreatePlannedTasks() }}
              disabled={authLocked || creatingPlanTasks || plannedTasks.length === 0}
            >
              {creatingPlanTasks ? 'Creating…' : `Create ${plannedTasks.length} Task${plannedTasks.length === 1 ? '' : 's'}`}
            </button>
          </div>
        </div>
      )}

      {canResetGeneratedPlan && plannedTasks.length === 0 && (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            className="rounded-xl border border-zinc-500/40 bg-zinc-900/70 px-4 py-2 text-sm font-semibold text-zinc-100 transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => { setConfirmAction('reset-generated') }}
            disabled={authLocked || creatingPlanTasks}
          >
            Clear Goal Input
          </button>
        </div>
      )}

      {/* ── Manual task creation ── */}
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
          {DIFFICULTY_TIERS.map((tier) => (
            <option key={tier.value} value={tier.value}>
              {tier.label}
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

      {/* ── View mode toggle + destructive actions ── */}
      <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-1 rounded-xl border border-zinc-500/30 bg-zinc-800/50 p-1 w-fit">
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            viewMode === 'kanban'
              ? 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
              : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
          }`}
          onClick={() => setViewMode('kanban')}
        >
          Board
        </button>
        <button
          type="button"
          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
            viewMode === 'list'
              ? 'bg-amber-500/20 text-amber-200 border border-amber-400/30'
              : 'text-zinc-400 hover:text-zinc-200 border border-transparent'
          }`}
          onClick={() => setViewMode('list')}
        >
          List
        </button>
      </div>

        {tasks.length > 0 && (
          <button
            type="button"
            className="text-xs text-red-400/60 transition hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
            onClick={() => { setConfirmAction('delete-all') }}
            disabled={authLocked || tasksLoading || deletingAllTasks}
          >
            {deletingAllTasks ? 'Removing…' : 'Remove all tasks'}
          </button>
        )}
      </div>

      {/* ── Task board / list (scrollable) ── */}
      <div className="max-h-[520px] overflow-y-auto rounded-2xl pr-1 scrollbar-thin">
        {viewMode === 'kanban' ? (
          tasksLoading ? (
            <p className="text-sm text-zinc-300">Loading tasks…</p>
          ) : (
            <KanbanBoard
              tasks={tasks}
              workingTaskId={workingTaskId}
              disabled={authLocked}
              onStatusChange={(task, status) => { void onUpdateTaskStatus(task, status) }}
              onDelete={(task) => { void onDeleteTask(task) }}
            />
          )
        ) : (
          <>
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
                      className="flex items-center justify-between gap-3 rounded-xl border border-zinc-500/35 bg-zinc-900/70 p-3"
                    >
                      <label className="flex min-w-0 items-center gap-3 text-sm text-zinc-100">
                        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-zinc-400/40 bg-zinc-800/80 text-xs font-semibold text-zinc-200">
                          {index + 1}
                        </span>
                        <input
                          type="checkbox"
                          className="h-4 w-4 shrink-0"
                          checked={task.completed}
                          disabled={authLocked || isWorking}
                          onChange={() => { void onToggleTask(task) }}
                        />
                        <span className={`truncate ${task.completed ? 'line-through text-zinc-500' : ''}`}>
                          {task.title}
                        </span>
                        {task.source === 'ai_generated' && (
                          <span className="shrink-0 rounded-md border border-purple-300/30 bg-purple-500/10 px-2 py-0.5 text-xs text-purple-200">
                            AI
                          </span>
                        )}
                        {task.goal && (
                          <span className="shrink-0 rounded-md border border-amber-300/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-200">
                            {task.goal}
                          </span>
                        )}
                      </label>
                      <div className="flex shrink-0 items-center gap-2">
                        <select
                          className="rounded-lg border border-zinc-500/40 bg-zinc-900/80 px-2 py-1 text-xs text-zinc-100"
                          value={task.difficulty}
                          disabled={authLocked || isWorking}
                          onChange={(event) => { void onSetTaskDifficulty(task, Number(event.target.value)) }}
                          aria-label="Update task difficulty"
                        >
                          {DIFFICULTY_TIERS.map((tier) => (
                            <option key={tier.value} value={tier.value}>
                              {tier.label}
                            </option>
                          ))}
                        </select>
                        <span className="text-xs text-amber-200">+{task.difficulty} SP</span>
                        <button
                          type="button"
                          className="rounded-lg border border-red-300/30 bg-red-500/10 px-3 py-1.5 text-sm text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          disabled={authLocked || isWorking}
                          onClick={() => { void onDeleteTask(task) }}
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </div>

      {/* ── Goal Tracking (moved below board so it doesn't shift the planner) ── */}
      {goalProgress.length > 0 && (
        <div className="mt-6 rounded-2xl border border-zinc-500/35 bg-zinc-800/70 p-4">
          <h3 className="mb-3 text-base font-semibold text-white">Goal Tracking</h3>
          <ul className="space-y-3 text-sm">
            {goalProgress.map((item) => {
              const pct = item.total > 0 ? Math.round((item.completed / item.total) * 100) : 0
              const isClearingThis = clearingGoal === item.goal
              return (
                <li key={item.goal}>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="truncate font-medium text-amber-200" title={item.goal}>{item.goal}</span>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-zinc-400">{item.completed}/{item.total} · {pct}%</span>
                      {item.aiCount > 0 && (
                        <button
                          type="button"
                          className="rounded-lg border border-purple-300/30 bg-purple-500/10 px-2 py-0.5 text-xs text-purple-200 transition hover:bg-purple-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={authLocked || isClearingThis}
                          onClick={() => { void onClearPlanTasks(item.goal) }}
                          title={`Remove ${item.aiCount} AI-generated task${item.aiCount === 1 ? '' : 's'} for this goal`}
                        >
                          {isClearingThis ? 'Clearing…' : `Clear AI (${item.aiCount})`}
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-700/60">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all duration-500"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* ── Confirm dialog overlay ── */}
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
                onClick={() => { void handleConfirmAction() }}
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

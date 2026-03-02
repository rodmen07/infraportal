import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { API_BASE_URL } from './config'
import {
  createTask,
  deleteTask,
  listTasks,
  planTasksFromGoal,
  updateTask,
} from './api/tasks'
import { GoalDiagram } from './components/GoalDiagram'
import type { GoalPlan, PlannerTone, SiteContent, Task } from './types'

interface PlannerStatus {
  tone: PlannerTone
  message: string
}

const INITIAL_PLANNER_STATUS: PlannerStatus = {
  tone: 'info',
  message: 'Planner ready. Enter a long-term goal to generate task breakdowns.',
}

function toBaseAwareHref(href: string, baseUrl: string): string {
  if (!href) {
    return `${baseUrl}admin/`
  }

  if (/^https?:\/\//.test(href)) {
    return href
  }

  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const normalizedHref = href.startsWith('/') ? href.slice(1) : href
  return `${normalizedBase}${normalizedHref}`
}

function plannerToneClass(tone: PlannerTone): string {
  switch (tone) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700'
    case 'warning':
      return 'border-amber-200 bg-amber-50 text-amber-700'
    default:
      return 'border-blue-200 bg-blue-50 text-blue-700'
  }
}

function normalizePlanTask(task: string): string {
  return task
    .replace(/^\s*(?:\d+[\).:-]\s*|[-*•]\s*)+/, '')
    .trim()
}

function normalizePlanTasks(tasks: string[]): string[] {
  return tasks
    .map(normalizePlanTask)
    .filter((task) => task.length > 0)
}

function App() {
  const baseUrl = import.meta.env.BASE_URL

  const [content, setContent] = useState<SiteContent>({
    title: 'Frontend Service',
    subtitle: 'Loading content from CMS…',
    ctaLabel: 'Open CMS',
    ctaHref: `${baseUrl}admin/`,
  })
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskTitle, setTaskTitle] = useState('')
  const [tasksLoading, setTasksLoading] = useState(true)
  const [taskError, setTaskError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [workingTaskId, setWorkingTaskId] = useState<number | null>(null)
  const [goalInput, setGoalInput] = useState('')
  const [plannedTasks, setPlannedTasks] = useState<string[]>([])
  const [planning, setPlanning] = useState(false)
  const [creatingPlanTasks, setCreatingPlanTasks] = useState(false)
  const [plannerStatus, setPlannerStatus] = useState<PlannerStatus>(INITIAL_PLANNER_STATUS)
  const [goalPlans, setGoalPlans] = useState<GoalPlan[]>([])

  const pendingCount = useMemo(
    () => tasks.filter((task) => !task.completed).length,
    [tasks],
  )

  const loadTasks = useCallback(async () => {
    setTasksLoading(true)
    setTaskError('')

    try {
      const payload = await listTasks()
      setTasks(Array.isArray(payload) ? payload : [])
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : 'Failed to load tasks')
    } finally {
      setTasksLoading(false)
    }
  }, [])

  useEffect(() => {
    const loadContent = async () => {
      try {
        const response = await fetch(`${baseUrl}content/site.json`)
        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as SiteContent
        setContent({
          ...payload,
          ctaHref: toBaseAwareHref(payload.ctaHref, baseUrl),
        })
      } catch {
      }
    }

    loadContent()
  }, [baseUrl])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const handleCreateTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const normalizedTitle = taskTitle.trim()
    if (!normalizedTitle) {
      setTaskError('Title is required')
      return
    }

    setSubmitting(true)
    setTaskError('')

    try {
      const createdTask = await createTask(normalizedTitle)
      setTasks((current) => [...current, createdTask])
      setTaskTitle('')
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : 'Failed to create task')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleTask = async (task: Task) => {
    setWorkingTaskId(task.id)
    setTaskError('')

    try {
      const updatedTask = await updateTask(task.id, { completed: !task.completed })
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? updatedTask : item)),
      )
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : 'Failed to update task')
    } finally {
      setWorkingTaskId(null)
    }
  }

  const handleDeleteTask = async (task: Task) => {
    setWorkingTaskId(task.id)
    setTaskError('')

    try {
      await deleteTask(task.id)
      setTasks((current) => current.filter((item) => item.id !== task.id))
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : 'Failed to delete task')
    } finally {
      setWorkingTaskId(null)
    }
  }

  const handleGeneratePlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const goal = goalInput.trim()
    if (!goal) {
      setTaskError('A long-term goal is required')
      setPlannerStatus({
        tone: 'warning',
        message: 'Enter a long-term goal before generating a plan.',
      })
      return
    }

    setPlanning(true)
    setTaskError('')
    setPlannerStatus({ tone: 'info', message: 'Generating task plan…' })

    try {
      const plan = await planTasksFromGoal(goal)
      const generated = normalizePlanTasks(
        Array.isArray(plan.tasks) ? plan.tasks : [],
      )
      setPlannedTasks(generated)

      if (generated.length > 0) {
        const nextPlan: GoalPlan = {
          id: Date.now(),
          goal,
          tasks: generated,
          createdAt: new Date().toISOString(),
        }
        setGoalPlans((current) => [nextPlan, ...current].slice(0, 8))

        setPlannerStatus({
          tone: 'success',
          message: `Generated ${generated.length} tasks. Review and create them when ready.`,
        })
      } else {
        setPlannerStatus({
          tone: 'warning',
          message: 'No tasks were generated. Try a more specific goal.',
        })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate plan'
      setTaskError(message)

      if (message.includes('LLM_API_KEY_MISSING')) {
        setPlannerStatus({
          tone: 'warning',
          message: 'Planner is not configured yet on backend (missing LLM key).',
        })
      } else if (
        message.includes('LLM_UPSTREAM_RESPONSE_FAILED') ||
        message.includes('429') ||
        message.toLowerCase().includes('rate')
      ) {
        setPlannerStatus({
          tone: 'warning',
          message: 'Planner provider is temporarily rate-limited. Retry in a minute.',
        })
      } else {
        setPlannerStatus({
          tone: 'warning',
          message: 'Planner is temporarily unavailable. Please try again shortly.',
        })
      }
    } finally {
      setPlanning(false)
    }
  }

  const handleCreatePlannedTasks = async () => {
    if (plannedTasks.length === 0) {
      return
    }

    setCreatingPlanTasks(true)
    setTaskError('')
    setPlannerStatus({ tone: 'info', message: 'Creating planned tasks…' })

    try {
      const created: Task[] = []
      for (const plannedTitle of plannedTasks) {
        const title = plannedTitle.trim()
        if (!title) {
          continue
        }

        const task = await createTask(title)
        created.push(task)
      }

      setTasks((current) => [...current, ...created])
      setPlannedTasks([])
      setGoalInput('')
      setPlannerStatus({
        tone: 'success',
        message: `Created ${created.length} tasks from your plan.`,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create planned tasks'
      setTaskError(message)
      setPlannerStatus({
        tone: 'warning',
        message: 'Could not create all planned tasks. You can retry.',
      })
    } finally {
      setCreatingPlanTasks(false)
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{content.title}</h1>
          <p className="mt-2 text-slate-600">{content.subtitle}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              className="inline-flex items-center rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
              href={content.ctaHref}
            >
              {content.ctaLabel}
            </a>
            <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              API: {API_BASE_URL}
            </span>
          </div>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Task Manager</h2>
            <button
              type="button"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={loadTasks}
              disabled={tasksLoading}
            >
              Refresh
            </button>
          </div>

          <p className="mb-4 text-sm text-slate-600">
            Pending tasks: <strong>{pendingCount}</strong>
          </p>

          <form className="mb-3 space-y-3" onSubmit={handleGeneratePlan}>
            <textarea
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-300 placeholder:text-slate-400 focus:ring"
              placeholder="Describe your long-term goal..."
              value={goalInput}
              onChange={(event) => setGoalInput(event.target.value)}
              rows={4}
              disabled={planning || creatingPlanTasks}
            />
            <button
              type="submit"
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={planning || creatingPlanTasks}
            >
              {planning ? 'Generating plan…' : 'Generate Composite Tasks'}
            </button>
          </form>

          <p className={`mb-4 rounded-xl border px-3 py-2 text-sm ${plannerToneClass(plannerStatus.tone)}`}>
            {plannerStatus.message}
          </p>

          {plannedTasks.length > 0 && (
            <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-2 text-base font-semibold">Generated Plan</h3>
              <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-slate-700">
                {plannedTasks.map((task, index) => (
                  <li key={`${task}-${index}`}>{task}</li>
                ))}
              </ol>
              <button
                type="button"
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                onClick={handleCreatePlannedTasks}
                disabled={creatingPlanTasks}
              >
                {creatingPlanTasks ? 'Creating tasks…' : 'Create All Planned Tasks'}
              </button>
            </div>
          )}

          <form className="mb-4 flex flex-col gap-2 sm:flex-row" onSubmit={handleCreateTask}>
            <input
              type="text"
              className="flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-slate-300 placeholder:text-slate-400 focus:ring"
              placeholder="Add a task title"
              value={taskTitle}
              onChange={(event) => setTaskTitle(event.target.value)}
              maxLength={120}
              disabled={submitting}
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={submitting}
            >
              {submitting ? 'Adding…' : 'Add Task'}
            </button>
          </form>

          {taskError && (
            <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {taskError}
            </p>
          )}

          {tasksLoading ? (
            <p className="text-sm text-slate-600">Loading tasks…</p>
          ) : tasks.length === 0 ? (
            <p className="text-sm text-slate-600">No tasks yet. Create your first one.</p>
          ) : (
            <ul className="space-y-2">
              {tasks.map((task) => {
                const isWorking = workingTaskId === task.id
                return (
                  <li
                    key={task.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3"
                  >
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={task.completed}
                        disabled={isWorking}
                        onChange={() => handleToggleTask(task)}
                      />
                      <span className={task.completed ? 'line-through text-slate-400' : ''}>
                        {task.title}
                      </span>
                    </label>
                    <button
                      type="button"
                      className="rounded-lg border border-rose-200 px-3 py-1.5 text-sm text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                      disabled={isWorking}
                      onClick={() => handleDeleteTask(task)}
                    >
                      Delete
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-3 text-xl font-semibold">Goal Diagrams</h2>
          <p className="mb-4 text-sm text-slate-600">
            Visual flow of generated goals and their composite tasks.
          </p>

          {goalPlans.length === 0 ? (
            <p className="text-sm text-slate-600">
              Generate a plan to create your first diagram.
            </p>
          ) : (
            <div className="space-y-4">
              {goalPlans.map((plan) => (
                <article
                  key={plan.id}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-semibold text-slate-800">{plan.goal}</h3>
                    <span className="text-xs text-slate-500">
                      {new Date(plan.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <GoalDiagram plan={plan} />
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  )
}

export default App

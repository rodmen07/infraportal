import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import {
  clearPlanTasks,
  createTaskWithDifficulty,
  deleteTask,
  listTasks,
  planTasksFromGoal,
  updateTask,
  updateTaskStatus,
} from '../../api/tasks'
import type { PlannerTone, Task, TaskStatus } from '../../types'
import { normalizePlanTask, normalizePlanTasks } from './planNormalization'

export interface PlannerStatus {
  tone: PlannerTone
  message: string
}

export type WritingTier = 'poem' | 'paragraph' | 'short story' | 'novel' | 'epic'

export function writingTierForPoints(points: number): WritingTier {
  if (points >= 50) return 'epic'
  if (points >= 30) return 'novel'
  if (points >= 15) return 'short story'
  if (points >= 6) return 'paragraph'
  return 'poem'
}

export const WRITING_TIER_ORDER: WritingTier[] = ['poem', 'paragraph', 'short story', 'novel', 'epic']

export interface GoalProgress {
  goal: string
  completed: number
  total: number
  aiCount: number
}

const INITIAL_PLANNER_STATUS: PlannerStatus = {
  tone: 'info',
  message: 'Planner ready. Enter a short-term goal to generate task breakdowns.',
}

function normalizeDifficulty(value: number): number {
  const rounded = Math.round(value)
  if (rounded < 1) {
    return 1
  }

  if (rounded > 6) {
    return 6
  }

  return rounded
}


export function useTaskManager(isAuthenticated: boolean) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDifficulty, setTaskDifficulty] = useState(1)
  const [taskGoal, setTaskGoal] = useState('')
  const [tasksLoading, setTasksLoading] = useState(true)
  const [taskError, setTaskError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [workingTaskId, setWorkingTaskId] = useState<number | null>(null)
  const [goalInput, setGoalInput] = useState('')
  const [plannedTasks, setPlannedTasks] = useState<string[]>([])
  const [planning, setPlanning] = useState(false)
  const [plannedTaskDifficulty, setPlannedTaskDifficulty] = useState(2)
  const [plannedTaskCount, setPlannedTaskCount] = useState(7)
  const [plannedTaskFeedback, setPlannedTaskFeedback] = useState('')
  const [creatingPlanTasks, setCreatingPlanTasks] = useState(false)
  const [deletingAllTasks, setDeletingAllTasks] = useState(false)
  const [plannerStatus, setPlannerStatus] = useState<PlannerStatus>(INITIAL_PLANNER_STATUS)
  const [clearingGoal, setClearingGoal] = useState<string | null>(null)

  const pendingCount = useMemo(
    () => tasks.filter((task) => !task.completed).length,
    [tasks],
  )

  const storyPoints = useMemo(
    () =>
      tasks
        .filter((t) => t.status === 'done')
        .reduce((sum, t) => sum + normalizeDifficulty(t.difficulty), 0),
    [tasks],
  )

  const loadTasks = useCallback(async () => {
    if (!isAuthenticated) {
      setTasks([])
      setTasksLoading(false)
      return
    }

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
  }, [isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated) {
      setTasks([])
      setTasksLoading(false)
      return
    }

    loadTasks()
  }, [isAuthenticated, loadTasks])

  const handleCreateTask = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!isAuthenticated) {
      setTaskError('Sign in is required to create tasks')
      return
    }

    const normalizedTitle = taskTitle.trim()
    if (!normalizedTitle) {
      setTaskError('Title is required')
      return
    }

    const normalizedGoal = taskGoal.trim()
    if (!normalizedGoal) {
      setTaskError('Goal is required for tracking')
      return
    }

    setSubmitting(true)
    setTaskError('')

    try {
      const createdTask = await createTaskWithDifficulty(
        normalizedTitle,
        normalizeDifficulty(taskDifficulty),
        normalizedGoal,
      )
      setTasks((current) => [...current, createdTask])
      setTaskTitle('')
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : 'Failed to create task')
    } finally {
      setSubmitting(false)
    }
  }

  const handleToggleTask = async (task: Task) => {
    if (!isAuthenticated) {
      setTaskError('Sign in is required to update tasks')
      return
    }

    setWorkingTaskId(task.id)
    setTaskError('')

    try {
      const completing = !task.completed
      const updatedTask = await updateTask(task.id, {
        completed: completing,
        status: completing ? 'done' : 'todo',
      })
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
    if (!isAuthenticated) {
      setTaskError('Sign in is required to delete tasks')
      return
    }

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

  const handleDeleteAllTasks = async () => {
    if (!isAuthenticated) {
      setTaskError('Sign in is required to delete tasks')
      return
    }

    if (tasks.length === 0) {
      return
    }

    setDeletingAllTasks(true)
    setTaskError('')

    try {
      await Promise.all(tasks.map((task) => deleteTask(task.id)))
      setTasks([])
      setPlannerStatus({
        tone: 'success',
        message: 'All current tasks were removed.',
      })
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : 'Failed to delete all tasks')
    } finally {
      setDeletingAllTasks(false)
    }
  }

  const handleGeneratePlan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!isAuthenticated) {
      setTaskError('Sign in is required to generate plans')
      setPlannerStatus({
        tone: 'warning',
        message: 'Sign in before generating a plan.',
      })
      return
    }

    const goal = goalInput.trim()
    if (!goal) {
      setTaskError('A short-term goal is required')
      setPlannerStatus({
        tone: 'warning',
        message: 'Enter a short-term goal before generating a plan.',
      })
      return
    }

    setPlanning(true)
    setTaskError('')
    setPlannerStatus({ tone: 'info', message: 'Generating task plan…' })

    try {
      const plan = await planTasksFromGoal(goal, plannedTaskFeedback, plannedTaskCount)
      const generated = normalizePlanTasks(
        Array.isArray(plan.tasks) ? plan.tasks : [],
      )
      setPlannedTasks(generated)

      if (generated.length > 0) {
        setPlannerStatus({
          tone: 'success',
          message: `Generated ${generated.length} task${generated.length === 1 ? '' : 's'}. Review and create them when ready.`,
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

      if (
        message.includes('LLM_API_KEY_MISSING') ||
        message.toLowerCase().includes('openrouter_api_key') ||
        message.toLowerCase().includes('anthropic_api_key') ||
        message.toLowerCase().includes('not configured')
      ) {
        setPlannerStatus({
          tone: 'warning',
          message: 'Planner is not configured yet on backend (missing LLM key).',
        })
      } else if (
        message.includes('LLM_UPSTREAM_RESPONSE_FAILED') ||
        message.includes('LLM_RATE_LIMIT_EXCEEDED') ||
        message.toLowerCase().includes('llm provider') ||
        message.includes('429') ||
        message.toLowerCase().includes('rate limit') ||
        message.toLowerCase().includes('rate-limit')
      ) {
        setPlannerStatus({
          tone: 'warning',
          message: 'Planner provider is temporarily unavailable. Please try again shortly.',
        })
      } else if (message.includes('PLAN_RATE_LIMIT_EXCEEDED') || message.toLowerCase().includes('planning limit')) {
        setPlannerStatus({
          tone: 'warning',
          message: 'AI planning limit reached. Try again in a few minutes.',
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
    if (!isAuthenticated) {
      setTaskError('Sign in is required to create planned tasks')
      return
    }

    if (plannedTasks.length === 0) {
      return
    }

    setCreatingPlanTasks(true)
    setTaskError('')
    setPlannerStatus({ tone: 'info', message: 'Creating planned tasks…' })

    const created: Task[] = []
    const failed: string[] = []
    let firstErrorMessage = ''

    for (const plannedTitle of plannedTasks) {
      const title = normalizePlanTask(plannedTitle)
      if (!title) {
        continue
      }

      try {
        const task = await createTaskWithDifficulty(
          title,
          normalizeDifficulty(plannedTaskDifficulty),
          goalInput.trim(),
          'ai_generated',
        )
        created.push(task)
      } catch (error) {
        failed.push(title)
        if (!firstErrorMessage) {
          firstErrorMessage =
            error instanceof Error ? error.message : 'Failed to create planned tasks'
        }
      }
    }

    if (created.length > 0) {
      setTasks((current) => [...current, ...created])
    }

    if (failed.length === 0) {
      setPlannedTasks([])
      setGoalInput('')
      setPlannerStatus({
        tone: 'success',
        message: `Created ${created.length} task${created.length === 1 ? '' : 's'} from your plan.`,
      })
    } else {
      setPlannedTasks(failed)
      setTaskError(firstErrorMessage)
      setPlannerStatus({
        tone: 'warning',
        message: `Created ${created.length} task${created.length === 1 ? '' : 's'}. ${failed.length} could not be created. You can retry.`,
      })
    }

    setCreatingPlanTasks(false)
  }

  const handleResetGeneratedPlan = () => {
    if (plannedTasks.length === 0 && goalInput.trim().length === 0) {
      return
    }

    setPlannedTasks([])
    setGoalInput('')
    setPlannedTaskFeedback('')
    setPlannerStatus({
      tone: 'info',
      message: 'Plan reset. Enter a new goal when ready.',
    })
  }

  const handleRemovePlannedTask = (index: number) => {
    setPlannedTasks((current) => current.filter((_, i) => i !== index))
  }

  const handleRegeneratePlan = async () => {
    if (!isAuthenticated) {
      setTaskError('Sign in is required to generate plans')
      return
    }

    const goal = goalInput.trim()
    if (!goal) {
      setTaskError('A short-term goal is required')
      return
    }

    setPlanning(true)
    setTaskError('')
    setPlannerStatus({ tone: 'info', message: 'Regenerating task plan with feedback…' })

    try {
      const plan = await planTasksFromGoal(goal, plannedTaskFeedback, plannedTaskCount)
      const generated = normalizePlanTasks(Array.isArray(plan.tasks) ? plan.tasks : [])
      setPlannedTasks(generated)
      setPlannedTaskFeedback('')

      if (generated.length > 0) {
        setPlannerStatus({
          tone: 'success',
          message: `Regenerated ${generated.length} task${generated.length === 1 ? '' : 's'} with your feedback.`,
        })
      } else {
        setPlannerStatus({ tone: 'warning', message: 'No tasks were generated. Try a more specific goal or feedback.' })
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to regenerate plan'
      setTaskError(message)
      setPlannerStatus({ tone: 'warning', message: 'Planner is temporarily unavailable. Please try again shortly.' })
    } finally {
      setPlanning(false)
    }
  }

  const handleClearPlanTasks = async (goal: string) => {
    if (!isAuthenticated) {
      setTaskError('Sign in is required to clear AI tasks')
      return
    }

    setClearingGoal(goal)
    setTaskError('')

    try {
      await clearPlanTasks(goal)
      setTasks((current) =>
        current.filter((t) => !(t.goal === goal && t.source === 'ai_generated')),
      )
      setPlannerStatus({
        tone: 'success',
        message: `Cleared AI-generated tasks for "${goal}".`,
      })
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : 'Failed to clear AI tasks')
    } finally {
      setClearingGoal(null)
    }
  }

  const goalProgress = useMemo<GoalProgress[]>(() => {
    const byGoal = new Map<string, { total: number; completed: number; aiCount: number }>()

    for (const task of tasks) {
      if (!task.goal) {
        continue
      }

      const current = byGoal.get(task.goal) || { total: 0, completed: 0, aiCount: 0 }
      current.total += 1
      if (task.completed) {
        current.completed += 1
      }
      if (task.source === 'ai_generated') {
        current.aiCount += 1
      }
      byGoal.set(task.goal, current)
    }

    return Array.from(byGoal.entries()).map(([goal, metrics]) => ({
      goal,
      completed: metrics.completed,
      total: metrics.total,
      aiCount: metrics.aiCount,
    }))
  }, [tasks])

  const handleSetTaskDifficulty = async (task: Task, difficulty: number) => {
    if (!isAuthenticated) {
      setTaskError('Sign in is required to update task difficulty')
      return
    }

    setWorkingTaskId(task.id)
    setTaskError('')

    try {
      const updatedTask = await updateTask(task.id, {
        difficulty: normalizeDifficulty(difficulty),
      })
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? updatedTask : item)),
      )
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : 'Failed to update task')
    } finally {
      setWorkingTaskId(null)
    }
  }

  const handleUpdateTaskStatus = async (task: Task, status: TaskStatus) => {
    if (!isAuthenticated) {
      setTaskError('Sign in is required to update task status')
      return
    }

    setWorkingTaskId(task.id)
    setTaskError('')

    try {
      const updatedTask = await updateTaskStatus(task.id, status)
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? updatedTask : item)),
      )
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : 'Failed to update task status')
    } finally {
      setWorkingTaskId(null)
    }
  }

  return {
    tasks,
    taskTitle,
    taskDifficulty,
    taskGoal,
    tasksLoading,
    taskError,
    submitting,
    workingTaskId,
    goalInput,
    plannedTaskDifficulty,
    plannedTaskCount,
    plannedTaskFeedback,
    plannedTasks,
    planning,
    creatingPlanTasks,
    deletingAllTasks,
    plannerStatus,
    goalProgress,
    storyPoints,
    pendingCount,
    clearingGoal,
    setTaskTitle,
    setTaskDifficulty,
    setTaskGoal,
    setGoalInput,
    setPlannedTaskDifficulty,
    setPlannedTaskCount,
    setPlannedTaskFeedback,
    loadTasks,
    handleCreateTask,
    handleSetTaskDifficulty,
    handleUpdateTaskStatus,
    handleToggleTask,
    handleDeleteTask,
    handleDeleteAllTasks,
    handleGeneratePlan,
    handleCreatePlannedTasks,
    handleResetGeneratedPlan,
    handleRemovePlannedTask,
    handleRegeneratePlan,
    handleClearPlanTasks,
  }
}

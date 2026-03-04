import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createTaskWithDifficulty,
  deleteTask,
  listTasks,
  planTasksFromGoal,
  updateTask,
} from '../../api/tasks'
import type { GoalPlan, PlannerTone, Task } from '../../types'
import { normalizePlanTask, normalizePlanTasks } from './planNormalization'
import { playCelebrationSound, playTaskCompletionSound } from './taskAudio'

export interface PlannerStatus {
  tone: PlannerTone
  message: string
}

export interface GemCounts {
  ruby: number
  sapphire: number
  emerald: number
}

export interface GoalProgress {
  goal: string
  completed: number
  total: number
}

const INITIAL_PLANNER_STATUS: PlannerStatus = {
  tone: 'info',
  message: 'Planner ready. Enter a short-term goal to generate task breakdowns.',
}

const PROGRESSION_STORAGE_KEY_PREFIX = 'taskforge.gamification.progress'

const EMPTY_PROGRESS_STATE: ProgressState = {
  forgedPoints: 0,
  gemCounts: { ruby: 0, sapphire: 0, emerald: 0 },
  completedTaskIds: [],
  rewardedPlanIds: [],
}

interface ProgressState {
  forgedPoints: number
  gemCounts: GemCounts
  completedTaskIds: number[]
  rewardedPlanIds: number[]
}

function normalizeDifficulty(value: number): number {
  const rounded = Math.round(value)
  if (rounded < 1) {
    return 1
  }

  if (rounded > 5) {
    return 5
  }

  return rounded
}

function getProgressStorageKey(subject: string): string {
  return `${PROGRESSION_STORAGE_KEY_PREFIX}.${encodeURIComponent(subject.trim().toLowerCase())}`
}

function readProgressState(storageKey: string): ProgressState {
  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) {
      return EMPTY_PROGRESS_STATE
    }

    const parsed = JSON.parse(raw) as ProgressState & { rubies?: number }
    const gemCounts = parsed.gemCounts || {
      ruby: Number(parsed.rubies) || 0,
      sapphire: 0,
      emerald: 0,
    }

    return {
      forgedPoints: Number(parsed.forgedPoints) || 0,
      gemCounts: {
        ruby: Number(gemCounts.ruby) || 0,
        sapphire: Number(gemCounts.sapphire) || 0,
        emerald: Number(gemCounts.emerald) || 0,
      },
      completedTaskIds: Array.isArray(parsed.completedTaskIds)
        ? parsed.completedTaskIds.filter((value): value is number => Number.isInteger(value))
        : [],
      rewardedPlanIds: Array.isArray(parsed.rewardedPlanIds)
        ? parsed.rewardedPlanIds.filter((value): value is number => Number.isInteger(value))
        : [],
    }
  } catch {
    return EMPTY_PROGRESS_STATE
  }
}

function gemTierForPlanDifficulty(totalDifficulty: number): keyof GemCounts {
  if (totalDifficulty <= 8) {
    return 'ruby'
  }

  if (totalDifficulty <= 16) {
    return 'sapphire'
  }

  return 'emerald'
}

export function useTaskManager(isAuthenticated: boolean, subject: string | null) {
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
  const [creatingPlanTasks, setCreatingPlanTasks] = useState(false)
  const [deletingAllTasks, setDeletingAllTasks] = useState(false)
  const [plannerStatus, setPlannerStatus] = useState<PlannerStatus>(INITIAL_PLANNER_STATUS)
  const [goalPlans, setGoalPlans] = useState<GoalPlan[]>([])
  const [celebrationToken, setCelebrationToken] = useState(0)
  const [forgedPoints, setForgedPoints] = useState(0)
  const [gemCounts, setGemCounts] = useState<GemCounts>({
    ruby: 0,
    sapphire: 0,
    emerald: 0,
  })
  const [completedTaskIds, setCompletedTaskIds] = useState<Set<number>>(new Set())
  const [rewardedPlanIds, setRewardedPlanIds] = useState<Set<number>>(new Set())
  const previousPendingRef = useRef<number | null>(null)
  const normalizedSubject = (subject || '').trim().toLowerCase()
  const progressStorageKey =
    isAuthenticated && normalizedSubject.length > 0
      ? getProgressStorageKey(normalizedSubject)
      : ''

  useEffect(() => {
    if (!progressStorageKey) {
      setForgedPoints(0)
      setGemCounts({ ruby: 0, sapphire: 0, emerald: 0 })
      setCompletedTaskIds(new Set())
      setRewardedPlanIds(new Set())
      return
    }

    const progress = readProgressState(progressStorageKey)
    setForgedPoints(progress.forgedPoints)
    setGemCounts(progress.gemCounts)
    setCompletedTaskIds(new Set(progress.completedTaskIds))
    setRewardedPlanIds(new Set(progress.rewardedPlanIds))
  }, [progressStorageKey])

  useEffect(() => {
    if (!progressStorageKey) {
      return
    }

    const serializable: ProgressState = {
      forgedPoints,
      gemCounts,
      completedTaskIds: Array.from(completedTaskIds),
      rewardedPlanIds: Array.from(rewardedPlanIds),
    }
    window.localStorage.setItem(progressStorageKey, JSON.stringify(serializable))
  }, [completedTaskIds, forgedPoints, gemCounts, progressStorageKey, rewardedPlanIds])

  const pendingCount = useMemo(
    () => tasks.filter((task) => !task.completed).length,
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

  useEffect(() => {
    const previousPending = previousPendingRef.current
    previousPendingRef.current = pendingCount

    if (previousPending === null) {
      return
    }

    if (tasks.length > 0 && previousPending > 0 && pendingCount === 0) {
      playCelebrationSound()
      setCelebrationToken(Date.now())
    }
  }, [pendingCount, tasks.length])

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
      const updatedTask = await updateTask(task.id, { completed: !task.completed })
      setTasks((current) =>
        current.map((item) => (item.id === task.id ? updatedTask : item)),
      )
      if (!task.completed && updatedTask.completed) {
        if (!completedTaskIds.has(task.id)) {
          setForgedPoints((current) => current + normalizeDifficulty(updatedTask.difficulty))
          setCompletedTaskIds((current) => new Set(current).add(task.id))
        }
        playTaskCompletionSound()
      }
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
        message: `Created ${created.length} tasks from your plan.`,
      })
    } else {
      setPlannedTasks(failed)
      setTaskError(firstErrorMessage)
      setPlannerStatus({
        tone: 'warning',
        message: `Created ${created.length} tasks. ${failed.length} could not be created. You can retry.`,
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
    setPlannerStatus({
      tone: 'info',
      message: 'AI-generated tasks were reset.',
    })
  }

  useEffect(() => {
    if (goalPlans.length === 0 || tasks.length === 0) {
      return
    }

    const completedTitles = new Set(
      tasks
        .filter((task) => task.completed)
        .map((task) => `${task.goal || ''}::${task.title.trim().toLowerCase()}`),
    )

    const newlyCompletedPlans = goalPlans.filter((plan) => {
      if (rewardedPlanIds.has(plan.id)) {
        return false
      }

      return plan.tasks.every((task) =>
        completedTitles.has(`${plan.goal}::${task.trim().toLowerCase()}`),
      )
    })

    if (newlyCompletedPlans.length === 0) {
      return
    }

    const nextRewarded = new Set(rewardedPlanIds)
    const tierIncrements: GemCounts = { ruby: 0, sapphire: 0, emerald: 0 }

    for (const plan of newlyCompletedPlans) {
      nextRewarded.add(plan.id)

      const totalDifficulty = tasks
        .filter(
          (task) =>
            task.completed &&
            task.goal === plan.goal &&
            plan.tasks.some(
              (planTask) => planTask.trim().toLowerCase() === task.title.trim().toLowerCase(),
            ),
        )
        .reduce((total, task) => total + normalizeDifficulty(task.difficulty), 0)

      const tier = gemTierForPlanDifficulty(totalDifficulty)
      tierIncrements[tier] += 1
    }

    setRewardedPlanIds(nextRewarded)
    setGemCounts((current) => ({
      ruby: current.ruby + tierIncrements.ruby,
      sapphire: current.sapphire + tierIncrements.sapphire,
      emerald: current.emerald + tierIncrements.emerald,
    }))
    setPlannerStatus({
      tone: 'success',
      message: `Plan completed! Gems forged — Ruby: ${tierIncrements.ruby}, Sapphire: ${tierIncrements.sapphire}, Emerald: ${tierIncrements.emerald}.`,
    })
  }, [goalPlans, rewardedPlanIds, tasks])

  const goalProgress = useMemo<GoalProgress[]>(() => {
    const byGoal = new Map<string, { total: number; completed: number }>()

    for (const task of tasks) {
      if (!task.goal) {
        continue
      }

      const current = byGoal.get(task.goal) || { total: 0, completed: 0 }
      current.total += 1
      if (task.completed) {
        current.completed += 1
      }
      byGoal.set(task.goal, current)
    }

    return Array.from(byGoal.entries()).map(([goal, metrics]) => ({
      goal,
      completed: metrics.completed,
      total: metrics.total,
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
    plannedTasks,
    planning,
    creatingPlanTasks,
    deletingAllTasks,
    plannerStatus,
    goalPlans,
    celebrationToken,
    forgedPoints,
    gemCounts,
    goalProgress,
    pendingCount,
    setTaskTitle,
    setTaskDifficulty,
    setTaskGoal,
    setGoalInput,
    setPlannedTaskDifficulty,
    loadTasks,
    handleCreateTask,
    handleSetTaskDifficulty,
    handleToggleTask,
    handleDeleteTask,
    handleDeleteAllTasks,
    handleGeneratePlan,
    handleCreatePlannedTasks,
    handleResetGeneratedPlan,
  }
}

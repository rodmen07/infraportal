import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createTask,
  deleteTask,
  listTasks,
  planTasksFromGoal,
  updateTask,
} from '../../api/tasks'
import type { GoalPlan, PlannerTone, Task } from '../../types'

export interface PlannerStatus {
  tone: PlannerTone
  message: string
}

const INITIAL_PLANNER_STATUS: PlannerStatus = {
  tone: 'info',
  message: 'Planner ready. Enter a long-term goal to generate task breakdowns.',
}

const TITLE_MAX_LENGTH = 120

function normalizePlanTask(task: string): string {
  const cleaned = task
    .replace(/^\s*(?:\d+[\).:-]\s*|[-*•]\s*)+/, '')
    .trim()

  const characters = Array.from(cleaned)
  if (characters.length <= TITLE_MAX_LENGTH) {
    return cleaned
  }

  return characters.slice(0, TITLE_MAX_LENGTH).join('').trimEnd()
}

function normalizePlanTasks(tasks: string[]): string[] {
  return tasks
    .map(normalizePlanTask)
    .filter((task) => task.length > 0)
}

interface ToneStep {
  frequency: number
  startOffset: number
  duration: number
  type: OscillatorType
  gain: number
}

function playToneSequence(steps: ToneStep[]): void {
  if (typeof window === 'undefined') {
    return
  }

  try {
    const audioContext = new window.AudioContext()
    for (const step of steps) {
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      const startTime = audioContext.currentTime + step.startOffset
      const endTime = startTime + step.duration

      oscillator.type = step.type
      oscillator.frequency.setValueAtTime(step.frequency, startTime)

      gainNode.gain.setValueAtTime(0.0001, startTime)
      gainNode.gain.exponentialRampToValueAtTime(step.gain, startTime + 0.02)
      gainNode.gain.exponentialRampToValueAtTime(0.0001, endTime)

      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      oscillator.start(startTime)
      oscillator.stop(endTime)
    }

    const totalDuration = Math.max(...steps.map((step) => step.startOffset + step.duration), 0)

    window.setTimeout(() => {
      void audioContext.close()
    }, Math.ceil((totalDuration + 0.3) * 1000))
  } catch {
  }
}

function playTaskCompletionSound(): void {
  playToneSequence([
    { frequency: 784, startOffset: 0, duration: 0.12, type: 'triangle', gain: 0.05 },
    { frequency: 988, startOffset: 0.08, duration: 0.16, type: 'triangle', gain: 0.055 },
    { frequency: 1174, startOffset: 0.16, duration: 0.2, type: 'sine', gain: 0.05 },
  ])
}

function playCelebrationSound(): void {
  playToneSequence([
    { frequency: 523.25, startOffset: 0, duration: 0.32, type: 'triangle', gain: 0.05 },
    { frequency: 659.25, startOffset: 0, duration: 0.32, type: 'triangle', gain: 0.05 },
    { frequency: 783.99, startOffset: 0, duration: 0.32, type: 'triangle', gain: 0.05 },
    { frequency: 1046.5, startOffset: 0.24, duration: 0.3, type: 'sine', gain: 0.06 },
    { frequency: 1318.51, startOffset: 0.24, duration: 0.3, type: 'sine', gain: 0.06 },
    { frequency: 1567.98, startOffset: 0.24, duration: 0.3, type: 'sine', gain: 0.06 },
  ])
}

export function useTaskManager() {
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
  const [celebrationToken, setCelebrationToken] = useState(0)
  const previousPendingRef = useRef<number | null>(null)

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
    loadTasks()
  }, [loadTasks])

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
      if (!task.completed && updatedTask.completed) {
        playTaskCompletionSound()
      }
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

    const created: Task[] = []
    const failed: string[] = []
    let firstErrorMessage = ''

    for (const plannedTitle of plannedTasks) {
      const title = normalizePlanTask(plannedTitle)
      if (!title) {
        continue
      }

      try {
        const task = await createTask(title)
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

  return {
    tasks,
    taskTitle,
    tasksLoading,
    taskError,
    submitting,
    workingTaskId,
    goalInput,
    plannedTasks,
    planning,
    creatingPlanTasks,
    plannerStatus,
    goalPlans,
    celebrationToken,
    pendingCount,
    setTaskTitle,
    setGoalInput,
    loadTasks,
    handleCreateTask,
    handleToggleTask,
    handleDeleteTask,
    handleGeneratePlan,
    handleCreatePlannedTasks,
  }
}

import { useCallback, useEffect, useMemo, useState } from 'react'
import './App.css'
import { API_BASE_URL } from './config'
import { createTask, deleteTask, listTasks, updateTask } from './api/tasks'

function toBaseAwareHref(href, baseUrl) {
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

function App() {
  const baseUrl = import.meta.env.BASE_URL

  const [content, setContent] = useState({
    title: 'Frontend Service',
    subtitle: 'Loading content from CMS…',
    ctaLabel: 'Open CMS',
    ctaHref: `${baseUrl}admin/`,
  })
  const [tasks, setTasks] = useState([])
  const [taskTitle, setTaskTitle] = useState('')
  const [tasksLoading, setTasksLoading] = useState(true)
  const [taskError, setTaskError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [workingTaskId, setWorkingTaskId] = useState(null)

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
        const payload = await response.json()
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

  const handleCreateTask = async (event) => {
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

  const handleToggleTask = async (task) => {
    setWorkingTaskId(task.id)
    setTaskError('')

    try {
      const updatedTask = await updateTask(task.id, { completed: !task.completed })
      setTasks((current) => current.map((item) => (item.id === task.id ? updatedTask : item)))
    } catch (error) {
      setTaskError(error instanceof Error ? error.message : 'Failed to update task')
    } finally {
      setWorkingTaskId(null)
    }
  }

  const handleDeleteTask = async (task) => {
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

  return (
    <main className="container">
      <h1>{content.title}</h1>
      <p>{content.subtitle}</p>
      <a className="cta" href={content.ctaHref}>{content.ctaLabel}</a>
      <p className="hint">Edit this content in Decap CMS at <code>{`${baseUrl}admin/`}</code>.</p>
      <p className="hint">API base URL: <code>{API_BASE_URL}</code></p>

      <section className="tasks">
        <div className="tasks-header">
          <h2>Task Manager</h2>
          <button type="button" className="ghost" onClick={loadTasks} disabled={tasksLoading}>
            Refresh
          </button>
        </div>

        <p className="hint">Pending tasks: <strong>{pendingCount}</strong></p>

        <form className="task-form" onSubmit={handleCreateTask}>
          <input
            type="text"
            placeholder="Add a task title"
            value={taskTitle}
            onChange={(event) => setTaskTitle(event.target.value)}
            maxLength={120}
            disabled={submitting}
          />
          <button type="submit" disabled={submitting}>
            {submitting ? 'Adding…' : 'Add Task'}
          </button>
        </form>

        {taskError && <p className="error">{taskError}</p>}

        {tasksLoading ? (
          <p>Loading tasks…</p>
        ) : tasks.length === 0 ? (
          <p>No tasks yet. Create your first one.</p>
        ) : (
          <ul className="task-list">
            {tasks.map((task) => {
              const isWorking = workingTaskId === task.id
              return (
                <li key={task.id} className="task-item">
                  <label>
                    <input
                      type="checkbox"
                      checked={task.completed}
                      disabled={isWorking}
                      onChange={() => handleToggleTask(task)}
                    />
                    <span className={task.completed ? 'done' : ''}>{task.title}</span>
                  </label>
                  <button
                    type="button"
                    className="danger"
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
    </main>
  )
}

export default App

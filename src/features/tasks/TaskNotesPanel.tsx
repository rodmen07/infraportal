import { useEffect, useState } from 'react'
import { createComment, deleteComment, listComments, updateComment } from '../../api/tasks'
import type { Task, TaskComment } from '../../types'

const MAX_BODY = 2000

interface TaskNotesPanelProps {
  task: Task
  onClose: () => void
}

export function TaskNotesPanel({ task, onClose }: TaskNotesPanelProps) {
  const [comments, setComments] = useState<TaskComment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [newBody, setNewBody] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editBody, setEditBody] = useState('')

  useEffect(() => {
    setLoading(true)
    setError('')
    listComments(task.id)
      .then(setComments)
      .catch(() => setError('Failed to load notes'))
      .finally(() => setLoading(false))
  }, [task.id])

  async function handleAdd() {
    const body = newBody.trim()
    if (!body) return
    setSubmitting(true)
    setError('')
    try {
      const created = await createComment(task.id, body)
      setComments((prev) => [...prev, created])
      setNewBody('')
    } catch {
      setError('Failed to add note')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSaveEdit(commentId: number) {
    const body = editBody.trim()
    if (!body) return
    setSubmitting(true)
    setError('')
    try {
      const updated = await updateComment(commentId, body)
      setComments((prev) => prev.map((c) => (c.id === commentId ? updated : c)))
      setEditingId(null)
    } catch {
      setError('Failed to update note')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete(commentId: number) {
    setError('')
    try {
      await deleteComment(commentId)
      setComments((prev) => prev.filter((c) => c.id !== commentId))
    } catch {
      setError('Failed to delete note')
    }
  }

  function formatDate(iso: string): string {
    try {
      return new Date(iso).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })
    } catch {
      return iso
    }
  }

  return (
    <div className="flex h-full flex-col rounded-2xl border border-zinc-500/30 bg-zinc-900/95 shadow-2xl shadow-black/40">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 border-b border-zinc-700/50 px-4 py-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Notes</p>
          <p className="truncate text-sm font-medium text-zinc-100" title={task.title}>{task.title}</p>
        </div>
        <button
          type="button"
          className="mt-0.5 shrink-0 rounded-lg border border-zinc-600/40 px-2 py-1 text-xs text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
          onClick={onClose}
        >
          Close
        </button>
      </div>

      {/* Comment list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {loading && (
          <p className="text-sm text-zinc-500">Loading…</p>
        )}
        {!loading && comments.length === 0 && (
          <p className="text-sm text-zinc-500">No notes yet. Add one below.</p>
        )}
        <ul className="space-y-3">
          {comments.map((comment) => (
            <li key={comment.id} className="rounded-xl border border-zinc-700/40 bg-zinc-800/60 px-3 py-2.5">
              {editingId === comment.id ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    autoFocus
                    className="w-full resize-none rounded-lg border border-amber-400/40 bg-zinc-900/80 px-2.5 py-2 text-sm text-zinc-100 outline-none ring-1 ring-amber-400/30"
                    rows={3}
                    maxLength={MAX_BODY}
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    disabled={submitting}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:opacity-50"
                      disabled={submitting || !editBody.trim()}
                      onClick={() => { void handleSaveEdit(comment.id) }}
                    >
                      Save
                    </button>
                    <button
                      type="button"
                      className="rounded-lg border border-zinc-600/40 px-3 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                      onClick={() => setEditingId(null)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-wrap text-sm text-zinc-200">{comment.body}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[11px] text-zinc-500">{formatDate(comment.updated_at ?? comment.created_at)}{comment.updated_at ? ' (edited)' : ''}</span>
                    <button
                      type="button"
                      className="ml-auto text-[11px] text-zinc-500 hover:text-amber-400"
                      onClick={() => { setEditingId(comment.id); setEditBody(comment.body) }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className="text-[11px] text-zinc-500 hover:text-rose-400"
                      onClick={() => { void handleDelete(comment.id) }}
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Error */}
      {error && (
        <p className="mx-4 mb-1 rounded-lg border border-rose-300/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
          {error}
        </p>
      )}

      {/* Add note */}
      <div className="border-t border-zinc-700/50 px-4 py-3">
        <textarea
          className="w-full resize-none rounded-xl border border-zinc-600/40 bg-zinc-800/80 px-3 py-2 text-sm text-zinc-100 outline-none ring-amber-400 placeholder:text-zinc-500 focus:ring"
          rows={3}
          maxLength={MAX_BODY}
          placeholder="Add a note…"
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
          disabled={submitting}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              void handleAdd()
            }
          }}
        />
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[11px] text-zinc-600">{newBody.length}/{MAX_BODY}</span>
          <button
            type="button"
            className="rounded-xl bg-amber-500 px-4 py-1.5 text-xs font-semibold text-zinc-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={submitting || !newBody.trim()}
            onClick={() => { void handleAdd() }}
          >
            {submitting ? 'Saving…' : 'Add note'}
          </button>
        </div>
      </div>
    </div>
  )
}

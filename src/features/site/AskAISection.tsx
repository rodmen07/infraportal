import { useEffect, useRef, useState } from 'react'
import { AI_ORCHESTRATOR_URL } from '../../config'
import { MarkdownResponse } from './MarkdownResponse'

const COOLDOWN_MS = 60_000
const STORAGE_KEY = 'rmcc_consult_last'
const MAX_TURNS = 4

const STARTER_PROMPTS = [
  'We need to containerise and deploy our app on AWS',
  'Help me design a CI/CD pipeline for a small team',
  'We\'re a fintech startup evaluating cloud infrastructure',
  'I need a security review of our deployment setup',
]

type Message = { role: 'user' | 'assistant'; content: string }

function secondsLeft(): number {
  const last = parseInt(localStorage.getItem(STORAGE_KEY) ?? '0', 10)
  const elapsed = Date.now() - last
  return elapsed >= COOLDOWN_MS ? 0 : Math.ceil((COOLDOWN_MS - elapsed) / 1000)
}

type SendState =
  | { phase: 'idle' }
  | { phase: 'cooldown'; secondsLeft: number }
  | { phase: 'streaming' }
  | { phase: 'error'; message: string }
  | { phase: 'disabled' }

export function AskAISection() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [leadName, setLeadName] = useState('')
  const [leadEmail, setLeadEmail] = useState('')
  const [leadState, setLeadState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle')
  const [sendState, setSendState] = useState<SendState>(() => {
    if (!AI_ORCHESTRATOR_URL) return { phase: 'disabled' }
    const secs = secondsLeft()
    if (secs > 0) return { phase: 'cooldown', secondsLeft: secs }
    return { phase: 'idle' }
  })

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Cooldown tick
  useEffect(() => {
    if (sendState.phase !== 'cooldown') return
    timerRef.current = setInterval(() => {
      const secs = secondsLeft()
      if (secs <= 0) {
        clearInterval(timerRef.current!)
        setSendState({ phase: 'idle' })
      } else {
        setSendState({ phase: 'cooldown', secondsLeft: secs })
      }
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [sendState.phase])

  // Scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || !AI_ORCHESTRATOR_URL) return
    if (sendState.phase !== 'idle' && sendState.phase !== 'error') return

    const userMessages: Message[] = [...messages, { role: 'user', content: trimmed }]
    setMessages([...userMessages, { role: 'assistant', content: '' }])
    setInput('')
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
    setSendState({ phase: 'streaming' })

    try {
      const r = await fetch(`${AI_ORCHESTRATOR_URL}/consult/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: userMessages }),
      })

      if (!r.ok || !r.body) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.detail ?? `HTTP ${r.status}`)
      }

      const reader = r.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      outer: while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''

        for (const part of parts) {
          if (!part.startsWith('data: ')) continue
          const data = part.slice(6).trim()
          if (data === '[DONE]') break outer

          try {
            const parsed = JSON.parse(data)
            if (parsed.error) throw new Error(parsed.error)
            if (parsed.token) {
              setMessages(prev => {
                const updated = [...prev]
                updated[updated.length - 1] = {
                  role: 'assistant',
                  content: updated[updated.length - 1].content + parsed.token,
                }
                return updated
              })
            }
          } catch (e) {
            if ((e as Error).message !== 'JSON parse') throw e
          }
        }
      }

      setSendState({ phase: 'idle' })
    } catch (e) {
      // Remove the empty assistant placeholder on error
      setMessages(prev => {
        const last = prev[prev.length - 1]
        return last?.role === 'assistant' && !last.content ? prev.slice(0, -1) : prev
      })
      setSendState({ phase: 'error', message: (e as Error).message })
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  async function submitLead() {
    if (!leadName.trim() || !leadEmail.trim() || !AI_ORCHESTRATOR_URL) return
    setLeadState('submitting')
    try {
      const r = await fetch(`${AI_ORCHESTRATOR_URL}/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: leadName.trim(), email: leadEmail.trim() }),
      })
      const data = await r.json().catch(() => ({}))
      setLeadState(r.ok && data.saved ? 'done' : 'error')
    } catch {
      setLeadState('error')
    }
  }

  const canSend = (sendState.phase === 'idle' || sendState.phase === 'error') && messages.length < MAX_TURNS * 2
  const turnCount = messages.filter(m => m.role === 'user').length
  const isStreaming = sendState.phase === 'streaming'
  const showStarterPrompts = messages.length === 0 && sendState.phase === 'idle'

  if (sendState.phase === 'disabled') return null

  return (
    <section className="forge-panel space-y-4 rounded-2xl border border-zinc-500/30 bg-zinc-900/80 p-6 backdrop-blur-xl">
      <div>
        <h2 className="text-lg font-bold text-white">How Can I Help?</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Describe your project or problem — get a direct answer on how I can help.
        </p>
      </div>

      {/* Starter prompts */}
      {showStarterPrompts && (
        <div className="flex flex-wrap gap-2">
          {STARTER_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              onClick={() => send(prompt)}
              className="rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-1.5 text-left text-xs text-zinc-400 transition hover:border-amber-500/40 hover:bg-zinc-800 hover:text-zinc-200"
            >
              {prompt}
            </button>
          ))}
        </div>
      )}

      {/* Conversation thread */}
      {messages.length > 0 && (
        <div className="max-h-96 space-y-4 overflow-y-auto pr-1">
          {messages.map((msg, i) => {
            const isLastAssistant = msg.role === 'assistant' && i === messages.length - 1
            return (
              <div key={i} className={msg.role === 'user' ? 'flex justify-end' : ''}>
                {msg.role === 'user' ? (
                  <div className="max-w-[85%] rounded-xl border border-amber-500/20 bg-amber-500/15 px-4 py-2.5 text-sm text-zinc-200">
                    {msg.content}
                  </div>
                ) : (
                  <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/40 px-4 py-3">
                    {msg.content ? (
                      <div className="relative">
                        <MarkdownResponse content={msg.content} />
                        {isLastAssistant && isStreaming && (
                          <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-amber-400 align-middle" />
                        )}
                      </div>
                    ) : (
                      /* Empty placeholder while first tokens arrive */
                      <div className="flex items-center gap-2">
                        <svg className="h-4 w-4 animate-spin text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        <span className="text-sm text-amber-300/70">Thinking…</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Error bubble */}
          {sendState.phase === 'error' && (
            <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3">
              <p className="text-sm font-medium text-red-300">Something went wrong</p>
              <p className="mt-0.5 text-xs text-red-400/80">{sendState.message}</p>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      )}

      {/* Lead capture — appears after first full response */}
      {messages.some(m => m.role === 'assistant' && m.content) && !isStreaming && (
        <div className="border-t border-zinc-700/40 pt-4">
          {leadState === 'done' ? (
            <p className="text-sm text-green-400">✓ Got it — I'll follow up at {leadEmail}.</p>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-zinc-500">Want a follow-up? Leave your name and email:</p>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={leadName}
                  onChange={e => setLeadName(e.target.value)}
                  placeholder="Your name"
                  disabled={leadState === 'submitting'}
                  className="min-w-0 flex-1 rounded-lg border border-zinc-600/40 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none disabled:opacity-50"
                />
                <input
                  type="email"
                  value={leadEmail}
                  onChange={e => setLeadEmail(e.target.value)}
                  placeholder="your@email.com"
                  disabled={leadState === 'submitting'}
                  className="min-w-0 flex-1 rounded-lg border border-zinc-600/40 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none disabled:opacity-50"
                  onKeyDown={e => { if (e.key === 'Enter') submitLead() }}
                />
                <button
                  onClick={submitLead}
                  disabled={!leadName.trim() || !leadEmail.trim() || leadState === 'submitting'}
                  className="btn-accent px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {leadState === 'submitting' ? 'Saving…' : 'Send →'}
                </button>
              </div>
              {leadState === 'error' && (
                <p className="text-xs text-red-400">Something went wrong — <a href="#/contact" className="underline">use the contact form instead</a>.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Input */}
      {canSend && (
        <div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={messages.length === 0
              ? "e.g. We're a small fintech startup that needs to migrate from a monolith to a containerised architecture on AWS. We have a 3-person eng team and a hard deadline in Q3."
              : "Ask a follow-up…"
            }
            rows={messages.length === 0 ? 3 : 2}
            className="w-full resize-none rounded-xl border border-zinc-600/40 bg-zinc-900/60 px-4 py-3 text-sm text-zinc-200 placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none focus:ring-1 focus:ring-amber-500/30"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && input.trim()) send(input)
            }}
          />
          <div className="mt-2 flex items-center gap-3">
            <button
              onClick={() => send(input)}
              disabled={!input.trim()}
              className="btn-accent px-5 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              {turnCount === 0 ? 'Ask →' : 'Follow up →'}
            </button>
            <span className="text-xs text-zinc-600">or Cmd+Enter</span>
            {turnCount > 0 && (
              <span className="ml-auto text-xs text-zinc-600">
                {MAX_TURNS - turnCount} follow-up{MAX_TURNS - turnCount !== 1 ? 's' : ''} remaining
              </span>
            )}
          </div>
        </div>
      )}

      {/* Cooldown state */}
      {sendState.phase === 'cooldown' && messages.length === 0 && (
        <p className="text-xs text-zinc-500">Next question available in {sendState.secondsLeft}s</p>
      )}

      {/* Conversation limit reached */}
      {messages.length >= MAX_TURNS * 2 && (
        <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/30 px-4 py-3 text-center">
          <p className="text-sm text-zinc-400">
            Want to continue the conversation?{' '}
            <a href="#/contact" className="font-medium text-amber-400 hover:text-amber-300">
              Reach out directly →
            </a>
          </p>
        </div>
      )}
    </section>
  )
}

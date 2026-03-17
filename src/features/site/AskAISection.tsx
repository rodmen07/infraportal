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
  | { phase: 'loading'; elapsed: number }
  | { phase: 'error'; message: string }
  | { phase: 'disabled' }

export function AskAISection() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [sendState, setSendState] = useState<SendState>(() => {
    if (!AI_ORCHESTRATOR_URL) return { phase: 'disabled' }
    const secs = secondsLeft()
    if (secs > 0) return { phase: 'cooldown', secondsLeft: secs }
    return { phase: 'idle' }
  })

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef = useRef(0)
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

  // Elapsed timer while loading
  useEffect(() => {
    if (sendState.phase !== 'loading') { elapsedRef.current = 0; return }
    elapsedRef.current = 0
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1
      setSendState({ phase: 'loading', elapsed: elapsedRef.current })
    }, 1000)
    return () => clearInterval(timerRef.current!)
  }, [sendState.phase === 'loading'])

  // Scroll to bottom when messages update
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, sendState.phase])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || !AI_ORCHESTRATOR_URL) return
    if (sendState.phase !== 'idle' && sendState.phase !== 'error') return

    const nextMessages: Message[] = [...messages, { role: 'user', content: trimmed }]
    setMessages(nextMessages)
    setInput('')
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
    setSendState({ phase: 'loading', elapsed: 0 })

    try {
      const r = await fetch(`${AI_ORCHESTRATOR_URL}/consult`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: nextMessages }),
      })
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        throw new Error(body.detail ?? `HTTP ${r.status}`)
      }
      const data = await r.json()
      const response: string = data.response ?? ''
      if (!response) throw new Error('No response returned')
      setMessages([...nextMessages, { role: 'assistant', content: response }])
      setSendState({ phase: 'idle' })
    } catch (e) {
      setSendState({ phase: 'error', message: (e as Error).message })
      localStorage.removeItem(STORAGE_KEY)
    }
  }

  const canSend = (sendState.phase === 'idle' || sendState.phase === 'error') && messages.length < MAX_TURNS * 2
  const turnCount = messages.filter(m => m.role === 'user').length
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
          {messages.map((msg, i) => (
            <div key={i} className={msg.role === 'user' ? 'flex justify-end' : ''}>
              {msg.role === 'user' ? (
                <div className="max-w-[85%] rounded-xl bg-amber-500/15 px-4 py-2.5 text-sm text-zinc-200 border border-amber-500/20">
                  {msg.content}
                </div>
              ) : (
                <div className="rounded-xl border border-zinc-700/40 bg-zinc-800/40 px-4 py-3">
                  <MarkdownResponse content={msg.content} />
                </div>
              )}
            </div>
          ))}

          {/* Loading bubble */}
          {sendState.phase === 'loading' && (
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3">
              <div className="flex items-center gap-3">
                <svg className="h-4 w-4 animate-spin text-amber-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-sm text-amber-300/80">
                  Thinking
                  <span className="ml-1 inline-flex gap-0.5">
                    {[0, 1, 2].map(i => (
                      <span key={i} className="inline-block h-1 w-1 animate-bounce rounded-full bg-amber-400" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </span>
                </span>
                <span className="ml-auto text-xs text-zinc-600">{sendState.elapsed}s</span>
              </div>
            </div>
          )}

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

      {/* CTA after first assistant response */}
      {messages.some(m => m.role === 'assistant') && (
        <div className="border-t border-zinc-700/40 pt-3">
          <p className="text-xs text-zinc-500">
            Ready to move forward?{' '}
            <a href="#/contact" className="text-amber-400 transition-colors hover:text-amber-300">
              Get in touch →
            </a>
          </p>
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
              <span className="ml-auto text-xs text-zinc-600">{MAX_TURNS - turnCount} follow-up{MAX_TURNS - turnCount !== 1 ? 's' : ''} remaining</span>
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

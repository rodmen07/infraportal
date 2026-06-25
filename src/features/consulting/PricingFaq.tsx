import { useState } from 'react'
import { useTheme } from '../layout/useTheme'

interface FaqItem {
  question: string
  answer: string
}

const FAQS: FaqItem[] = [
  {
    question: 'What happens during the free discovery call?',
    answer:
      'We spend 30 minutes mapping your current stack, deployment setup, and the biggest blocker you want solved. You leave with a clear recommendation on which engagement fits and a written summary of what we covered.',
  },
  {
    question: 'Can I start with an Architecture Review and move to a Retainer?',
    answer:
      'Yes. Most clients start with a paid review to validate the plan, then convert to a Retainer for ongoing delivery. There is no lock-in and no minimum on the review tier.',
  },
  {
    question: 'How does the Project tier handle scope changes?',
    answer:
      'A written proposal with explicit deliverables is agreed before any work begins. If scope expands mid-project, we agree on a change order in writing before proceeding — no surprise invoices.',
  },
  {
    question: 'What is included after a Project engagement ends?',
    answer:
      'Every Project includes one month of post-delivery email support for questions, bug fixes, and handoff questions. A runbook and architecture notes are delivered alongside the code.',
  },
  {
    question: 'What stacks and clouds do you work with?',
    answer:
      'Rust/Axum, Python/FastAPI, Go, TypeScript/React, and PostgreSQL on the application side. GCP Cloud Run and AWS ECS/Fargate are the primary deployment targets, with Terraform IaC for both. Azure-ready patterns are available when needed.',
  },
  {
    question: 'How quickly can you start?',
    answer:
      'Typically within one week of a completed discovery call. Retainer slots are filled in order of signed agreements, so reaching out early is the best way to secure availability.',
  },
]

function FaqRow({ question, answer }: FaqItem) {
  const [open, setOpen] = useState(false)
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const borderClass = isLight ? 'border-zinc-200' : 'border-zinc-700/50'
  const questionClass = isLight ? 'text-zinc-900' : 'text-zinc-100'
  const answerClass = isLight ? 'text-zinc-600' : 'text-zinc-400'
  const iconClass = isLight ? 'text-amber-600' : 'text-amber-400'

  return (
    <div className={`border-b ${borderClass} last:border-b-0`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex w-full items-start justify-between gap-4 py-4 text-left text-sm font-medium ${questionClass} transition hover:opacity-80`}
        aria-expanded={open}
      >
        <span>{question}</span>
        <span className={`mt-0.5 shrink-0 text-base leading-none transition-transform duration-200 ${iconClass} ${open ? 'rotate-45' : ''}`}>
          +
        </span>
      </button>
      {open && (
        <p className={`pb-4 text-sm leading-relaxed ${answerClass}`}>{answer}</p>
      )}
    </div>
  )
}

export function PricingFaq() {
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const sectionClass = isLight
    ? 'rounded-2xl border border-zinc-200 bg-zinc-50 p-6'
    : 'rounded-2xl border border-zinc-700/40 bg-zinc-800/40 p-6'

  const headingClass = isLight ? 'text-zinc-900' : 'text-white'
  const subClass = isLight ? 'text-zinc-500' : 'text-zinc-500'

  return (
    <section className={sectionClass}>
      <h2 className={`text-base font-semibold ${headingClass}`}>Common questions</h2>
      <p className={`mt-1 text-xs ${subClass}`}>
        Answers to the questions that come up most often before the first call.
      </p>
      <div className="mt-5">
        {FAQS.map((faq) => (
          <FaqRow key={faq.question} {...faq} />
        ))}
      </div>
    </section>
  )
}

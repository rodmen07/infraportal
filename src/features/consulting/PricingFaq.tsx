import { useState } from 'react'

// v1.26.2 (ROADMAP.md D-24): migrated off the third theming mechanism.
//
// This file used to read `useTheme()` and branch every colour in JS: a
// `theme === 'light'` boolean, then a light class string and a dark one per
// binding. That is neither of the app's other two mechanisms - the
// semantic tokens in src/styles/tokens.css, and the `[data-theme="light"]`
// override sheet in src/index.css - so its colours passed through neither,
// which is why this was one of only two files in the repo carrying
// *light*-authored palette utilities (a zinc-50 fill, a zinc-200 border, a
// zinc-900 heading and an amber-600 icon) and why any theme scanner had to
// either model a second mechanism or report false positives here.
//
// The retired utilities are named in parts, not as whole class strings, on
// purpose: tailwind.config.js's content glob covers `./src/**/*.{ts,tsx}` and
// the extractor reads COMMENTS, so writing one of them here would emit it back
// into the production stylesheet with no component using it and make "did that
// class leave the bundle?" unanswerable (TAILWIND-TESTPROSE-LEAK-1).
//
// Every binding now names one semantic token utility that already resolves in
// both themes, the same route PricingCard.tsx took in v1.18.4 (see
// PricingCard.test.ts for that migration's regression lock). Two of the old
// bindings were ternaries whose arms were IDENTICAL - `subClass` here and
// `labelClass` in PricingTrustStrip.tsx - i.e. branches that had never done
// anything (THEME-JS-NOOP-TERNARY-1).
//
// Guarded by pricingThemeParity.test.ts, which mounts this component under
// both themes and compares what it actually renders.

interface FaqItem {
  question: string
  answer: string
}

const FAQS: FaqItem[] = [
  {
    question: 'What happens during the free discovery call?',
    answer:
      'I spend 30 minutes mapping your current stack, deployment setup, and the biggest blocker you want solved. You leave with a clear recommendation on which engagement fits and a written summary of what I covered.',
  },
  {
    question: 'Can I start with an Architecture Review and move to a Retainer?',
    answer:
      'Yes. Most clients start with a paid review to validate the plan, then convert to a Retainer for ongoing delivery. There is no lock-in and no minimum on the review tier.',
  },
  {
    question: 'How does the Project tier handle scope changes?',
    answer:
      'A written proposal with explicit deliverables is agreed before any work begins. If scope expands mid-project, I agree on a change order in writing before proceeding — no surprise invoices.',
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

  return (
    <div className="border-b border-border-soft last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-4 py-4 text-left text-sm font-medium text-text-primary transition hover:opacity-80"
        aria-expanded={open}
      >
        <span>{question}</span>
        <span className={`mt-0.5 shrink-0 text-base leading-none transition-transform duration-200 text-accent ${open ? 'rotate-45' : ''}`}>
          +
        </span>
      </button>
      {open && (
        <p className="pb-4 text-sm leading-relaxed text-text-muted">{answer}</p>
      )}
    </div>
  )
}

export function PricingFaq() {
  return (
    <section className="rounded-2xl border border-border-soft bg-surface-1 p-6">
      <h2 className="text-base font-semibold text-text-primary">Common questions</h2>
      <p className="mt-1 text-xs text-text-subtle">
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

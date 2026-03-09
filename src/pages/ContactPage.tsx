import { useState } from 'react'
import { PageLayout } from './PageLayout'

export function ContactPage() {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const body = `Hi Roderick,\n\n${message}\n\n— ${name}`
    window.location.href = `mailto:rodmendoza07@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  const fieldClass = 'w-full rounded-lg border border-zinc-700/60 bg-zinc-800/70 px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 outline-none transition focus:border-amber-400/55 focus:ring-1 focus:ring-amber-400/35'
  const labelClass = 'mb-1.5 block text-xs font-medium text-zinc-400'

  return (
    <PageLayout>
      <section className="forge-panel surface-card-strong rounded-3xl p-8 shadow-2xl shadow-black/50 reveal sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-xl">
            <h1 className="text-2xl font-bold text-white">Get in touch</h1>
            <p className="mt-2 text-sm leading-relaxed text-zinc-300">
              Every engagement starts with a free 30-minute discovery call. Share your current
              stack, timeline, and constraints so we can quickly shape the right implementation path.
            </p>
          </div>
          <div className="surface-card rounded-xl px-4 py-3 text-xs text-zinc-300">
            <p className="font-semibold text-white">Typical response time</p>
            <p className="mt-1 text-zinc-400">Within 1 business day</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label htmlFor="name" className={labelClass}>Your name</label>
              <input
                id="name"
                type="text"
                required
                placeholder="Jane Smith"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={fieldClass}
              />
            </div>
            <div>
              <label htmlFor="subject" className={labelClass}>Subject</label>
              <input
                id="subject"
                type="text"
                required
                placeholder="CI/CD pipeline project"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={fieldClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="message" className={labelClass}>Message</label>
            <textarea
              id="message"
              required
              rows={5}
              placeholder="Tell me a bit about your stack, what you're trying to solve, and your rough timeline..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className={`${fieldClass} resize-none`}
            />
          </div>

          <button
            type="submit"
            className="btn-accent px-6 py-2.5 text-sm"
          >
            Open in email client →
          </button>
        </form>
      </section>

      <section className="forge-panel surface-card rounded-2xl p-6 reveal reveal-delay-1">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-zinc-500">Or reach me directly</p>
        <div className="flex flex-wrap gap-3">
          <a
            href="mailto:rodmendoza07@gmail.com"
            className="btn-neutral px-4 py-2 text-sm"
          >
            rodmendoza07@gmail.com
          </a>
          <a
            href="https://www.linkedin.com/in/roderick-mendoza-9133b7b5/"
            target="_blank"
            rel="noopener noreferrer"
            className="btn-neutral px-4 py-2 text-sm"
          >
            LinkedIn →
          </a>
        </div>
        <p className="mt-4 text-xs text-zinc-600">Based in San Antonio, TX — open to remote worldwide.</p>
      </section>
    </PageLayout>
  )
}

import { useEffect, useMemo, useState } from 'react'
import mermaid from 'mermaid'
import type { GoalPlan } from '../types'

interface GoalDiagramProps {
  plan: GoalPlan
}

function escapeLabel(value: string): string {
  return value
    .replace(/"/g, "'")
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    .replace(/[{}]/g, '')
}

function buildDefinition(plan: GoalPlan): string {
  const goal = escapeLabel(plan.goal)
  const lines = [`flowchart LR`, `goal["🎯 ${goal}"]`]

  if (plan.tasks.length === 0) {
    return lines.join('\n')
  }

  plan.tasks.forEach((task, index) => {
    const key = `task${index + 1}`
    const label = escapeLabel(task)
    lines.push(`${key}["${index + 1}. ${label}"]`)
  })

  lines.push(`goal --> task1`)

  for (let index = 1; index < plan.tasks.length; index += 1) {
    lines.push(`task${index} --> task${index + 1}`)
  }

  lines.push(`done["✅ Goal achieved"]`)
  lines.push(`task${plan.tasks.length} --> done`)

  return lines.join('\n')
}

export function GoalDiagram({ plan }: GoalDiagramProps) {
  const [svg, setSvg] = useState('')

  const definition = useMemo(() => buildDefinition(plan), [plan])

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'loose',
      theme: 'default',
    })
  }, [])

  useEffect(() => {
    let active = true

    const render = async () => {
      try {
        const { svg: renderedSvg } = await mermaid.render(
          `goal-diagram-${plan.id}`,
          definition,
        )

        if (active) {
          setSvg(renderedSvg)
        }
      } catch {
        if (active) {
          setSvg('')
        }
      }
    }

    render()

    return () => {
      active = false
    }
  }, [definition, plan.id])

  if (!svg) {
    return (
      <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Diagram could not be rendered for this plan.
      </p>
    )
  }

  return (
    <div
      className="overflow-x-auto rounded-xl border border-slate-200 bg-white p-3"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

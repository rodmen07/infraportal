import type { LeadPriority } from './leadScoring'
import type { ConsultationStatus } from './consultationStore'

export interface FollowUpTemplateInput {
  name: string
  projectType: string
  timeline: string
  budget?: string
  leadPriority?: LeadPriority
  status: ConsultationStatus
}

export interface FollowUpTemplate {
  subject: string
  body: string
}

function firstName(name: string): string {
  const trimmed = name.trim()
  if (!trimmed) return 'there'
  return trimmed.split(/\s+/)[0]
}

function nextStep(priority: LeadPriority | undefined, status: ConsultationStatus): string {
  if (status === 'accepted') {
    return 'next step is kickoff planning and delivery onboarding'
  }

  if (status === 'reviewed') {
    return 'next step is finalizing scope and confirming start date'
  }

  switch (priority) {
    case 'hot':
      return 'next step is a 20-minute scoping call within 24 hours'
    case 'warm':
      return 'next step is a discovery summary with scoped options'
    default:
      return 'next step is a lightweight discovery checkpoint'
  }
}

export function buildFollowUpTemplate(input: FollowUpTemplateInput): FollowUpTemplate {
  const greetingName = firstName(input.name)
  const priorityLabel = input.leadPriority ? input.leadPriority.toUpperCase() : 'UNRANKED'
  const budgetLine = input.budget ? `Budget range: ${input.budget}` : 'Budget range: not specified'
  const step = nextStep(input.leadPriority, input.status)

  const subject = `[${priorityLabel}] Next step for ${input.projectType}`
  const body = [
    `Hi ${greetingName},`,
    '',
    `Thanks again for sharing your ${input.projectType} goals. Based on your timeline (${input.timeline}), the ${step}.`,
    budgetLine,
    '',
    'If this direction works for you, reply with your preferred availability and I will send a concrete plan and timeline.',
    '',
    'Best,',
    'Roderick',
  ].join('\n')

  return { subject, body }
}

export function buildFollowUpClipboardText(input: FollowUpTemplateInput): string {
  const template = buildFollowUpTemplate(input)
  return `Subject: ${template.subject}\n\n${template.body}`
}

import { describe, expect, it } from 'vitest'
import { buildFollowUpClipboardText, buildFollowUpTemplate } from './followUpTemplate'

describe('followUpTemplate', () => {
  it('builds a hot-lead template with urgent next step', () => {
    const template = buildFollowUpTemplate({
      name: 'Ada Lovelace',
      projectType: 'Monthly retainer',
      timeline: 'Within 2 weeks',
      budget: '$15k+',
      leadPriority: 'hot',
      status: 'new',
    })

    expect(template.subject).toContain('[HOT]')
    expect(template.body).toContain('20-minute scoping call within 24 hours')
    expect(template.body).toContain('Budget range: $15k+')
  })

  it('adapts next step when already accepted', () => {
    const template = buildFollowUpTemplate({
      name: 'Grace Hopper',
      projectType: 'Launch sprint',
      timeline: 'Next month',
      leadPriority: 'warm',
      status: 'accepted',
    })

    expect(template.body).toContain('kickoff planning and delivery onboarding')
  })

  it('formats clipboard output with subject and body', () => {
    const text = buildFollowUpClipboardText({
      name: 'Katherine Johnson',
      projectType: 'Security review',
      timeline: 'Planning stage',
      leadPriority: 'nurture',
      status: 'reviewed',
    })

    expect(text.startsWith('Subject:')).toBe(true)
    expect(text).toContain('Hi Katherine,')
  })
})

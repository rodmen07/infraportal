import { buildIntakePayload } from './leadIntake'
import type { ConsultationRequest } from './consultationStore'

/**
 * v1.25.2 (ROADMAP decision D-19): recovery for a lead the relay refused.
 *
 * v1.25.1 made the two consultation surfaces stop CLAIMING a delivery they
 * never got (LEAD-SILENT-DROP-1). Telling the visitor the truth is only half
 * the fix: the honest failure panel it shipped named an email address in
 * prose and asked the visitor to retype everything they had just typed, and
 * the handlers still cleared every field the moment the panel rendered, so
 * the message was gone from the page before it could be copied. This module
 * is the other half — the same payload the relay was handed, handed to the
 * visitor's own mail client instead.
 *
 * The body is built from `buildIntakePayload`, NOT from a second hand-written
 * field list, so the recovery mail and the relay POST cannot drift: any field
 * added to the intake payload appears here without a second edit.
 */

/** The inbox the relay itself targets (`config.ts`'s FormSubmit fallback). */
export const OWNER_EMAIL = 'rodmendoza07@gmail.com'

const RECOVERY_SUBJECT = 'Consultation request (site delivery failed)'

/** Human-readable labels for the intake payload's machine field names. */
const FIELD_LABELS: Record<string, string> = {
  name: 'Name',
  email: 'Email',
  project_type: 'What I need',
  timeline: 'Timeline',
}

/**
 * A `mailto:` href carrying the request the visitor already typed.
 *
 * `message` is placed last, after a blank line, so the prose reads as the
 * body of the mail rather than as one more labelled field. Everything is
 * percent-encoded: a message containing `&`, `#` or a newline would otherwise
 * truncate the href at that character.
 */
export function buildRecoveryMailtoHref(
  request: ConsultationRequest,
  ownerEmail: string = OWNER_EMAIL,
): string {
  const payload = buildIntakePayload(request)
  const { message, ...fields } = payload
  const lines = Object.entries(fields).map(
    ([key, value]) => `${FIELD_LABELS[key] ?? key}: ${value}`,
  )
  const body = [...lines, '', message].join('\n')
  return `mailto:${ownerEmail}?subject=${encodeURIComponent(RECOVERY_SUBJECT)}&body=${encodeURIComponent(body)}`
}

import { SCHEDULING_URL } from '../../config'
import { buildRecoveryMailtoHref } from './leadRecovery'
import type { ConsultationRequest } from './consultationStore'

/**
 * v1.25.2 (ROADMAP decision D-19): the shared "we could not deliver this, and
 * here is how you still reach me" panel for the two consultation surfaces.
 *
 * It is ONE component rather than two near-identical blocks because the two
 * copies it replaces had already drifted in v1.25.1 ("The delivery service
 * refused the message, so I have not received it." on ContactCTA versus "The
 * delivery service refused it, so I have not received this note." on
 * ContactPage) while carrying the same obligation. The recovery affordances
 * are the part that must not drift: an owner who changes the inbox or the
 * booking URL must not have to find two call sites.
 *
 * The colour tokens are the status pairs already defined in BOTH themes
 * (src/styles/tokens.css) and already used by the v1.25.1 panels this
 * replaces, so nothing new needs a light-theme override.
 */
export type DeliveryStatus = 'sent' | 'not-configured' | 'failed'

export function DeliveryFailureNotice({
  status,
  noun,
  request,
}: {
  /** Only the two failing states render; 'sent' is the caller's success path. */
  status: Exclude<DeliveryStatus, 'sent'>
  /** The word each surface already uses for what the visitor submitted. */
  noun: 'request' | 'message'
  /** The exact request that failed — the mailto is built from it. */
  request: ConsultationRequest
}) {
  const refused = status === 'failed'
  const tone = refused
    ? 'border-danger-line bg-danger-soft text-danger-text'
    : 'border-warning-line bg-warning-soft text-warning-text'

  return (
    <div role="alert" className={`space-y-3 rounded-xl border px-5 py-4 text-sm ${tone}`}>
      <p className="font-medium">
        {refused
          ? `Your ${noun} did not reach my inbox.`
          : `This ${noun} was not delivered.`}
      </p>
      <p className="text-xs">
        {refused
          ? `The delivery service refused it, so I have not received this ${noun}.`
          : 'Message delivery is not configured on this site yet, so nothing reached my inbox.'}{' '}
        Nothing you typed is lost — it is still in the form below, and both buttons here carry it
        with you.
      </p>
      <div className="flex flex-wrap gap-3">
        <a href={buildRecoveryMailtoHref(request)} className="btn-accent px-4 py-2 text-sm">
          Email it to me instead →
        </a>
        {SCHEDULING_URL && (
          <a
            href={SCHEDULING_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-neutral px-4 py-2 text-sm"
          >
            Book a 30-minute call →
          </a>
        )}
      </div>
    </div>
  )
}

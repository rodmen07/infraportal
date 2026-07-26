/**
 * The one place the platform's recurring infrastructure cost is written down.
 *
 * v1.21.3 (D-7a). This is the second half of the PROOF-COST-1 class. v1.20.1
 * replaced the home page's hard-coded standing-cost tile with a measurement,
 * but it left the surrounding sentence hand-typed in TWO marketing files, so
 * the two copies could drift against each other and neither could be checked.
 * Both now render `RECURRING_COST_PHRASE`, and `platformCost.test.ts` fails if
 * a second literal appears anywhere in `src/`.
 *
 * WHY A CONSTANT AND NOT A MEASUREMENT. The service count on the same strip IS
 * measured, from `/health/upstreams`. Cost cannot be: that needs the GCP
 * billing export, which is BLOCKED (see `ROADMAP.md`, "Cost Intelligence"), and
 * no public endpoint reports it. Single-source-plus-guard is therefore the
 * strongest honest option available today: it cannot make the figure true, but
 * it makes the figure appear exactly once, dated, with its basis recorded, so
 * re-checking it is a one-line edit rather than a repo-wide sweep.
 *
 * HOW TO RE-CHECK IT. Read the billing page for the resources in `BASIS`, then
 * update all three constants together. `RECURRING_COST_MEASURED_ON` is the
 * honesty control: it is what tells a later reader how old the number is.
 */

/** The phrase both marketing surfaces render, inside their own sentence. */
export const RECURRING_COST_PHRASE = 'about $9 a month'

/**
 * When the figure above was last checked against the running platform, as
 * `YYYY-MM-DD`. Estimated from the instance tier on the 2026-07-21 rebuild.
 */
export const RECURRING_COST_MEASURED_ON = '2026-07-21'

/**
 * What the figure covers, so a later reader knows what to re-measure rather
 * than guessing which resources the number was ever about.
 */
export const RECURRING_COST_BASIS =
  'Cloud SQL db-f1-micro plus 10 GB HDD, the only standing line item after the 2026-06-04 teardown; ' +
  'Cloud Run and Artifact Registry are usage-priced and near zero at portfolio traffic.'

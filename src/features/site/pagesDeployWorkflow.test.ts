/**
 * GitHub Pages deploy-workflow guard (DEP-MAJ-1 slice 2, 2026-07-25).
 *
 * `.github/workflows/deploy-pages.yml` is the only path by which anything
 * reaches the public site, and it is the one workflow whose real behaviour a
 * green PR check CANNOT tell you about: the `deploy` job runs on push to
 * `main` only, so every dependabot PR that bumps a Pages action is green
 * without ever exercising the thing it changed. That is why DEP-MAJ-1 filed
 * the Pages actions as compat-check majors instead of blind merges.
 *
 * This slice moved the three Pages actions onto their Node-24 majors
 * (`configure-pages` 5 -> 6, `upload-pages-artifact` 4 -> 5, `deploy-pages`
 * 4 -> 5). Each upstream major carries exactly one substantive change, and
 * this file locks the two that can silently break a deploy plus the posture
 * that must not widen.
 *
 * Drift guard, not a one-time check (L-003) -- every assertion reads BOTH
 * sources it compares:
 *
 *   1. runtime floor    each `uses:` in BOTH workflows (`deploy-pages.yml`
 *                       and `test.yml`) vs the major at which that action
 *                       upstream moved to Node 24, plus the absence of the
 *                       FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 shim those floors
 *                       made dead config (retired 2026-07-26)
 *   2. hidden files     the workflow's `include-hidden-files` input vs the
 *                       dotfiles actually destined for the artifact root
 *   3. artifact path    the workflow's upload `path:` vs vite's real outDir
 *   4. permissions      the workflow's `permissions:` block vs least-privilege
 *
 * (2) is the one real behaviour change in `upload-pages-artifact` v5. v4 tarred
 * the site with a hard-coded `--exclude=".[^/]*"`; v5 makes that exclusion
 * conditional on a new `include-hidden-files` input that DEFAULTS TO FALSE, so
 * the default is byte-identical to v4 and this bump is a no-op today. It stops
 * being a no-op the moment the site needs a dotfile at the artifact root (the
 * classic case being `.nojekyll`), and the failure mode is silent: the file is
 * simply missing from the deployed site, with a green deploy. Rather than
 * asserting "there are no dotfiles" -- which would just be today's snapshot --
 * this reads the public directory and requires the input to be turned on IF a
 * dotfile ever appears.
 *
 * Source-scan assertions in this repo's established pattern
 * (`repoIdentity.test.ts`, `routeIntegrity.test.ts`, `runtimeStatusCopy.test.ts`),
 * except that the workflow is parsed with the real YAML parser rather than by
 * regex, since it is a machine-readable artifact (L-023).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { parse } from 'yaml'

const ROOT = process.cwd()
const WORKFLOW_PATH = '.github/workflows/deploy-pages.yml'
const TESTS_WORKFLOW_PATH = '.github/workflows/test.yml'
const PUBLIC_DIR = 'public'
const VITE_CONFIG_PATH = 'vite.config.js'

interface WorkflowStep {
  name?: string
  uses?: string
  with?: Record<string, unknown>
}

interface WorkflowJob {
  steps?: WorkflowStep[]
}

interface DeployWorkflow {
  permissions?: Record<string, string>
  env?: Record<string, unknown>
  jobs?: Record<string, WorkflowJob>
}

const workflow = parse(
  readFileSync(path.join(ROOT, WORKFLOW_PATH), 'utf-8'),
) as DeployWorkflow

const testsWorkflow = parse(
  readFileSync(path.join(ROOT, TESTS_WORKFLOW_PATH), 'utf-8'),
) as DeployWorkflow

const STEPS: WorkflowStep[] = Object.values(workflow.jobs ?? {}).flatMap(
  (job) => job.steps ?? [],
)

/**
 * The runtime-floor contract covers BOTH workflows this repo controls, not
 * just the deploy. It originally read `deploy-pages.yml` alone, which is how
 * `codecov/codecov-action@v4` (node20) sat in `test.yml` as the repo's last
 * Node-20 action with no guard ever noticing -- the shim env var below kept
 * it quiet instead.
 */
const WORKFLOW_ACTIONS: { file: string; steps: WorkflowStep[] }[] = [
  { file: WORKFLOW_PATH, steps: STEPS },
  {
    file: TESTS_WORKFLOW_PATH,
    steps: Object.values(testsWorkflow.jobs ?? {}).flatMap(
      (job) => job.steps ?? [],
    ),
  },
]

/**
 * The major at which each action upstream started running on Node 24, read
 * from that action's own `action.yml` `runs.using:` field at compat-check
 * time (2026-07-25, codecov added 2026-07-26), not from memory:
 *
 *   actions/checkout               v4 node20  -> v5 node24
 *   actions/setup-node             v4 node20  -> v5 node24
 *   actions/configure-pages        v5 node20  -> v6 node24
 *   actions/deploy-pages           v4 node20  -> v5 node24
 *   actions/upload-pages-artifact  composite; v4 pinned upload-artifact
 *                                  ea165f8d (node20), v5 pins upload-artifact
 *                                  v7 (node24)
 *   codecov/codecov-action         v4 node20 directly; v5 composite but
 *                                  transitively node20 (pins github-script
 *                                  v7.0.1, node20); v6+ pins github-script
 *                                  v8.0.0 (node24)
 *
 * The `FORCE_JAVASCRIPT_ACTIONS_TO_NODE24` deprecation shim was retired once
 * every action in both workflows reached its floor (the retirement is
 * asserted below). An action dropping back below a floor now fails this
 * suite instead of silently leaning on a shim.
 */
const NODE24_FLOOR: Record<string, number> = {
  'actions/checkout': 5,
  'actions/setup-node': 5,
  'actions/configure-pages': 6,
  'actions/upload-pages-artifact': 5,
  'actions/deploy-pages': 5,
  'codecov/codecov-action': 6,
}

/** Every `uses:` in a step list, split into action name and major version. */
function actionsIn(steps: WorkflowStep[]) {
  return steps
    .filter((step) => typeof step.uses === 'string')
    .map((step) => {
      const uses = step.uses as string
      const [name, ref = ''] = uses.split('@')
      const major = Number(/^v(\d+)/.exec(ref)?.[1] ?? NaN)
      return { uses, name, major }
    })
}

const uploadStep = STEPS.find((step) =>
  step.uses?.startsWith('actions/upload-pages-artifact@'),
)

/**
 * Dotfiles anywhere under `public/`, which vite copies verbatim into the build
 * output and which therefore land at the artifact root the tar step walks.
 */
function hiddenFilesInPublic(): string[] {
  const abs = path.join(ROOT, PUBLIC_DIR)
  return readdirSync(abs, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith('.'))
    .map((entry) =>
      path
        .relative(abs, path.join(entry.parentPath, entry.name))
        .replace(/\\/g, '/'),
    )
    .sort()
}

/** Vite's build output directory: explicit if configured, else its default. */
function viteOutDir(): string {
  const source = readFileSync(path.join(ROOT, VITE_CONFIG_PATH), 'utf-8')
  return /outDir:\s*['"]([^'"]+)['"]/.exec(source)?.[1] ?? 'dist'
}

const normalisePath = (value: string) =>
  value.trim().replace(/^\.\//, '').replace(/\/+$/, '')

describe('Workflow action runtime floor (both workflows)', () => {
  it.each(WORKFLOW_ACTIONS)(
    'parses at least one action out of $file',
    ({ file, steps }) => {
      expect(
        actionsIn(steps).length,
        `no \`uses:\` steps were parsed out of ${file}; the guard would pass vacuously`,
      ).toBeGreaterThan(0)
    },
  )

  it.each(WORKFLOW_ACTIONS)(
    'records a Node-24 floor for every action $file uses',
    ({ file, steps }) => {
      const unrecorded = actionsIn(steps)
        .filter((action) => !(action.name in NODE24_FLOOR))
        .map((action) => action.uses)

      expect(
        unrecorded,
        `${file} uses actions with no recorded Node-24 floor. Read that action's ` +
          '`action.yml` `runs.using:` upstream and add the major to NODE24_FLOOR, so this ' +
          'guard cannot go blind as the workflows grow.',
      ).toEqual([])
    },
  )

  it.each(WORKFLOW_ACTIONS)(
    'pins every action in $file at or above the major that runs on Node 24',
    ({ steps }) => {
      const belowFloor = actionsIn(steps)
        .filter((action) => {
          const floor = NODE24_FLOOR[action.name]
          return floor !== undefined && !(action.major >= floor)
        })
        .map((action) => `${action.uses} (needs v${NODE24_FLOOR[action.name]}+)`)

      expect(
        belowFloor,
        'these actions still target Node 20 and would need the retired ' +
          'FORCE_JAVASCRIPT_ACTIONS_TO_NODE24 deprecation shim back to run',
      ).toEqual([])
    },
  )

  it.each([
    { file: WORKFLOW_PATH, parsed: workflow },
    { file: TESTS_WORKFLOW_PATH, parsed: testsWorkflow },
  ])(
    'does not carry the retired Node-24 deprecation shim in $file',
    ({ file, parsed }) => {
      expect(
        parsed.env?.FORCE_JAVASCRIPT_ACTIONS_TO_NODE24,
        `${file} re-declares FORCE_JAVASCRIPT_ACTIONS_TO_NODE24, retired 2026-07-26 ` +
          'once every action reached its Node-24 floor. The floor contract above ' +
          'already fails on any action that would need it, so the shim is dead ' +
          'config here: fix the action version instead of re-adding the shim.',
      ).toBeUndefined()
    },
  )
})

describe('Pages deploy workflow: artifact contents', () => {
  it('uploads the Pages artifact from vite\'s real build output directory', () => {
    expect(uploadStep, 'no actions/upload-pages-artifact step found').toBeDefined()
    expect(normalisePath(String(uploadStep?.with?.path ?? ''))).toBe(viteOutDir())
  })

  it('includes hidden files whenever any are destined for the artifact root', () => {
    const hidden = hiddenFilesInPublic()
    const includesHidden = uploadStep?.with?.['include-hidden-files'] === true

    if (hidden.length === 0) {
      expect(
        includesHidden,
        `no dotfiles are destined for the artifact root, so \`include-hidden-files\` ` +
          'should stay unset and this guard should be the thing that turns it on. ' +
          'If it was set deliberately, add the dotfile it exists for.',
      ).toBe(false)
      return
    }

    expect(
      includesHidden,
      `${PUBLIC_DIR}/ contains dotfiles that vite copies into the build output ` +
        `(${hidden.join(', ')}), but upload-pages-artifact v5+ excludes hidden files ` +
        'by default, so they would be missing from the deployed site with a green ' +
        'deploy. Set `include-hidden-files: true` on the upload step.',
    ).toBe(true)
  })
})

describe('Pages deploy workflow: token posture', () => {
  it('keeps the workflow permissions least-privilege', () => {
    expect(workflow.permissions).toEqual({
      contents: 'read',
      pages: 'write',
      'id-token': 'write',
    })
  })
})

/**
 * Structural "switch myself off" guard (v1.21.1 follow-up, closes the PR #93
 * contract-E scope cut).
 *
 * envContract.test.ts contract E catches the BADGE-DEAD-1 shape by the STRING
 * literal 'disabled' -- exactly the token the retired monitoring modules used.
 * That tripwire stays (it is cheap and proven), but a module writing the same
 * logic as `phase: 'off'`, `mode: 'hidden'` or a bare `if (!SOME_URL) return
 * null` slips past a string match. This file matches the STRUCTURE instead,
 * with the TypeScript AST rather than a source regex:
 *
 *   Shape 1  component-null-on-env-emptiness
 *            Inside a React component's render path (a PascalCase function
 *            containing JSX), a `return null` guarded by an emptiness test of
 *            an env-derived value: `if (!SOME_URL) return null`.
 *
 *   Shape 2  state-literal-null-join
 *            The two-module version the retired code actually used. A PRODUCER
 *            derives a string literal from env emptiness (`MONITORING_URL ?
 *            {phase:'loading'} : {phase:'disabled'}`), and a CONSUMER
 *            component returns null when some value equals that literal
 *            (`if (state.phase === 'disabled') return null`). Producer and
 *            consumer are matched on the literal across ALL scanned modules,
 *            so the halves are caught even when they live in different files
 *            (the retired hook and section did).
 *
 * Deliberate boundaries, each encoded as a fixture below:
 *   - `return null` in a plain helper or callback is NOT flagged: null is a
 *     data value there, handled by the caller. The live example is
 *     ObservaboardPage's `buildUrl`, whose null flows into a visible
 *     "VITE_OBSERVABOARD_URL is not configured" error -- the healthy pattern.
 *     The walker therefore never descends into nested function expressions
 *     when scanning a component's render path.
 *   - A bare `return` (no value) is NOT flagged: that is the standard effect
 *     guard (`if (!url) return` inside useEffect), not a vanishing surface.
 *   - An emptiness guard that renders an explicit message (PortalLoginGate's
 *     "Auth service not configured") is the pattern this repo wants; only the
 *     silent `return null` is an offence.
 *
 * Every scan is a drift guard, not a one-time reconciliation (L-003): the real
 * assertion reads every production source under src/ at run time, and the
 * fixtures prove the analyzer can both fire and stay silent (L-001).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const ROOT = process.cwd()

/** Every `.ts`/`.tsx` file under `src/`, excluding test files. */
function sourceFiles(dir = 'src'): string[] {
  const found: string[] = []
  for (const entry of readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${entry.name}`
    if (entry.isDirectory()) found.push(...sourceFiles(rel))
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) found.push(rel)
  }
  return found.sort()
}

interface ModuleSource {
  file: string
  source: string
}

interface Producer {
  file: string
  envName: string
  literal: string
}

interface Offence {
  shape: 'component-null-on-env-emptiness' | 'state-literal-null-join'
  detail: string
}

const ENV_READ = /import\.meta\.env\.(VITE_[A-Z0-9_]+)/

function parseModule({ file, source }: ModuleSource): ts.SourceFile {
  // Script kind must follow the extension: parsing a .ts file as TSX would
  // misread `<T>value` type assertions as JSX.
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind)
}

function stripParens(expr: ts.Expression): ts.Expression {
  let current = expr
  while (ts.isParenthesizedExpression(current)) current = current.expression
  return current
}

/**
 * Names in this module whose value derives from build-time env config: a
 * `*_URL` import from src/config, a `const X = import.meta.env.VITE_*` read,
 * or a declaration initialized from either (transitively, to a fixpoint).
 */
function envDerivedNames(sf: ts.SourceFile): Set<string> {
  const names = new Set<string>()
  for (const stmt of sf.statements) {
    if (!ts.isImportDeclaration(stmt) || !ts.isStringLiteral(stmt.moduleSpecifier)) continue
    if (!/(^|\/)config$/.test(stmt.moduleSpecifier.text)) continue
    const bindings = stmt.importClause?.namedBindings
    if (bindings && ts.isNamedImports(bindings)) {
      for (const el of bindings.elements) {
        if (/_URL/.test(el.name.text)) names.add(el.name.text)
      }
    }
  }
  let grew = true
  let rounds = 0
  while (grew && rounds < 5) {
    grew = false
    rounds += 1
    const visit = (node: ts.Node): void => {
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.initializer &&
        !names.has(node.name.text)
      ) {
        const initText = node.initializer.getText(sf)
        if (ENV_READ.test(initText) || envRef(node.initializer, names, sf) !== null) {
          names.add(node.name.text)
          grew = true
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }
  return names
}

/**
 * The env-derived name an expression references, or null. Identifiers in
 * property-NAME position (`state.phase` -> `phase`) do not count; the object
 * being accessed (`state`) does.
 */
function envRef(node: ts.Node, names: Set<string>, sf: ts.SourceFile): string | null {
  let found: string | null = null
  const visit = (n: ts.Node): void => {
    if (found) return
    if (ts.isIdentifier(n) && names.has(n.text)) {
      const p = n.parent
      const isPropertyName =
        (ts.isPropertyAccessExpression(p) && p.name === n) ||
        (ts.isPropertyAssignment(p) && p.name === n)
      if (!isPropertyName) {
        found = n.text
        return
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  if (found) return found
  const direct = ENV_READ.exec(node.getText(sf))
  return direct ? direct[1] : null
}

/** The env name whose EMPTINESS this condition tests (`!X`, `X === ''`, ...). */
function emptinessTest(cond: ts.Expression, names: Set<string>, sf: ts.SourceFile): string | null {
  const c = stripParens(cond)
  if (ts.isPrefixUnaryExpression(c) && c.operator === ts.SyntaxKind.ExclamationToken) {
    return envRef(c.operand, names, sf)
  }
  if (ts.isBinaryExpression(c)) {
    const op = c.operatorToken.kind
    if (op !== ts.SyntaxKind.EqualsEqualsEqualsToken && op !== ts.SyntaxKind.EqualsEqualsToken) {
      return null
    }
    const isEmptyLiteral = (e: ts.Expression): boolean =>
      (ts.isStringLiteral(e) && e.text === '') ||
      e.kind === ts.SyntaxKind.NullKeyword ||
      (ts.isIdentifier(e) && e.text === 'undefined') ||
      (ts.isNumericLiteral(e) && e.text === '0')
    if (isEmptyLiteral(c.right)) return envRef(c.left, names, sf)
    if (isEmptyLiteral(c.left)) return envRef(c.right, names, sf)
  }
  return null
}

/** The env name whose PRESENCE this condition tests (a bare truthy reference). */
function truthinessTest(cond: ts.Expression, names: Set<string>, sf: ts.SourceFile): string | null {
  const c = stripParens(cond)
  if (ts.isPrefixUnaryExpression(c) || ts.isBinaryExpression(c)) return null
  return envRef(c, names, sf)
}

/** String literals produced on the EMPTY side of an env-derived conditional. */
function producerLiterals(sf: ts.SourceFile, names: Set<string>, file: string): Producer[] {
  const out: Producer[] = []
  const collect = (node: ts.Node, envName: string): void => {
    const visit = (n: ts.Node): void => {
      if (ts.isStringLiteral(n) && n.text.length > 0) out.push({ file, envName, literal: n.text })
      ts.forEachChild(n, visit)
    }
    visit(node)
  }
  const visit = (node: ts.Node): void => {
    if (ts.isConditionalExpression(node)) {
      const present = truthinessTest(node.condition, names, sf)
      if (present) collect(node.whenFalse, present)
      const empty = emptinessTest(node.condition, names, sf)
      if (empty) collect(node.whenTrue, empty)
    }
    if (ts.isIfStatement(node)) {
      const empty = emptinessTest(node.expression, names, sf)
      if (empty) collect(node.thenStatement, empty)
      const present = truthinessTest(node.expression, names, sf)
      if (present && node.elseStatement) collect(node.elseStatement, present)
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

type FunctionLike = ts.FunctionDeclaration | ts.FunctionExpression | ts.ArrowFunction

function containsJsx(node: ts.Node): boolean {
  let found = false
  const visit = (n: ts.Node): void => {
    if (found) return
    if (
      n.kind === ts.SyntaxKind.JsxElement ||
      n.kind === ts.SyntaxKind.JsxSelfClosingElement ||
      n.kind === ts.SyntaxKind.JsxFragment
    ) {
      found = true
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(node)
  return found
}

/** Every PascalCase-named function in the module whose body contains JSX. */
function componentFunctions(sf: ts.SourceFile): Array<{ name: string; fn: FunctionLike }> {
  const out: Array<{ name: string; fn: FunctionLike }> = []
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name && /^[A-Z]/.test(node.name.text) && node.body) {
      if (containsJsx(node.body)) out.push({ name: node.name.text, fn: node })
    }
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      /^[A-Z]/.test(node.name.text) &&
      node.initializer
    ) {
      const init = stripParens(node.initializer as ts.Expression)
      if ((ts.isArrowFunction(init) || ts.isFunctionExpression(init)) && containsJsx(init)) {
        out.push({ name: node.name.text, fn: init })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

function isNullReturn(stmt: ts.Statement): boolean {
  return (
    ts.isReturnStatement(stmt) &&
    stmt.expression !== undefined &&
    stmt.expression.kind === ts.SyntaxKind.NullKeyword
  )
}

/** `return null` directly, or as a direct statement of the guarded block. */
function thenReturnsNull(stmt: ts.Statement): boolean {
  if (isNullReturn(stmt)) return true
  if (ts.isBlock(stmt)) return stmt.statements.some(isNullReturn)
  return false
}

/** String literals equality-compared anywhere inside a condition. */
function comparedLiterals(cond: ts.Expression): string[] {
  const out: string[] = []
  const visit = (n: ts.Node): void => {
    if (
      ts.isBinaryExpression(n) &&
      (n.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken ||
        n.operatorToken.kind === ts.SyntaxKind.EqualsEqualsToken)
    ) {
      if (ts.isStringLiteral(n.right)) out.push(n.right.text)
      if (ts.isStringLiteral(n.left)) out.push(n.left.text)
    }
    ts.forEachChild(n, visit)
  }
  visit(cond)
  return out
}

/**
 * Walk a component's RENDER PATH only: if-statements in its body, never
 * descending into nested functions (callbacks, useCallback builders, nested
 * component definitions), where `return null` belongs to the inner function.
 */
function renderPathIfs(fn: FunctionLike): ts.IfStatement[] {
  const out: ts.IfStatement[] = []
  const visit = (n: ts.Node): void => {
    if (ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n)) return
    if (ts.isIfStatement(n)) out.push(n)
    ts.forEachChild(n, visit)
  }
  if (fn.body) ts.forEachChild(fn.body, visit)
  return out
}

/** The whole analysis over a set of modules. Exported shape for the fixtures. */
function analyzeModules(modules: ModuleSource[]): Offence[] {
  const offences: Offence[] = []
  const producers: Producer[] = []
  const consumers: Array<{ file: string; component: string; line: number; literal: string }> = []

  for (const mod of modules) {
    const sf = parseModule(mod)
    const names = envDerivedNames(sf)
    producers.push(...producerLiterals(sf, names, mod.file))

    for (const { name, fn } of componentFunctions(sf)) {
      for (const guard of renderPathIfs(fn)) {
        if (!thenReturnsNull(guard.thenStatement)) continue
        const line = sf.getLineAndCharacterOfPosition(guard.getStart(sf)).line + 1
        const empty = emptinessTest(guard.expression, names, sf)
        if (empty) {
          offences.push({
            shape: 'component-null-on-env-emptiness',
            detail: `${mod.file}:${line} <${name}> returns null when env-derived '${empty}' is empty`,
          })
        }
        for (const literal of comparedLiterals(guard.expression)) {
          consumers.push({ file: mod.file, component: name, line, literal })
        }
      }
    }
  }

  for (const consumer of consumers) {
    for (const producer of producers) {
      if (producer.literal !== consumer.literal) continue
      offences.push({
        shape: 'state-literal-null-join',
        detail:
          `${consumer.file}:${consumer.line} <${consumer.component}> returns null on ` +
          `'${consumer.literal}', which ${producer.file} derives from env-derived ` +
          `'${producer.envName}' being empty`,
      })
    }
  }

  return offences
}

// ---------------------------------------------------------------------------
// Fixtures: the analyzer must FIRE on the defect shapes and STAY SILENT on the
// healthy ones. The producer/consumer pair below is the retired v1.21.1 code
// (useBuildStatus.ts + BuildStatusSection.tsx, git 554c64f~1) trimmed to the
// load-bearing lines but byte-faithful where it matters: the useState ternary
// and the phase guard are verbatim.
// ---------------------------------------------------------------------------

const RETIRED_HOOK: ModuleSource = {
  file: 'fixture/useBuildStatus.ts',
  source: `
import { useState, useEffect } from 'react'
import { MONITORING_URL } from '../../config'

export type BuildStatusState =
  | { phase: 'disabled' }
  | { phase: 'loading' }
  | { phase: 'ready' }
  | { phase: 'error' }

export function useBuildStatus(): BuildStatusState {
  const [state, setState] = useState<BuildStatusState>(
    MONITORING_URL ? { phase: 'loading' } : { phase: 'disabled' }
  )
  const monitoringUrl = MONITORING_URL.replace(/\\/$/, '')
  useEffect(() => {
    if (!monitoringUrl) return
    setState({ phase: 'ready' })
  }, [monitoringUrl])
  return state
}
`,
}

const RETIRED_COMPONENT: ModuleSource = {
  file: 'fixture/BuildStatusSection.tsx',
  source: `
import { MONITORING_URL } from '../../config'
import { useBuildStatus } from './useBuildStatus'

export function BuildStatusSection() {
  const state = useBuildStatus()

  if (state.phase === 'disabled' || state.phase === 'error') return null

  return (
    <section>
      <a href={MONITORING_URL}>Full dashboard</a>
    </section>
  )
}
`,
}

const DIRECT_NULL_COMPONENT: ModuleSource = {
  file: 'fixture/DirectNull.tsx',
  source: `
const SOME_URL = (import.meta.env.VITE_SOME_URL as string | undefined) ?? ''

export function SomePanel() {
  if (!SOME_URL) return null
  return <div>{SOME_URL}</div>
}
`,
}

const RENAMED_STATE_COMPONENT: ModuleSource = {
  file: 'fixture/RenamedState.tsx',
  source: `
import { FEED_URL } from '../config'

export function FeedPanel() {
  const mode = FEED_URL ? 'live' : 'hidden'
  if (mode === 'hidden') return null
  return <div>feed</div>
}
`,
}

const HEALTHY_MESSAGE_COMPONENT: ModuleSource = {
  file: 'fixture/HealthyMessage.tsx',
  source: `
import { AUTH_SERVICE_URL } from '../config'

export function LoginGate() {
  if (!AUTH_SERVICE_URL) {
    return <p>Auth service not configured (VITE_AUTH_SERVICE_URL)</p>
  }
  return <form>sign in</form>
}
`,
}

const HEALTHY_HELPER_COMPONENT: ModuleSource = {
  file: 'fixture/HealthyHelper.tsx',
  source: `
import { useCallback, useState } from 'react'

const BOARD_URL = (import.meta.env.VITE_BOARD_URL as string | undefined) ?? ''

export function BoardView() {
  const [error, setError] = useState<string | null>(null)
  const buildUrl = useCallback(() => {
    if (!BOARD_URL) return null
    return BOARD_URL + '/api/events/'
  }, [])
  const load = () => {
    const url = buildUrl()
    if (!url) setError('VITE_BOARD_URL is not configured')
  }
  return <div onClick={load}>{error}</div>
}
`,
}

const HEALTHY_NON_ENV_COMPONENT: ModuleSource = {
  file: 'fixture/HealthyNonEnv.tsx',
  source: `
export function Palette({ open }: { open: boolean }) {
  if (!open) return null
  return <div>palette</div>
}
`,
}

// ---------------------------------------------------------------------------
// The real scan target: every production source under src/.
// ---------------------------------------------------------------------------

const SOURCE_FILES = sourceFiles()
const REAL_MODULES: ModuleSource[] = SOURCE_FILES.map((file) => ({
  file,
  source: readFileSync(path.join(ROOT, file), 'utf-8'),
}))

describe('env visibility: the analyzer is not vacuous', () => {
  it('scans the real source tree', () => {
    expect(SOURCE_FILES.length, 'no source files found; the scan would pass vacuously')
      .toBeGreaterThan(100)
  })

  it('finds component functions in the real tree', () => {
    const componentCount = REAL_MODULES.map(parseModule).reduce(
      (n, sf) => n + componentFunctions(sf).length,
      0,
    )
    expect(componentCount, 'no PascalCase JSX functions found; the walker is broken')
      .toBeGreaterThan(20)
  })

  it('extracts env-derived names from src/config.ts', () => {
    const config = REAL_MODULES.find((m) => m.file === 'src/config.ts')
    expect(config, 'src/config.ts missing from the scan set').toBeDefined()
    const names = envDerivedNames(parseModule(config!))
    expect(
      [...names],
      'no env-derived names parsed out of src/config.ts; the seed detection is broken',
    ).toContain('EVENT_STREAM_URL')
  })
})

describe('env visibility: the analyzer fires on the defect shapes (L-001)', () => {
  it('flags the verbatim retired producer/consumer pair on the disabled literal', () => {
    const offences = analyzeModules([RETIRED_HOOK, RETIRED_COMPONENT])
    const joins = offences.filter((o) => o.shape === 'state-literal-null-join')
    expect(joins).toHaveLength(1)
    expect(joins[0].detail).toContain('fixture/BuildStatusSection.tsx')
    expect(joins[0].detail).toContain("'disabled'")
    expect(joins[0].detail).toContain('fixture/useBuildStatus.ts')
    expect(joins[0].detail).toContain("'MONITORING_URL'")
    // 'error' is compared in the same guard but never derived from env
    // emptiness, so it must NOT join: the match is on provenance, not on any
    // string the guard happens to mention.
    expect(offences.some((o) => o.detail.includes("'error'"))).toBe(false)
  })

  it('flags the direct if-not-url-return-null shape the string match never saw', () => {
    const offences = analyzeModules([DIRECT_NULL_COMPONENT])
    expect(offences).toHaveLength(1)
    expect(offences[0].shape).toBe('component-null-on-env-emptiness')
    expect(offences[0].detail).toContain('<SomePanel>')
    expect(offences[0].detail).toContain("'SOME_URL'")
  })

  it("flags a renamed state literal ('hidden') the 'disabled' tripwire misses", () => {
    const offences = analyzeModules([RENAMED_STATE_COMPONENT])
    const joins = offences.filter((o) => o.shape === 'state-literal-null-join')
    expect(joins).toHaveLength(1)
    expect(joins[0].detail).toContain("'hidden'")
    expect(joins[0].detail).toContain('<FeedPanel>')
    expect(joins[0].detail).toContain("'FEED_URL'")
  })
})

describe('env visibility: the analyzer stays silent on the healthy shapes', () => {
  it('accepts an emptiness guard that renders an explicit message', () => {
    expect(analyzeModules([HEALTHY_MESSAGE_COMPONENT])).toEqual([])
  })

  it('accepts null as a data value in a helper whose caller reports visibly', () => {
    expect(analyzeModules([HEALTHY_HELPER_COMPONENT])).toEqual([])
  })

  it('accepts a component that returns null on a non-env prop', () => {
    expect(analyzeModules([HEALTHY_NON_ENV_COMPONENT])).toEqual([])
  })
})

describe('env visibility: no production module switches itself off', () => {
  it('finds no silent env-driven vanishing surface anywhere under src/', () => {
    const offences = analyzeModules(REAL_MODULES)
    expect(
      offences.map((o) => `${o.shape}: ${o.detail}`),
      'these render paths vanish when a build variable is unset -- the BADGE-DEAD-1 ' +
        'shape, structurally. Render an explicit "not configured" state instead, the ' +
        'way PortalLoginGate, LiveFeedTab and ServiceHealthPage do.',
    ).toEqual([])
  })
})

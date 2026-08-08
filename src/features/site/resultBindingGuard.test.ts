/**
 * v1.25.3 result-binding guard (ROADMAP "v1.25 - The funnel never confirms
 * what it did not deliver", decision D-20). This is the slice that makes the
 * milestone's defect class UNREPRESENTABLE rather than merely fixed.
 *
 * THE CLASS. `submitPublicLead` returns a discriminated `LeadIntakeResult`
 * (`{ ok: true } | { ok: false; reason; message }`) whose failure branch was
 * already covered by a passing unit test -- and two call sites threw the value
 * away in statement position, then set the success state unconditionally. The
 * module was correct; nobody read it. v1.25.1 fixed the two sites and v1.25.2
 * made the failure recoverable, but nothing stopped the third site from being
 * written the same way tomorrow. TypeScript will not: discarding a returned
 * value is legal, and `no-floating-promises` (not enabled here, and it would
 * not help) only cares that the promise is awaited, not that its VALUE is read.
 *
 * WHAT THIS ASSERTS, structurally and with the TypeScript AST rather than a
 * source regex:
 *
 *   1. Discover the RESULT TYPES from source: every union type of exactly two
 *      object members carrying an `ok` property typed as the LITERAL `true` in
 *      one arm and the LITERAL `false` in the other. Both the named aliases
 *      (`LeadIntakeResult`, `CrmSyncResult`) and the inline unions
 *      (`tryItAdapter.mock.ts`'s two parse helpers) are found the same way.
 *   2. Discover the RESULT FUNCTIONS: every function whose DECLARED return
 *      type is one of those, or a `Promise<>` of one. Never hand-listed -- a
 *      fifth result type added tomorrow is picked up with no edit here, which
 *      is the L-031 failure mode this shape exists to avoid.
 *   3. Assert every non-test call site under `src/` either branches on the
 *      discriminant immediately, forwards the value on, or binds it to an
 *      identifier whose `ok` is actually read. A bare statement-position call
 *      fails, and so does a binding nobody reads -- because "bind the result"
 *      is trivially satisfiable by an unused `const` (L-033), the guard checks
 *      the DISCRIMINANT, the only thing that distinguishes the two arms.
 *
 * WHY THERE IS NO ALLOWLIST. D-20 scopes by the RESULT TYPE's structure, so
 * the one deliberate discard in this repo -- `PortalForgotPasswordPage.tsx:17`
 * throwing away a `Response` to avoid email enumeration -- is outside the
 * guard with nothing to exempt, and `EditRowResult` / `RowResult` (`ok:
 * boolean`, not a two-arm literal union) are outside it for the same reason.
 * v1.23 D-12 deleted this repo's last exemption mechanism; an empty allowlist
 * is an invitation to add one entry "just this once".
 *
 * WHAT THIS DOES NOT PROVE. The discovery is driven by the DECLARED return
 * type, so a result-returning function that omits its annotation and relies on
 * inference is invisible here. Every one of the five in the tree today is
 * annotated, and the non-vacuity block below fails loudly if the discovered
 * set collapses, but the annotation itself is not enforced -- a syntactic
 * check cannot distinguish `{ ok: true }` written as a literal-typed
 * discriminant from the same text contextually typed as `ok: boolean` (the
 * live `bulkEditApi.mock.ts` shape). Filed as RESULT-ANNOTATION-BLIND-1
 * rather than claimed here (L-046). Nor does it prove the branch does anything
 * USEFUL: `leadDeliveryTruth.test.ts` is what holds the rendered behaviour on
 * each arm, both directions, on both consultation surfaces.
 *
 * Every scan is a drift guard, not a one-time reconciliation: the real
 * assertion reads every production source under `src/` at run time, and the
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

interface ResultFunction {
  /** `file:line` of the declaration, for the report. */
  where: string
  name: string
  /** The declared return type, verbatim, so the report shows WHY it qualified. */
  returnType: string
}

interface CallSite {
  where: string
  callee: string
  /** How the value is used. Everything but `discarded`/`unread` is healthy. */
  disposition:
    | 'bound-and-discriminant-read'
    | 'destructured-discriminant'
    | 'branched-immediately'
    | 'forwarded'
    | 'discarded-in-statement-position'
    | 'bound-but-discriminant-never-read'
}

interface Analysis {
  resultTypes: string[]
  resultFunctions: ResultFunction[]
  callSites: CallSite[]
  offences: string[]
}

function parseModule({ file, source }: ModuleSource): ts.SourceFile {
  // Script kind must follow the extension: parsing a .ts file as TSX would
  // misread `<T>value` type assertions as JSX.
  const kind = file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  return ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, kind)
}

function positionOf(node: ts.Node, sf: ts.SourceFile, file: string): string {
  return `${file}:${sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1}`
}

/** The literal `true`/`false` an `ok` property of an object type is typed as. */
function okLiteral(member: ts.TypeNode): boolean | null {
  if (!ts.isTypeLiteralNode(member)) return null
  for (const prop of member.members) {
    if (!ts.isPropertySignature(prop) || !prop.type) continue
    if (!ts.isIdentifier(prop.name) || prop.name.text !== 'ok') continue
    if (!ts.isLiteralTypeNode(prop.type)) return null
    if (prop.type.literal.kind === ts.SyntaxKind.TrueKeyword) return true
    if (prop.type.literal.kind === ts.SyntaxKind.FalseKeyword) return false
    return null
  }
  return null
}

/**
 * A two-arm `ok` discriminated union: exactly two object members, one typed
 * `ok: true` and the other `ok: false`. `ok: boolean` is NOT this shape, which
 * is exactly how `EditRowResult` and `RowResult` stay out of scope.
 */
function isTwoArmOkUnion(type: ts.TypeNode | undefined): boolean {
  if (!type || !ts.isUnionTypeNode(type) || type.types.length !== 2) return false
  const arms = type.types.map(okLiteral)
  return arms.includes(true) && arms.includes(false)
}

/** Result-type ALIAS names declared anywhere in the scanned modules. */
function resultTypeAliases(modules: ModuleSource[]): Set<string> {
  const names = new Set<string>()
  for (const mod of modules) {
    const sf = parseModule(mod)
    const visit = (node: ts.Node): void => {
      if (ts.isTypeAliasDeclaration(node) && isTwoArmOkUnion(node.type)) names.add(node.name.text)
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }
  return names
}

/**
 * The declared return type text when it is a result type: the union inline, an
 * alias reference, or a `Promise<>` of either. Null when it is anything else.
 */
function resultReturnType(
  type: ts.TypeNode | undefined,
  aliases: Set<string>,
  sf: ts.SourceFile,
): string | null {
  if (!type) return null
  if (isTwoArmOkUnion(type)) return type.getText(sf)
  if (ts.isTypeReferenceNode(type)) {
    if (ts.isIdentifier(type.typeName)) {
      if (aliases.has(type.typeName.text)) return type.getText(sf)
      if (type.typeName.text === 'Promise' && type.typeArguments?.length === 1) {
        const inner = resultReturnType(type.typeArguments[0], aliases, sf)
        return inner === null ? null : type.getText(sf)
      }
    }
  }
  return null
}

/** Every function in a module whose DECLARED return type is a result type. */
function resultFunctions(mod: ModuleSource, aliases: Set<string>): ResultFunction[] {
  const sf = parseModule(mod)
  const out: ResultFunction[] = []
  const record = (name: string, type: ts.TypeNode | undefined, node: ts.Node): void => {
    const returnType = resultReturnType(type, aliases, sf)
    if (returnType === null) return
    out.push({ where: positionOf(node, sf, mod.file), name, returnType })
  }
  const visit = (node: ts.Node): void => {
    if (ts.isFunctionDeclaration(node) && node.name) record(node.name.text, node.type, node)
    if (ts.isMethodDeclaration(node) && ts.isIdentifier(node.name)) {
      record(node.name.text, node.type, node)
    }
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const init = node.initializer
      if (ts.isArrowFunction(init) || ts.isFunctionExpression(init)) {
        record(node.name.text, init.type, node)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

type FunctionLike =
  | ts.FunctionDeclaration
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.MethodDeclaration

/** The nearest enclosing function, or the source file when there is none. */
function enclosingScope(node: ts.Node): ts.Node {
  let current: ts.Node | undefined = node.parent
  while (current) {
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isArrowFunction(current) ||
      ts.isMethodDeclaration(current)
    ) {
      return current as FunctionLike
    }
    if (ts.isSourceFile(current)) return current
    current = current.parent
  }
  return node
}

/** Is `<name>.ok` read anywhere inside this scope? */
function discriminantRead(scope: ts.Node, name: string): boolean {
  let found = false
  const visit = (n: ts.Node): void => {
    if (found) return
    if (
      ts.isPropertyAccessExpression(n) &&
      ts.isIdentifier(n.expression) &&
      n.expression.text === name &&
      n.name.text === 'ok'
    ) {
      found = true
      return
    }
    // `const { ok } = result` reads the discriminant just as well.
    if (
      ts.isVariableDeclaration(n) &&
      ts.isObjectBindingPattern(n.name) &&
      n.initializer &&
      ts.isIdentifier(n.initializer) &&
      n.initializer.text === name &&
      n.name.elements.some((el) => ts.isIdentifier(el.propertyName ?? el.name) && (el.propertyName ?? el.name).getText() === 'ok')
    ) {
      found = true
      return
    }
    ts.forEachChild(n, visit)
  }
  visit(scope)
  return found
}

/** Is the identifier forwarded on -- returned, or passed to another call? */
function forwardedOn(scope: ts.Node, name: string): boolean {
  let found = false
  const visit = (n: ts.Node): void => {
    if (found) return
    if (ts.isReturnStatement(n) && n.expression && ts.isIdentifier(n.expression)) {
      if (n.expression.text === name) {
        found = true
        return
      }
    }
    if (ts.isCallExpression(n)) {
      if (n.arguments.some((arg) => ts.isIdentifier(arg) && arg.text === name)) {
        found = true
        return
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(scope)
  return found
}

/** Classify one call of a result function by what happens to its value. */
function dispositionOf(call: ts.CallExpression): CallSite['disposition'] {
  // Step over `await`/parenthesis wrappers to find the syntactic consumer.
  let node: ts.Node = call
  while (
    node.parent &&
    (ts.isAwaitExpression(node.parent) || ts.isParenthesizedExpression(node.parent))
  ) {
    node = node.parent
  }
  const parent = node.parent

  if (!parent) return 'discarded-in-statement-position'
  if (ts.isExpressionStatement(parent) || ts.isVoidExpression(parent)) {
    return 'discarded-in-statement-position'
  }
  // `(await f()).ok`, `if ((await f()).ok)` -- the discriminant is read on the
  // value itself, with no binding to check.
  if (ts.isPropertyAccessExpression(parent) || ts.isElementAccessExpression(parent)) {
    return 'branched-immediately'
  }
  if (ts.isVariableDeclaration(parent)) {
    if (ts.isObjectBindingPattern(parent.name)) {
      const readsOk = parent.name.elements.some(
        (el) => (el.propertyName ?? el.name).getText() === 'ok',
      )
      return readsOk ? 'destructured-discriminant' : 'bound-but-discriminant-never-read'
    }
    if (ts.isIdentifier(parent.name)) {
      const scope = enclosingScope(parent)
      const name = parent.name.text
      if (discriminantRead(scope, name)) return 'bound-and-discriminant-read'
      if (forwardedOn(scope, name)) return 'forwarded'
      return 'bound-but-discriminant-never-read'
    }
  }
  // Returned, passed as an argument, assigned into a property, spread: the
  // union travels on intact and its reader is somewhere else.
  return 'forwarded'
}

const OFFENDING: ReadonlySet<CallSite['disposition']> = new Set([
  'discarded-in-statement-position',
  'bound-but-discriminant-never-read',
])

/** The whole analysis over a set of modules. */
function analyzeModules(modules: ModuleSource[]): Analysis {
  const aliases = resultTypeAliases(modules)
  const functions: ResultFunction[] = []
  for (const mod of modules) functions.push(...resultFunctions(mod, aliases))
  const names = new Set(functions.map((f) => f.name))

  const callSites: CallSite[] = []
  for (const mod of modules) {
    const sf = parseModule(mod)
    const visit = (node: ts.Node): void => {
      if (ts.isCallExpression(node)) {
        const callee = ts.isIdentifier(node.expression)
          ? node.expression.text
          : ts.isPropertyAccessExpression(node.expression)
            ? node.expression.name.text
            : null
        if (callee && names.has(callee)) {
          callSites.push({
            where: positionOf(node, sf, mod.file),
            callee,
            disposition: dispositionOf(node),
          })
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
  }

  const offences = callSites
    .filter((c) => OFFENDING.has(c.disposition))
    .map((c) => `${c.where} ${c.disposition}: ${c.callee}()`)

  return {
    resultTypes: [...aliases].sort(),
    resultFunctions: functions,
    callSites,
    offences,
  }
}

// ---------------------------------------------------------------------------
// Fixtures: the analyzer must FIRE on the defect shapes and STAY SILENT on the
// healthy ones. DEFECT_DISCARD is the pre-v1.25.1 `ContactCTA` handler trimmed
// to its load-bearing lines, byte-faithful where it matters -- the bare
// statement-position `await` and the unconditional `setPhase('sent')` are
// verbatim from git `2d4e610~3:src/features/site/ContactCTA.tsx`.
// ---------------------------------------------------------------------------

const RESULT_MODULE: ModuleSource = {
  file: 'fixture/leadIntake.ts',
  source: `
export type LeadIntakeResult =
  | { ok: true }
  | { ok: false; reason: 'not-configured' | 'request-failed'; message: string }

export async function submitLead(request: { email: string }): Promise<LeadIntakeResult> {
  return { ok: true }
}
`,
}

const DEFECT_DISCARD: ModuleSource = {
  file: 'fixture/ContactCTA.tsx',
  source: `
import { submitLead } from './leadIntake'

export function ContactCTA() {
  const onSubmit = async (request: { email: string }) => {
    await submitLead(request)
    setPhase('sent')
  }
  return <form onSubmit={onSubmit} />
}
`,
}

const DEFECT_UNREAD_BINDING: ModuleSource = {
  file: 'fixture/UnreadBinding.tsx',
  source: `
import { submitLead } from './leadIntake'

export function ContactPanel() {
  const onSubmit = async (request: { email: string }) => {
    const intakeResult = await submitLead(request)
    setPhase('sent')
  }
  return <form onSubmit={onSubmit} />
}
`,
}

const DEFECT_PARTIAL_DESTRUCTURE: ModuleSource = {
  file: 'fixture/PartialDestructure.tsx',
  source: `
import { submitLead } from './leadIntake'

export function ContactBanner() {
  const onSubmit = async (request: { email: string }) => {
    const { message } = await submitLead(request)
    setPhase('sent')
  }
  return <form onSubmit={onSubmit} />
}
`,
}

/** The tryItAdapter shape: an INLINE union with no alias to key off. */
const DEFECT_INLINE_UNION: ModuleSource = {
  file: 'fixture/inlineUnion.ts',
  source: `
function readIntParam(
  query: Record<string, string>,
  name: string,
): { ok: true; value: number | undefined } | { ok: false; result: string } {
  return { ok: true, value: undefined }
}

export function run(query: Record<string, string>): string {
  readIntParam(query, 'limit')
  return 'ok'
}
`,
}

const HEALTHY_BRANCHED: ModuleSource = {
  file: 'fixture/HealthyBranched.tsx',
  source: `
import { submitLead } from './leadIntake'

export function HealthyForm() {
  const onSubmit = async (request: { email: string }) => {
    const intakeResult = await submitLead(request)
    setDeliveryStatus(intakeResult.ok ? 'sent' : 'failed')
  }
  return <form onSubmit={onSubmit} />
}
`,
}

const HEALTHY_DESTRUCTURED: ModuleSource = {
  file: 'fixture/HealthyDestructured.ts',
  source: `
import { submitLead } from './leadIntake'

export async function send(request: { email: string }): Promise<string> {
  const { ok } = await submitLead(request)
  return ok ? 'sent' : 'failed'
}
`,
}

const HEALTHY_FORWARDED: ModuleSource = {
  file: 'fixture/HealthyForwarded.ts',
  source: `
import { submitLead } from './leadIntake'
import type { LeadIntakeResult } from './leadIntake'

export async function resend(request: { email: string }): Promise<LeadIntakeResult> {
  return submitLead(request)
}
`,
}

/**
 * The two live shapes that must stay OUT of scope with no allowlist entry:
 * a discarded `Response` (PortalForgotPasswordPage's deliberate
 * anti-enumeration discard) and an `ok: boolean` row result (EditRowResult).
 */
const HEALTHY_NOT_A_RESULT: ModuleSource = {
  file: 'fixture/NotAResult.ts',
  source: `
export interface EditRowResult {
  id: string
  ok: boolean
  error?: string
}

export function applyEdit(id: string): EditRowResult {
  return { id, ok: true }
}

export async function requestReset(email: string): Promise<void> {
  // Always show success to prevent email enumeration.
  await fetch('/api/auth/password/reset-request', { method: 'POST', body: email })
  applyEdit('row-1')
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
const REAL = analyzeModules(REAL_MODULES)

describe('result binding: the analyzer is not vacuous', () => {
  it('scans the real source tree', () => {
    expect(
      SOURCE_FILES.length,
      'no source files found; the scan would pass vacuously',
    ).toBeGreaterThan(100)
  })

  it('discovers result TYPES from source, both aliased and inline', () => {
    // Aliases are reported by name; the inline unions surface through the
    // functions that declare them, which is why both counts are asserted.
    expect(
      REAL.resultTypes,
      'no two-arm ok-union alias found under src/; the type detection is broken',
    ).toContain('LeadIntakeResult')
    expect(REAL.resultTypes.length, `discovered aliases: ${REAL.resultTypes.join(', ')}`)
      .toBeGreaterThanOrEqual(2)
  })

  it('discovers result FUNCTIONS from their declared return type', () => {
    const report = REAL.resultFunctions.map((f) => `${f.where} ${f.name}(): ${f.returnType}`)
    expect(
      REAL.resultFunctions.map((f) => f.name),
      `discovered result functions:\n${report.join('\n')}`,
    ).toContain('submitPublicLead')
    // Four aliased + the two inline tryItAdapter helpers is the tree today.
    // A collapse to one or two means the discovery stopped working, not that
    // the repo got simpler; a rename is a legitimate reason to move this
    // anchor, and nothing else is.
    expect(REAL.resultFunctions.length, `discovered result functions:\n${report.join('\n')}`)
      .toBeGreaterThanOrEqual(4)
  })

  it('finds call sites of those functions in the real tree', () => {
    expect(
      REAL.callSites.length,
      `call sites found: ${REAL.callSites.length}. Zero means the call scan silently ` +
        'matched nothing and every assertion below would pass vacuously.',
    ).toBeGreaterThan(10)
  })
})

describe('result binding: the analyzer fires on the defect shapes (L-001)', () => {
  it('flags the pre-v1.25.1 bare statement-position await', () => {
    const { offences } = analyzeModules([RESULT_MODULE, DEFECT_DISCARD])
    expect(offences).toHaveLength(1)
    expect(offences[0]).toContain('fixture/ContactCTA.tsx:6')
    expect(offences[0]).toContain('discarded-in-statement-position')
    expect(offences[0]).toContain('submitLead()')
  })

  it('flags a binding nobody reads, which "bind the result" alone would accept (L-033)', () => {
    const { offences } = analyzeModules([RESULT_MODULE, DEFECT_UNREAD_BINDING])
    expect(offences).toHaveLength(1)
    expect(offences[0]).toContain('fixture/UnreadBinding.tsx')
    expect(offences[0]).toContain('bound-but-discriminant-never-read')
  })

  it('flags a destructure that takes the message but never the discriminant', () => {
    const { offences } = analyzeModules([RESULT_MODULE, DEFECT_PARTIAL_DESTRUCTURE])
    expect(offences).toHaveLength(1)
    expect(offences[0]).toContain('fixture/PartialDestructure.tsx')
    expect(offences[0]).toContain('bound-but-discriminant-never-read')
  })

  it('flags a discard of an INLINE union with no alias to key off', () => {
    const analysis = analyzeModules([DEFECT_INLINE_UNION])
    expect(
      analysis.resultTypes,
      'an inline union has no alias name, so the alias list is expected to be empty here',
    ).toEqual([])
    expect(analysis.resultFunctions.map((f) => f.name)).toEqual(['readIntParam'])
    expect(analysis.offences).toHaveLength(1)
    expect(analysis.offences[0]).toContain('discarded-in-statement-position')
    expect(analysis.offences[0]).toContain('readIntParam()')
  })
})

describe('result binding: the analyzer stays silent on the healthy shapes', () => {
  it('accepts a bound result branched on its discriminant', () => {
    const analysis = analyzeModules([RESULT_MODULE, HEALTHY_BRANCHED])
    expect(analysis.offences).toEqual([])
    expect(analysis.callSites.map((c) => c.disposition)).toContain('bound-and-discriminant-read')
  })

  it('accepts `const { ok } = await ...`', () => {
    const analysis = analyzeModules([RESULT_MODULE, HEALTHY_DESTRUCTURED])
    expect(analysis.offences).toEqual([])
    expect(analysis.callSites.map((c) => c.disposition)).toContain('destructured-discriminant')
  })

  it('accepts a result forwarded to the caller', () => {
    const analysis = analyzeModules([RESULT_MODULE, HEALTHY_FORWARDED])
    expect(analysis.offences).toEqual([])
    expect(analysis.callSites.map((c) => c.disposition)).toContain('forwarded')
  })

  it('leaves a discarded Response and an `ok: boolean` row result out of scope entirely', () => {
    const analysis = analyzeModules([HEALTHY_NOT_A_RESULT])
    expect(
      analysis.resultFunctions,
      'ok: boolean is not a two-arm literal union; nothing here may be discovered',
    ).toEqual([])
    expect(analysis.callSites).toEqual([])
    expect(analysis.offences).toEqual([])
  })
})

describe('result binding: no production module discards a two-arm ok result', () => {
  it('finds every result call site under src/ binding and reading its discriminant', () => {
    const report = REAL.callSites.map((c) => `${c.where} ${c.callee}() -> ${c.disposition}`)
    expect(
      REAL.offences,
      'these call sites throw away a discriminated result, which is the LEAD-SILENT-DROP-1 ' +
        'shape structurally: the visitor is told what happened by code that never read the ' +
        'answer. Bind the value and branch on `.ok`, the way ContactCTA, ContactPage, ' +
        `LeadMagnetPage and ConsultationsPage do.\n\nAll call sites:\n${report.join('\n')}`,
    ).toEqual([])
  })
})

/**
 * Model audit evaluation.
 *
 * The Revit add-in only reports facts about a model — the names it holds, the
 * shared parameters bound in it, its worksets, its project information — and
 * this module judges them. Keeping the judgement here means the add-in carries
 * no second copy of the naming engine that could drift from the one the web
 * validator uses: a name is right or wrong for exactly the same reason in both.
 *
 * Pure: no database, no framework. The route stores what this returns.
 */

import { type CompiledConvention, type NamingError, validateName } from '@/server/naming'

export const AUDIT_TARGETS = [
  'FILE',
  'MODEL',
  'SHEET',
  'VIEW',
  'FAMILY',
  'TYPE',
  'PARAMETER',
  'WORKSET',
  'LEVEL',
  'GRID',
] as const
export type AuditTarget = (typeof AUDIT_TARGETS)[number]

export type Severity = 'ERROR' | 'WARNING' | 'INFO'

export type FindingCode =
  | 'NAMING'
  | 'PARAMETER_MISSING'
  | 'PARAMETER_ABSENT'
  | 'PARAMETER_GUID_MISMATCH'
  | 'PARAMETER_RENAMED'
  | 'PARAMETER_NOT_BOUND'
  | 'PARAMETER_BINDING_INCOMPLETE'
  | 'PARAMETER_BINDING_KIND'
  | 'WORKSET_MISSING'
  | 'MODEL_NOT_WORKSHARED'
  | 'PROJECT_INFO_MISMATCH'

export interface SubmittedName {
  target: AuditTarget
  name: string
  elementId?: string
  uniqueId?: string
  category?: string
}

export interface SubmittedParameter {
  name: string
  guid: string
  /** null when the add-in could not tell (parameter loaded but unbound). */
  isInstance?: boolean | null
  /** BuiltInCategory names the parameter is bound to, e.g. "OST_Walls". */
  categories: string[]
}

export interface SubmittedProjectInformation {
  name?: string | null
  number?: string | null
  clientName?: string | null
}

export interface AuditSubmission {
  model: { title: string; isWorkshared?: boolean }
  names: SubmittedName[]
  sharedParameters?: SubmittedParameter[]
  worksets?: string[]
  projectInformation?: SubmittedProjectInformation
}

export interface StandardParameter {
  guid: string
  name: string
  isInstance: boolean
  categories: string[]
  required: boolean
}

export interface AuditStandard {
  /** Active conventions only. */
  conventions: CompiledConvention[]
  sharedParameters: StandardParameter[]
  worksets: string[]
  projectInformation: { name: string; number: string; clientName: string | null }
}

export interface Finding {
  severity: Severity
  target: AuditTarget | 'PROJECT_INFO'
  code: FindingCode
  /** Stable key of the rule that produced it, for grouping across runs. */
  ruleKey: string
  elementId?: string
  elementName?: string
  category?: string
  params: Record<string, unknown>
}

export interface TargetSummary {
  checked: number
  errors: number
  warnings: number
  infos: number
  /** Submitted but no active convention covers it, so nothing was judged. */
  unchecked: number
}

export interface AuditSummary {
  checked: number
  errors: number
  warnings: number
  infos: number
  byTarget: Record<string, TargetSummary>
  /** Targets that arrived with names but have no active convention. */
  uncheckedTargets: string[]
}

export interface AuditEvaluation {
  summary: AuditSummary
  /** Ordered by severity; naming findings capped by `maxNamingFindings`. */
  findings: Finding[]
  /** Every finding, including those counted but not kept. */
  findingsTotal: number
}

function emptyTarget(): TargetSummary {
  return { checked: 0, errors: 0, warnings: 0, infos: 0, unchecked: 0 }
}

function normaliseGuid(guid: string): string {
  return guid.trim().toLowerCase().replace(/[{}]/gu, '')
}

/** Errors that mean the name does not even have the convention's shape. */
const STRUCTURAL = new Set(['SEGMENT_COUNT', 'EMPTY_VALUE'])

/**
 * How close a failed name came to a convention, as a tuple compared in order:
 * whether its structure matched at all, how many errors it has, and how many
 * segments were right. One wrong segment in the right shape is a far nearer
 * miss than a name split on a different separator, even with a single error
 * each.
 */
function distance(result: ReturnType<typeof validateName>): [number, number, number] {
  const structural = result.errors.some((error) => STRUCTURAL.has(error.code)) ? 1 : 0
  const validSegments = result.segments.filter((segment) => segment.valid).length
  return [structural, result.errors.length, -validSegments]
}

function closer(a: [number, number, number], b: [number, number, number]): boolean {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i]! !== b[i]!) return a[i]! < b[i]!
  }
  return false
}

/**
 * Judge a name against every active convention for its target.
 *
 * A project may keep several conventions for one target (a naming scheme being
 * phased out next to its replacement): matching any of them is enough. When
 * none matches, the report explains the closest one rather than listing every
 * scheme's complaints.
 */
export function judgeName(
  conventions: CompiledConvention[],
  name: string,
): { valid: true } | { valid: false; convention: CompiledConvention; errors: NamingError[] } {
  let best: {
    convention: CompiledConvention
    errors: NamingError[]
    distance: [number, number, number]
  } | null = null

  for (const convention of conventions) {
    const result = validateName(convention, name)
    if (result.valid) return { valid: true }
    const score = distance(result)
    if (!best || closer(score, best.distance)) {
      best = { convention, errors: result.errors, distance: score }
    }
  }

  // Callers only ask when at least one convention exists.
  return { valid: false, convention: best!.convention, errors: best!.errors }
}

export interface EvaluateOptions {
  /**
   * Keep at most this many naming findings; the rest are only counted. A
   * model can hold hundreds of thousands of badly named elements, and every
   * finding kept is memory held for the whole request.
   */
  maxNamingFindings?: number
}

const SEVERITY_RANK: Record<Severity, number> = { ERROR: 0, WARNING: 1, INFO: 2 }

export function evaluateAudit(
  standard: AuditStandard,
  submission: AuditSubmission,
  options: EvaluateOptions = {},
): AuditEvaluation {
  const maxNaming = options.maxNamingFindings ?? Number.POSITIVE_INFINITY
  // Parameter, workset and project-information findings are bounded by the
  // size of the standard, so they are always kept, and kept apart so a flood
  // of naming findings can never push them out.
  const naming: Finding[] = []
  const other: Finding[] = []
  let total = 0
  const byTarget: Record<string, TargetSummary> = {}
  const touch = (target: string) => (byTarget[target] ??= emptyTarget())

  const record = (finding: Finding) => {
    total += 1
    const summary = touch(finding.target)
    if (finding.severity === 'ERROR') summary.errors += 1
    else if (finding.severity === 'WARNING') summary.warnings += 1
    else summary.infos += 1

    if (finding.code !== 'NAMING') other.push(finding)
    else if (naming.length < maxNaming) naming.push(finding)
  }

  // --- names ---------------------------------------------------------------
  const conventionsByTarget = new Map<string, CompiledConvention[]>()
  for (const convention of standard.conventions) {
    const list = conventionsByTarget.get(convention.target) ?? []
    list.push(convention)
    conventionsByTarget.set(convention.target, list)
  }

  for (const item of submission.names) {
    const summary = touch(item.target)
    const conventions = conventionsByTarget.get(item.target)

    if (!conventions || conventions.length === 0) {
      summary.unchecked += 1
      continue
    }

    summary.checked += 1
    const verdict = judgeName(conventions, item.name)
    if (verdict.valid) continue

    record({
      severity: 'ERROR',
      target: item.target,
      code: 'NAMING',
      ruleKey: `naming.${verdict.convention.key}`,
      elementId: item.elementId,
      elementName: item.name,
      category: item.category,
      params: {
        conventionKey: verdict.convention.key,
        mask: verdict.convention.mask,
        errors: verdict.errors,
      },
    })
  }

  // --- shared parameters -----------------------------------------------------
  if (submission.sharedParameters) {
    const byGuid = new Map<string, SubmittedParameter>()
    const byName = new Map<string, SubmittedParameter[]>()
    for (const parameter of submission.sharedParameters) {
      byGuid.set(normaliseGuid(parameter.guid), parameter)
      const list = byName.get(parameter.name) ?? []
      list.push(parameter)
      byName.set(parameter.name, list)
    }

    for (const expected of standard.sharedParameters) {
      const summary = touch('PARAMETER')
      summary.checked += 1
      const ruleKey = `parameter.${expected.name}`
      const found = byGuid.get(normaliseGuid(expected.guid))

      if (!found) {
        const impostor = (byName.get(expected.name) ?? []).find(
          (candidate) => normaliseGuid(candidate.guid) !== normaliseGuid(expected.guid),
        )
        if (impostor) {
          // Same name, different GUID: schedules, tags and filters built on the
          // standard parameter silently see nothing. The classic failure.
          record({
            severity: 'ERROR',
            target: 'PARAMETER',
            code: 'PARAMETER_GUID_MISMATCH',
            ruleKey,
            elementName: expected.name,
            params: { name: expected.name, expectedGuid: expected.guid, actualGuid: impostor.guid },
          })
        } else {
          record({
            severity: expected.required ? 'ERROR' : 'INFO',
            target: 'PARAMETER',
            code: expected.required ? 'PARAMETER_MISSING' : 'PARAMETER_ABSENT',
            ruleKey,
            elementName: expected.name,
            params: { name: expected.name, guid: expected.guid },
          })
        }
        continue
      }

      if (found.name !== expected.name) {
        record({
          severity: 'WARNING',
          target: 'PARAMETER',
          code: 'PARAMETER_RENAMED',
          ruleKey,
          elementName: found.name,
          params: { expected: expected.name, actual: found.name },
        })
      }

      if (found.categories.length === 0) {
        record({
          severity: expected.required ? 'ERROR' : 'WARNING',
          target: 'PARAMETER',
          code: 'PARAMETER_NOT_BOUND',
          ruleKey,
          elementName: expected.name,
          params: { name: expected.name },
        })
        continue
      }

      const bound = new Set(found.categories)
      const missing = expected.categories.filter((category) => !bound.has(category))
      if (missing.length > 0) {
        record({
          severity: 'WARNING',
          target: 'PARAMETER',
          code: 'PARAMETER_BINDING_INCOMPLETE',
          ruleKey,
          elementName: expected.name,
          params: { name: expected.name, missing },
        })
      }

      if (found.isInstance != null && found.isInstance !== expected.isInstance) {
        record({
          severity: 'WARNING',
          target: 'PARAMETER',
          code: 'PARAMETER_BINDING_KIND',
          ruleKey,
          elementName: expected.name,
          params: {
            name: expected.name,
            expected: expected.isInstance ? 'INSTANCE' : 'TYPE',
            actual: found.isInstance ? 'INSTANCE' : 'TYPE',
          },
        })
      }
    }
  }

  // --- worksets --------------------------------------------------------------
  if (standard.worksets.length > 0) {
    if (submission.model.isWorkshared === false) {
      record({
        severity: 'INFO',
        target: 'WORKSET',
        code: 'MODEL_NOT_WORKSHARED',
        ruleKey: 'workset.worksharing',
        params: { expected: standard.worksets.length },
      })
    } else if (submission.worksets) {
      // Checked whenever the list is sent; only an explicit "not workshared"
      // skips it, above.
      const present = new Set(submission.worksets)
      const summary = touch('WORKSET')
      for (const name of standard.worksets) {
        summary.checked += 1
        if (present.has(name)) continue
        record({
          severity: 'WARNING',
          target: 'WORKSET',
          code: 'WORKSET_MISSING',
          ruleKey: `workset.${name}`,
          elementName: name,
          params: { name },
        })
      }
    }
  }

  // --- project information ---------------------------------------------------
  if (submission.projectInformation) {
    const actual = submission.projectInformation
    const expected = standard.projectInformation
    const checks: Array<[field: string, want: string | null, got: string | null | undefined]> = [
      ['number', expected.number, actual.number],
      ['name', expected.name, actual.name],
      ['clientName', expected.clientName, actual.clientName],
    ]
    const summary = touch('PROJECT_INFO')
    for (const [field, want, got] of checks) {
      // A field the client did not send is not checked; an explicit null or
      // empty string is, since that is an empty value in the model.
      if (!want || got === undefined) continue
      summary.checked += 1
      if ((got ?? '').trim() === want.trim()) continue
      record({
        severity: 'WARNING',
        target: 'PROJECT_INFO',
        code: 'PROJECT_INFO_MISMATCH',
        ruleKey: `projectInfo.${field}`,
        elementName: field,
        params: { field, expected: want, actual: got ?? '' },
      })
    }
  }

  // --- totals ----------------------------------------------------------------
  const totals = Object.values(byTarget).reduce(
    (sum, entry) => ({
      checked: sum.checked + entry.checked,
      errors: sum.errors + entry.errors,
      warnings: sum.warnings + entry.warnings,
      infos: sum.infos + entry.infos,
    }),
    { checked: 0, errors: 0, warnings: 0, infos: 0 },
  )

  return {
    summary: {
      ...totals,
      byTarget,
      uncheckedTargets: Object.entries(byTarget)
        .filter(([, entry]) => entry.unchecked > 0)
        .map(([target]) => target)
        .sort(),
    },
    // Errors first, and within a severity the model-wide findings before the
    // per-element ones, so whatever is cut further down is the least useful.
    findings: [...other, ...naming].sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]),
    findingsTotal: total,
  }
}

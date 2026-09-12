/**
 * Naming engine — shared types.
 *
 * These types are deliberately independent from Prisma models so the very same
 * compiler runs in three places: the browser validator, the `/api/v1` surface
 * consumed by the Revit add-in, and the server-side IFC auditor.
 */

export type LocaleCode = 'es' | 'en' | 'pt'

export type LocalizedText = Partial<Record<LocaleCode, string>>

export type FieldSource = 'CODE_TABLE' | 'FREE_TEXT' | 'NUMERIC' | 'DATE' | 'REGEX'

export type CaseRule = 'ANY' | 'UPPER' | 'LOWER'

export type NamingTarget =
  | 'FILE'
  | 'MODEL'
  | 'SHEET'
  | 'VIEW'
  | 'FOLDER'
  | 'FAMILY'
  | 'TYPE'
  | 'PARAMETER'
  | 'WORKSET'
  | 'LEVEL'
  | 'GRID'

export interface CodeValueSpec {
  code: string
  labels?: LocalizedText
}

export interface CodeTableSpec {
  key: string
  labels?: LocalizedText
  values: CodeValueSpec[]
}

export interface NamingFieldSpec {
  key: string
  order: number
  labels?: LocalizedText
  source: FieldSource
  codeTable?: CodeTableSpec | null
  minLength?: number | null
  maxLength?: number | null
  /** Raw regular expression body, used when `source === 'REGEX'`. */
  pattern?: string | null
  /** Date mask such as `YYYYMMDD` or `YYYY.MM.DD`, used when `source === 'DATE'`. */
  dateFormat?: string | null
  required?: boolean
  example?: string | null
}

export interface NamingConventionSpec {
  key: string
  target: NamingTarget
  separator: string
  caseRule?: CaseRule
  maxLength?: number | null
  labels?: LocalizedText
  fields: NamingFieldSpec[]
}

export interface CompiledField {
  key: string
  order: number
  labels: LocalizedText
  source: FieldSource
  required: boolean
  minLength: number | null
  maxLength: number | null
  dateFormat: string | null
  /** Allowed values when the field is backed by a code table. */
  allowedCodes: string[] | null
  codeLabels: Record<string, LocalizedText> | null
  /** Regex body for this segment, without anchors. */
  regexSource: string
  example: string | null
}

export interface CompiledConvention {
  key: string
  target: NamingTarget
  separator: string
  caseRule: CaseRule
  maxLength: number | null
  labels: LocalizedText
  fields: CompiledField[]
  /** Full anchored pattern, e.g. `^(?:EDI|INF)-[^-]{2,6}-\d{2}$`. */
  regexSource: string
  /** Human readable mask, e.g. `PRJ-ORG-VOL-LVL-TYP-ROL-NUM`. */
  mask: string
}

/**
 * Machine readable validation error. The UI and the add-in translate `code`
 * with `params`, so the same finding reads correctly in ES, EN and PT.
 */
export interface NamingError {
  code: NamingErrorCode
  fieldKey?: string
  fieldIndex?: number
  params?: Record<string, string | number>
}

export type NamingErrorCode =
  | 'EMPTY_VALUE'
  | 'TOO_LONG'
  | 'SEGMENT_COUNT'
  | 'EMPTY_REQUIRED'
  | 'NOT_IN_CODE_TABLE'
  | 'FIELD_TOO_SHORT'
  | 'FIELD_TOO_LONG'
  | 'NOT_NUMERIC'
  | 'BAD_DATE'
  | 'PATTERN_MISMATCH'
  | 'WRONG_CASE'
  | 'ILLEGAL_CHARACTER'

export interface SegmentResult {
  fieldKey: string
  fieldIndex: number
  value: string
  valid: boolean
  errors: NamingError[]
}

export interface ValidationResult {
  valid: boolean
  value: string
  segments: SegmentResult[]
  errors: NamingError[]
}

export class NamingCompileError extends Error {
  constructor(
    message: string,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message)
    this.name = 'NamingCompileError'
  }
}

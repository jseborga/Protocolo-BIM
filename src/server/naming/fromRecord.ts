import type {
  CaseRule,
  FieldSource,
  LocalizedText,
  NamingConventionSpec,
  NamingTarget,
} from './types'

/**
 * Structural shape of a stored convention. Declared here rather than imported
 * from Prisma so this mapping stays a pure function usable from scripts, tests
 * and the IFC auditor, not only from server components.
 */
export interface ConventionRecordLike {
  key: string
  target: NamingTarget
  separator: string
  caseRule: CaseRule
  maxLength: number | null
  labels: unknown
  fields: Array<{
    key: string
    order: number
    labels: unknown
    source: FieldSource
    minLength: number | null
    maxLength: number | null
    pattern: string | null
    dateFormat: string | null
    required: boolean
    example: string | null
    codeTable?: {
      key: string
      labels: unknown
      values: Array<{ code: string; labels: unknown; order: number }>
    } | null
  }>
}

const asText = (value: unknown): LocalizedText => (value ?? {}) as LocalizedText

/** Turn a stored convention into the spec the compiler understands. */
export function toSpec(record: ConventionRecordLike): NamingConventionSpec {
  return {
    key: record.key,
    target: record.target,
    separator: record.separator,
    caseRule: record.caseRule,
    maxLength: record.maxLength,
    labels: asText(record.labels),
    fields: [...record.fields]
      .sort((a, b) => a.order - b.order)
      .map((field) => ({
        key: field.key,
        order: field.order,
        labels: asText(field.labels),
        source: field.source,
        codeTable: field.codeTable
          ? {
              key: field.codeTable.key,
              labels: asText(field.codeTable.labels),
              values: [...field.codeTable.values]
                .sort((a, b) => a.order - b.order)
                .map((value) => ({ code: value.code, labels: asText(value.labels) })),
            }
          : null,
        minLength: field.minLength,
        maxLength: field.maxLength,
        pattern: field.pattern,
        dateFormat: field.dateFormat,
        required: field.required,
        example: field.example,
      })),
  }
}

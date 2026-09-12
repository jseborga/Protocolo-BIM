import { ILLEGAL_NAME_CHARS } from './compile'
import type {
  CompiledConvention,
  CompiledField,
  NamingError,
  SegmentResult,
  ValidationResult,
} from './types'

/**
 * Split a candidate name into segments.
 *
 * Free-text fields exclude the separator by construction, so splitting is
 * unambiguous. Trailing optional fields may be omitted entirely.
 */
function splitSegments(value: string, convention: CompiledConvention): string[] | null {
  if (convention.separator === '') {
    // Fixed-width fields only (guaranteed at compile time): slice by width.
    const segments: string[] = []
    let cursor = 0
    for (const field of convention.fields) {
      const width = expectedWidth(field)
      if (width == null) return null
      segments.push(value.slice(cursor, cursor + width))
      cursor += width
    }
    if (cursor !== value.length) return null
    return segments
  }
  return value.split(convention.separator)
}

function expectedWidth(field: CompiledField): number | null {
  if (field.allowedCodes && field.allowedCodes.length > 0) {
    const width = field.allowedCodes[0]!.length
    return field.allowedCodes.every((code) => code.length === width) ? width : null
  }
  if (field.source === 'DATE') return (field.dateFormat || 'YYYYMMDD').length
  if (field.minLength != null && field.minLength === field.maxLength) return field.minLength
  return null
}

function checkCase(value: string, convention: CompiledConvention): NamingError | null {
  if (convention.caseRule === 'UPPER' && value !== value.toUpperCase()) {
    return { code: 'WRONG_CASE', params: { expected: 'UPPER', suggestion: value.toUpperCase() } }
  }
  if (convention.caseRule === 'LOWER' && value !== value.toLowerCase()) {
    return { code: 'WRONG_CASE', params: { expected: 'LOWER', suggestion: value.toLowerCase() } }
  }
  return null
}

function validateSegment(
  field: CompiledField,
  raw: string,
  index: number,
  convention: CompiledConvention,
): SegmentResult {
  const errors: NamingError[] = []
  const value = raw ?? ''
  const label = { fieldKey: field.key, fieldIndex: index }

  if (value === '') {
    if (field.required) {
      errors.push({ ...label, code: 'EMPTY_REQUIRED' })
    }
    return { fieldKey: field.key, fieldIndex: index, value, valid: errors.length === 0, errors }
  }

  if (ILLEGAL_NAME_CHARS.test(value)) {
    errors.push({
      ...label,
      code: 'ILLEGAL_CHARACTER',
      params: { chars: value.match(ILLEGAL_NAME_CHARS)!.join('') },
    })
  }

  switch (field.source) {
    case 'CODE_TABLE': {
      if (field.allowedCodes && !field.allowedCodes.includes(value)) {
        const allowed = [...field.allowedCodes].sort((a, b) => a.localeCompare(b))
        errors.push({
          ...label,
          code: 'NOT_IN_CODE_TABLE',
          params: {
            value,
            // Keep the hint short; the UI links to the full table.
            allowed: allowed.slice(0, 12).join(', ') + (allowed.length > 12 ? ', …' : ''),
            count: allowed.length,
          },
        })
      }
      break
    }
    case 'NUMERIC': {
      if (!/^\d+$/u.test(value)) {
        errors.push({ ...label, code: 'NOT_NUMERIC', params: { value } })
      }
      break
    }
    case 'DATE': {
      const format = field.dateFormat || 'YYYYMMDD'
      if (!matchesDate(value, format)) {
        errors.push({ ...label, code: 'BAD_DATE', params: { value, format } })
      }
      break
    }
    case 'REGEX': {
      const pattern = new RegExp(`^(?:${field.regexSource.replace(/^\(\?:|\)$/g, '')})$`, 'u')
      if (!pattern.test(value)) {
        errors.push({ ...label, code: 'PATTERN_MISMATCH', params: { value } })
      }
      break
    }
    default:
      break
  }

  if (field.minLength != null && value.length < field.minLength) {
    errors.push({
      ...label,
      code: 'FIELD_TOO_SHORT',
      params: { value, min: field.minLength, actual: value.length },
    })
  }
  if (field.maxLength != null && value.length > field.maxLength) {
    errors.push({
      ...label,
      code: 'FIELD_TOO_LONG',
      params: { value, max: field.maxLength, actual: value.length },
    })
  }

  const caseError = checkCase(value, convention)
  if (caseError) errors.push({ ...label, ...caseError })

  return { fieldKey: field.key, fieldIndex: index, value, valid: errors.length === 0, errors }
}

function matchesDate(value: string, format: string): boolean {
  const positions: Record<string, [number, number]> = {}
  for (const token of ['YYYY', 'YY', 'MM', 'DD']) {
    const at = format.indexOf(token)
    if (at >= 0) positions[token] = [at, token.length]
  }
  if (value.length !== format.length) return false

  // Literal characters of the mask must appear verbatim.
  for (let i = 0; i < format.length; i += 1) {
    const inToken = Object.values(positions).some(([start, len]) => i >= start && i < start + len)
    if (!inToken && value[i] !== format[i]) return false
  }

  const read = (token: string): number | null => {
    const found = positions[token]
    if (!found) return null
    const chunk = value.slice(found[0], found[0] + found[1])
    return /^\d+$/u.test(chunk) ? Number(chunk) : null
  }

  const month = read('MM')
  const day = read('DD')
  const year = read('YYYY') ?? (read('YY') != null ? 2000 + read('YY')! : null)

  if (positions.MM && (month == null || month < 1 || month > 12)) return false
  if (positions.DD && (day == null || day < 1 || day > 31)) return false
  if (positions.YYYY && year == null) return false
  if (month != null && day != null && year != null) {
    const date = new Date(Date.UTC(year, month - 1, day))
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return false
  }
  return true
}

/**
 * Validate a candidate name against a compiled convention.
 *
 * Returns a per-segment breakdown so the UI can point at the offending field
 * instead of rejecting the whole string.
 */
export function validateName(convention: CompiledConvention, value: string): ValidationResult {
  const errors: NamingError[] = []
  const trimmed = value ?? ''

  if (trimmed.trim() === '') {
    return {
      valid: false,
      value: trimmed,
      segments: [],
      errors: [{ code: 'EMPTY_VALUE' }],
    }
  }

  if (convention.maxLength != null && trimmed.length > convention.maxLength) {
    errors.push({
      code: 'TOO_LONG',
      params: { max: convention.maxLength, actual: trimmed.length },
    })
  }

  const rawSegments = splitSegments(trimmed, convention)
  if (rawSegments == null) {
    return {
      valid: false,
      value: trimmed,
      segments: [],
      errors: [
        ...errors,
        {
          code: 'SEGMENT_COUNT',
          params: { expected: convention.fields.length, actual: 0 },
        },
      ],
    }
  }

  const fields = convention.fields
  const optionalTail = countOptionalTail(fields)
  const minSegments = fields.length - optionalTail

  if (rawSegments.length > fields.length || rawSegments.length < minSegments) {
    errors.push({
      code: 'SEGMENT_COUNT',
      params: { expected: fields.length, actual: rawSegments.length, min: minSegments },
    })
    return { valid: false, value: trimmed, segments: [], errors }
  }

  const segments = fields.map((field, index) =>
    validateSegment(field, rawSegments[index] ?? '', index, convention),
  )

  const all = [...errors, ...segments.flatMap((segment) => segment.errors)]
  return { valid: all.length === 0, value: trimmed, segments, errors: all }
}

function countOptionalTail(fields: CompiledField[]): number {
  let count = 0
  for (let i = fields.length - 1; i >= 0; i -= 1) {
    if (fields[i]!.required) break
    count += 1
  }
  return count
}

/** Compose a name from per-field values, applying the convention's case rule. */
export function buildName(
  convention: CompiledConvention,
  values: Record<string, string>,
): { name: string; result: ValidationResult } {
  const parts = convention.fields.map((field) => {
    const raw = (values[field.key] ?? '').trim()
    if (convention.caseRule === 'UPPER') return raw.toUpperCase()
    if (convention.caseRule === 'LOWER') return raw.toLowerCase()
    return raw
  })

  // Drop trailing empty optional fields so the name has no dangling separators.
  while (parts.length > 0 && parts[parts.length - 1] === '') {
    const field = convention.fields[parts.length - 1]!
    if (field.required) break
    parts.pop()
  }

  const name = parts.join(convention.separator)
  return { name, result: validateName(convention, name) }
}

export interface ExampleCheck {
  sample: string
  shouldBeValid: boolean
  actuallyValid: boolean
  passed: boolean
  errors: NamingError[]
}

/**
 * Run the convention's own test cases. Publishing is blocked when any of them
 * disagrees with the compiled rule, so a convention can never silently drift
 * away from the examples the team agreed on.
 */
export function checkExamples(
  convention: CompiledConvention,
  examples: Array<{ sample: string; shouldBeValid: boolean }>,
): { passed: boolean; checks: ExampleCheck[] } {
  const checks = examples.map((example) => {
    const result = validateName(convention, example.sample)
    return {
      sample: example.sample,
      shouldBeValid: example.shouldBeValid,
      actuallyValid: result.valid,
      passed: result.valid === example.shouldBeValid,
      errors: result.errors,
    }
  })
  return { passed: checks.every((check) => check.passed), checks }
}

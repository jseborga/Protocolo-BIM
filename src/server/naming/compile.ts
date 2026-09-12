import {
  type CodeTableSpec,
  type CompiledConvention,
  type CompiledField,
  type LocalizedText,
  NamingCompileError,
  type NamingConventionSpec,
  type NamingFieldSpec,
} from './types'

/** Characters that are never acceptable inside a file or folder name. */
export const ILLEGAL_NAME_CHARS = /[\\/:*?"<>|]/

/** Order matters: `YYYY` must be matched before `YY`. */
const DATE_TOKENS: Array<[string, string]> = [
  ['YYYY', '\\d{4}'],
  ['YY', '\\d{2}'],
  ['MM', '\\d{2}'],
  ['DD', '\\d{2}'],
]

export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function quantifier(min: number | null | undefined, max: number | null | undefined): string {
  const lo = min ?? 1
  if (max == null) return lo === 1 ? '+' : `{${lo},}`
  if (max === lo) return `{${lo}}`
  return `{${lo},${max}}`
}

function compileDateFormat(format: string): string {
  // Walk the mask token by token so literals inside it (e.g. the dots in
  // `YYYY.MM.DD`) get escaped instead of being read as regex syntax.
  let out = ''
  let rest = format
  outer: while (rest.length > 0) {
    for (const [token, replacement] of DATE_TOKENS) {
      if (rest.startsWith(token)) {
        out += replacement
        rest = rest.slice(token.length)
        continue outer
      }
    }
    out += escapeRegex(rest[0]!)
    rest = rest.slice(1)
  }
  return out
}

function assertSafePattern(pattern: string, fieldKey: string): void {
  if (pattern.length > 500) {
    throw new NamingCompileError(`Pattern for field "${fieldKey}" is too long`, { fieldKey })
  }
  try {
    new RegExp(`^(?:${pattern})$`, 'u')
  } catch (error) {
    throw new NamingCompileError(`Invalid regular expression for field "${fieldKey}"`, {
      fieldKey,
      cause: (error as Error).message,
    })
  }
}

function codesFrom(table: CodeTableSpec | null | undefined): string[] {
  if (!table) return []
  // Longest first so that `ZZ` never shadows `ZZZ` in the alternation.
  return [...new Set(table.values.map((value) => value.code.trim()).filter(Boolean))].sort(
    (a, b) => b.length - a.length || a.localeCompare(b),
  )
}

function fieldRegex(field: NamingFieldSpec, separator: string): string {
  switch (field.source) {
    case 'CODE_TABLE': {
      const codes = codesFrom(field.codeTable)
      if (codes.length === 0) {
        // An empty table must not silently accept anything: keep it permissive
        // for drafting but bounded by the separator.
        return separator ? `[^${escapeRegex(separator)}]+` : '.+'
      }
      return `(?:${codes.map(escapeRegex).join('|')})`
    }
    case 'NUMERIC':
      return `\\d${quantifier(field.minLength, field.maxLength)}`
    case 'DATE':
      return compileDateFormat(field.dateFormat || 'YYYYMMDD')
    case 'REGEX': {
      const pattern = field.pattern?.trim()
      if (!pattern) {
        throw new NamingCompileError(`Field "${field.key}" is REGEX but has no pattern`, {
          fieldKey: field.key,
        })
      }
      assertSafePattern(pattern, field.key)
      return `(?:${pattern})`
    }
    case 'FREE_TEXT':
    default: {
      const charClass = separator ? `[^${escapeRegex(separator)}]` : '.'
      return `${charClass}${quantifier(field.minLength, field.maxLength)}`
    }
  }
}

/** Fixed width of a field, or null when it can vary. Used to allow an empty separator. */
function fixedWidth(field: NamingFieldSpec): number | null {
  if (field.source === 'CODE_TABLE') {
    const codes = codesFrom(field.codeTable)
    if (codes.length === 0) return null
    const width = codes[0]!.length
    return codes.every((code) => code.length === width) ? width : null
  }
  if (field.source === 'DATE') {
    return (field.dateFormat || 'YYYYMMDD').length
  }
  if (field.minLength != null && field.minLength === field.maxLength) {
    return field.minLength
  }
  return null
}

function labelsOf(value: LocalizedText | undefined, fallback: string): LocalizedText {
  if (value && Object.keys(value).length > 0) return value
  return { es: fallback, en: fallback, pt: fallback }
}

/**
 * Turn a convention definition into a compiled rule: one anchored regex, one
 * readable mask and per-field metadata rich enough to explain any failure.
 */
export function compileConvention(spec: NamingConventionSpec): CompiledConvention {
  const fields = [...spec.fields].sort((a, b) => a.order - b.order)

  if (fields.length === 0) {
    throw new NamingCompileError('A naming convention needs at least one field', {
      convention: spec.key,
    })
  }

  const separator = spec.separator ?? '-'

  if (separator === '') {
    const variable = fields.filter((field) => fixedWidth(field) == null)
    if (variable.length > 0) {
      throw new NamingCompileError(
        'Without a separator every field must have a fixed length',
        { convention: spec.key, fields: variable.map((field) => field.key) },
      )
    }
  }

  const seen = new Set<string>()
  const compiledFields: CompiledField[] = fields.map((field, index) => {
    if (seen.has(field.key)) {
      throw new NamingCompileError(`Duplicated field key "${field.key}"`, { convention: spec.key })
    }
    seen.add(field.key)

    const codes = field.source === 'CODE_TABLE' ? codesFrom(field.codeTable) : []
    const codeLabels =
      field.source === 'CODE_TABLE' && field.codeTable
        ? Object.fromEntries(
            field.codeTable.values.map((value) => [value.code, value.labels ?? {}]),
          )
        : null

    return {
      key: field.key,
      order: index,
      labels: labelsOf(field.labels, field.key),
      source: field.source,
      required: field.required ?? true,
      minLength: field.minLength ?? null,
      maxLength: field.maxLength ?? null,
      dateFormat: field.dateFormat ?? null,
      allowedCodes: codes.length > 0 ? codes : null,
      codeLabels,
      regexSource: fieldRegex(field, separator),
      example: field.example ?? null,
    }
  })

  const escapedSeparator = escapeRegex(separator)
  const body = compiledFields
    .map((field) => (field.required ? field.regexSource : `(?:${field.regexSource})?`))
    .join(escapedSeparator)

  const regexSource = `^${body}$`
  // Fail fast at compile time rather than at every validation call.
  new RegExp(regexSource, 'u')

  return {
    key: spec.key,
    target: spec.target,
    separator,
    caseRule: spec.caseRule ?? 'UPPER',
    maxLength: spec.maxLength ?? null,
    labels: labelsOf(spec.labels, spec.key),
    fields: compiledFields,
    regexSource,
    mask: compiledFields.map((field) => field.key).join(separator),
  }
}

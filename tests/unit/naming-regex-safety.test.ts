import { describe, expect, it } from 'vitest'
import { compileConvention, validateName, type NamingConventionSpec } from '@/server/naming'
import { regexSafetyProblem } from '@/server/naming/regexSafety'
import { REGEX_MAX_TESTED } from '@/server/naming/validate'
import { NAMING_CONVENTION_SEEDS } from '@/server/protocol/baseline'

function sheetWithTitle(pattern: string, maxLength: number | null = null): NamingConventionSpec {
  return {
    key: 'SHEET',
    target: 'SHEET',
    separator: '_',
    caseRule: 'ANY',
    maxLength: null,
    fields: [
      { key: 'DIS', order: 0, source: 'CODE_TABLE', required: true, codeTable: { key: 'D', values: [{ code: 'ARC' }, { code: 'STR' }] } },
      { key: 'TITLE', order: 1, source: 'REGEX', required: true, pattern, maxLength },
    ],
  }
}

describe('regular expressions in naming fields', () => {
  it('accepts the patterns naming fields actually use', () => {
    for (const pattern of [
      '[A-Z0-9]{2,10}',
      '\\d{3}(-[A-Z])?',
      'P\\d{2}',
      '[A-Z]+\\d+',
      '(ARC|STR|MEP)',
      '[A-Za-zÀ-ÿ ]{3,40}',
      '\\p{Lu}{2,4}',
      '(?:[A-Z]{2})?\\d{4}',
      '(\\d{2}){2}',
    ]) {
      expect({ pattern, problem: regexSafetyProblem(pattern) }).toEqual({ pattern, problem: null })
    }
  })

  it('refuses a repeated group that already repeats or has alternatives', () => {
    for (const pattern of ['([A-Z]+ ?)+', '(a+)+', '(a*)*', '(\\d{1,3})+', '(a|a)+', '((a|b)c)*', '(?:x+y?){2,}', '([A-Z]+)*']) {
      expect({ pattern, problem: regexSafetyProblem(pattern) }).toEqual({ pattern, problem: 'NESTED_REPETITION' })
    }
  })

  it('refuses long chains of open-ended repetitions and backreferences', () => {
    expect(regexSafetyProblem('[A-Z]*[A-Z]*[A-Z]*[A-Z]*')).toBe('TOO_MANY_REPETITIONS')
    expect(regexSafetyProblem('(a)\\1')).toBe('BACKREFERENCE')
    expect(regexSafetyProblem('(?<x>a)\\k<x>')).toBe('BACKREFERENCE')
  })

  it('reads escapes and classes as single atoms', () => {
    // `+` inside a class or escaped is a literal, not a nested quantifier.
    expect(regexSafetyProblem('([+*]\\+)+')).toBeNull()
    expect(regexSafetyProblem('(\\(a\\))+')).toBeNull()
  })

  it('does not compile a convention whose pattern could hang the server', () => {
    expect(() => compileConvention(sheetWithTitle('([A-Z]+ ?)+'))).toThrow(/nested repetition/)
  })

  it('never runs a field pattern on an oversized segment', () => {
    const compiled = compileConvention(sheetWithTitle('[A-Z ]+'))
    const long = validateName(compiled, `ARC_${'A'.repeat(REGEX_MAX_TESTED + 1)}`)
    expect(long.errors.map((error) => error.code)).toEqual(['FIELD_TOO_LONG'])
    expect(validateName(compiled, 'ARC_PLANTA GENERAL').valid).toBe(true)

    const bounded = compileConvention(sheetWithTitle('[A-Z]+', 10))
    expect(validateName(bounded, 'ARC_ABCDEFGHIJK').errors.map((error) => error.code)).toEqual(['FIELD_TOO_LONG'])
  })

  it('answers a near-miss at once with the safe rewrite of the pattern', () => {
    const compiled = compileConvention(sheetWithTitle('[A-Z ]+'))
    const started = performance.now()
    expect(validateName(compiled, `ARC_${'A'.repeat(120)}!`).valid).toBe(false)
    expect(performance.now() - started).toBeLessThan(50)
  })

  it('keeps every seeded REGEX field valid', () => {
    for (const seed of NAMING_CONVENTION_SEEDS) {
      for (const field of seed.fields) {
        if (field.source === 'REGEX') expect(regexSafetyProblem(field.pattern!)).toBeNull()
      }
    }
  })
})

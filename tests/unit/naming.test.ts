import { describe, expect, it } from 'vitest'
import {
  buildName,
  checkExamples,
  compileConvention,
  NamingCompileError,
  validateName,
  type NamingConventionSpec,
} from '@/server/naming'

/** ISO 19650-2 style file name: Project-Originator-Volume-Level-Type-Role-Number */
const isoFileConvention: NamingConventionSpec = {
  key: 'FILE_ISO19650',
  target: 'FILE',
  separator: '-',
  caseRule: 'UPPER',
  maxLength: 80,
  fields: [
    {
      key: 'PRJ',
      order: 0,
      source: 'CODE_TABLE',
      codeTable: { key: 'PROJECT', values: [{ code: 'EDI' }, { code: 'INF' }] },
    },
    { key: 'ORG', order: 1, source: 'FREE_TEXT', minLength: 2, maxLength: 6 },
    {
      key: 'VOL',
      order: 2,
      source: 'CODE_TABLE',
      codeTable: { key: 'VOLUME', values: [{ code: '01' }, { code: '02' }, { code: 'ZZ' }] },
    },
    {
      key: 'LVL',
      order: 3,
      source: 'CODE_TABLE',
      codeTable: {
        key: 'LEVEL',
        values: [{ code: '00' }, { code: '01' }, { code: '02' }, { code: 'ZZ' }],
      },
    },
    {
      key: 'TYP',
      order: 4,
      source: 'CODE_TABLE',
      codeTable: { key: 'TYPE', values: [{ code: 'M3' }, { code: 'M2' }, { code: 'DR' }] },
    },
    {
      key: 'ROL',
      order: 5,
      source: 'CODE_TABLE',
      codeTable: { key: 'ROLE', values: [{ code: 'A' }, { code: 'S' }, { code: 'M' }] },
    },
    { key: 'NUM', order: 6, source: 'NUMERIC', minLength: 4, maxLength: 4 },
  ],
}

describe('compileConvention', () => {
  it('derives an anchored regex and a readable mask from the fields', () => {
    const compiled = compileConvention(isoFileConvention)

    expect(compiled.mask).toBe('PRJ-ORG-VOL-LVL-TYP-ROL-NUM')
    expect(compiled.regexSource.startsWith('^')).toBe(true)
    expect(compiled.regexSource.endsWith('$')).toBe(true)
    expect(new RegExp(compiled.regexSource, 'u').test('EDI-JSE-01-02-M3-S-0001')).toBe(true)
  })

  it('sorts code alternatives longest first so short codes cannot shadow long ones', () => {
    const compiled = compileConvention({
      key: 'T',
      target: 'FILE',
      separator: '-',
      fields: [
        {
          key: 'A',
          order: 0,
          source: 'CODE_TABLE',
          codeTable: { key: 'X', values: [{ code: 'ZZ' }, { code: 'ZZZ' }] },
        },
      ],
    })
    expect(compiled.fields[0]!.regexSource).toBe('(?:ZZZ|ZZ)')
    expect(validateName(compiled, 'ZZZ').valid).toBe(true)
  })

  it('escapes regex metacharacters in separators and code values', () => {
    const compiled = compileConvention({
      key: 'T',
      target: 'FILE',
      separator: '.',
      fields: [
        {
          key: 'A',
          order: 0,
          source: 'CODE_TABLE',
          codeTable: { key: 'X', values: [{ code: 'A+B' }] },
        },
        { key: 'B', order: 1, source: 'NUMERIC', minLength: 2, maxLength: 2 },
      ],
    })
    expect(validateName(compiled, 'A+B.01').valid).toBe(true)
    expect(validateName(compiled, 'AxB.01').valid).toBe(false)
  })

  it('rejects a convention with no fields', () => {
    expect(() => compileConvention({ key: 'T', target: 'FILE', separator: '-', fields: [] })).toThrow(
      NamingCompileError,
    )
  })

  it('rejects an empty separator when a field has a variable length', () => {
    expect(() =>
      compileConvention({
        key: 'T',
        target: 'FILE',
        separator: '',
        fields: [{ key: 'A', order: 0, source: 'FREE_TEXT' }],
      }),
    ).toThrow(/fixed length/i)
  })

  it('rejects an invalid regular expression instead of failing at validation time', () => {
    expect(() =>
      compileConvention({
        key: 'T',
        target: 'FILE',
        separator: '-',
        fields: [{ key: 'A', order: 0, source: 'REGEX', pattern: '([a-z' }],
      }),
    ).toThrow(NamingCompileError)
  })
})

describe('validateName', () => {
  const compiled = compileConvention(isoFileConvention)

  it('accepts a conforming name', () => {
    const result = validateName(compiled, 'EDI-JSE-01-02-M3-S-0001')
    expect(result.valid).toBe(true)
    expect(result.segments).toHaveLength(7)
    expect(result.segments.every((segment) => segment.valid)).toBe(true)
  })

  it('reports the wrong number of segments rather than a generic failure', () => {
    const result = validateName(compiled, 'EDI-JSE-ZZ')
    expect(result.valid).toBe(false)
    expect(result.errors[0]!.code).toBe('SEGMENT_COUNT')
    expect(result.errors[0]!.params).toMatchObject({ expected: 7, actual: 3 })
  })

  it('points at the offending field and lists the allowed codes', () => {
    const result = validateName(compiled, 'EDI-JSE-99-02-M3-S-0001')
    expect(result.valid).toBe(false)

    const failing = result.segments.find((segment) => !segment.valid)
    expect(failing?.fieldKey).toBe('VOL')
    expect(failing?.fieldIndex).toBe(2)

    const error = failing!.errors[0]!
    expect(error.code).toBe('NOT_IN_CODE_TABLE')
    expect(error.params?.allowed).toBe('01, 02, ZZ')
    expect(error.params?.value).toBe('99')
  })

  it('flags the case rule with a ready-to-use suggestion', () => {
    const result = validateName(compiled, 'edi-jse-01-02-m3-s-0001')
    expect(result.valid).toBe(false)

    const caseErrors = result.errors.filter((error) => error.code === 'WRONG_CASE')
    expect(caseErrors.length).toBeGreaterThan(0)
    expect(caseErrors[0]!.params?.suggestion).toBe('EDI')
  })

  it('enforces numeric width', () => {
    const short = validateName(compiled, 'EDI-JSE-01-02-M3-S-001')
    expect(short.valid).toBe(false)
    expect(short.segments[6]!.errors[0]!.code).toBe('FIELD_TOO_SHORT')

    const notANumber = validateName(compiled, 'EDI-JSE-01-02-M3-S-00A1')
    expect(notANumber.segments[6]!.errors[0]!.code).toBe('NOT_NUMERIC')
  })

  it('enforces free-text bounds', () => {
    expect(validateName(compiled, 'EDI-J-01-02-M3-S-0001').segments[1]!.errors[0]!.code).toBe(
      'FIELD_TOO_SHORT',
    )
    expect(
      validateName(compiled, 'EDI-JSEBORGA-01-02-M3-S-0001').segments[1]!.errors[0]!.code,
    ).toBe('FIELD_TOO_LONG')
  })

  it('rejects characters that are illegal in file names', () => {
    const result = validateName(compiled, 'EDI-J/E-01-02-M3-S-0001')
    expect(result.valid).toBe(false)
    expect(result.segments[1]!.errors.some((error) => error.code === 'ILLEGAL_CHARACTER')).toBe(
      true,
    )
  })

  it('enforces the overall maximum length', () => {
    const long = compileConvention({ ...isoFileConvention, maxLength: 10 })
    const result = validateName(long, 'EDI-JSE-01-02-M3-S-0001')
    expect(result.errors.some((error) => error.code === 'TOO_LONG')).toBe(true)
  })

  it('rejects an empty value', () => {
    expect(validateName(compiled, '   ').errors[0]!.code).toBe('EMPTY_VALUE')
  })
})

describe('date fields', () => {
  const compiled = compileConvention({
    key: 'DATED',
    target: 'FILE',
    separator: '_',
    caseRule: 'ANY',
    fields: [
      { key: 'NAME', order: 0, source: 'FREE_TEXT', minLength: 1 },
      { key: 'DATE', order: 1, source: 'DATE', dateFormat: 'YYYYMMDD' },
    ],
  })

  it('accepts a real date', () => {
    expect(validateName(compiled, 'Modelo_20260912').valid).toBe(true)
  })

  it('rejects a calendar-impossible date', () => {
    const result = validateName(compiled, 'Modelo_20260230')
    expect(result.valid).toBe(false)
    expect(result.segments[1]!.errors[0]!.code).toBe('BAD_DATE')
  })

  it('honours literal characters inside the mask', () => {
    const dotted = compileConvention({
      key: 'D2',
      target: 'FILE',
      separator: '_',
      caseRule: 'ANY',
      fields: [{ key: 'DATE', order: 0, source: 'DATE', dateFormat: 'YYYY.MM.DD' }],
    })
    expect(validateName(dotted, '2026.09.12').valid).toBe(true)
    expect(validateName(dotted, '20260912').valid).toBe(false)
  })
})

describe('optional fields', () => {
  const compiled = compileConvention({
    key: 'OPT',
    target: 'SHEET',
    separator: '-',
    caseRule: 'UPPER',
    fields: [
      { key: 'A', order: 0, source: 'FREE_TEXT', minLength: 1, required: true },
      { key: 'B', order: 1, source: 'NUMERIC', minLength: 2, maxLength: 2, required: false },
    ],
  })

  it('allows a trailing optional field to be omitted', () => {
    expect(validateName(compiled, 'PLANO').valid).toBe(true)
    expect(validateName(compiled, 'PLANO-01').valid).toBe(true)
  })

  it('still rejects more segments than fields', () => {
    expect(validateName(compiled, 'PLANO-01-02').errors[0]!.code).toBe('SEGMENT_COUNT')
  })
})

describe('fixed-width names without a separator', () => {
  const compiled = compileConvention({
    key: 'PARAM',
    target: 'PARAMETER',
    separator: '',
    caseRule: 'UPPER',
    fields: [
      {
        key: 'DIS',
        order: 0,
        source: 'CODE_TABLE',
        codeTable: { key: 'DIS', values: [{ code: 'ARC' }, { code: 'STR' }] },
      },
      { key: 'NUM', order: 1, source: 'NUMERIC', minLength: 3, maxLength: 3 },
    ],
  })

  it('slices by field width', () => {
    expect(validateName(compiled, 'ARC001').valid).toBe(true)
    expect(validateName(compiled, 'XXX001').valid).toBe(false)
    expect(validateName(compiled, 'ARC01').valid).toBe(false)
  })
})

describe('buildName', () => {
  const compiled = compileConvention(isoFileConvention)

  it('composes and up-cases a valid name from field values', () => {
    const { name, result } = buildName(compiled, {
      PRJ: 'edi',
      ORG: 'jse',
      VOL: '01',
      LVL: '02',
      TYP: 'm3',
      ROL: 's',
      NUM: '0001',
    })
    expect(name).toBe('EDI-JSE-01-02-M3-S-0001')
    expect(result.valid).toBe(true)
  })

  it('drops trailing optional fields instead of leaving dangling separators', () => {
    const optional = compileConvention({
      key: 'OPT',
      target: 'SHEET',
      separator: '-',
      fields: [
        { key: 'A', order: 0, source: 'FREE_TEXT', minLength: 1 },
        { key: 'B', order: 1, source: 'FREE_TEXT', required: false },
      ],
    })
    expect(buildName(optional, { A: 'PLANO', B: '' }).name).toBe('PLANO')
  })
})

describe('checkExamples', () => {
  const compiled = compileConvention(isoFileConvention)

  it('passes when every example agrees with the compiled rule', () => {
    const { passed } = checkExamples(compiled, [
      { sample: 'EDI-JSE-01-02-M3-S-0001', shouldBeValid: true },
      { sample: 'EDI-JSE-99-02-M3-S-0001', shouldBeValid: false },
    ])
    expect(passed).toBe(true)
  })

  it('fails and names the drifting example', () => {
    const { passed, checks } = checkExamples(compiled, [
      { sample: 'EDI-JSE-99-02-M3-S-0001', shouldBeValid: true },
    ])
    expect(passed).toBe(false)
    expect(checks[0]).toMatchObject({ sample: 'EDI-JSE-99-02-M3-S-0001', passed: false })
  })
})

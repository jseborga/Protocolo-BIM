import { describe, expect, it } from 'vitest'
import { compileConvention } from '@/server/naming'
import { evaluateAudit, judgeName, type AuditStandard } from '@/server/revit/audit'

const family = compileConvention({
  key: 'FAMILY',
  target: 'FAMILY',
  separator: '_',
  caseRule: 'ANY',
  fields: [
    {
      key: 'DIS',
      order: 0,
      source: 'CODE_TABLE',
      codeTable: { key: 'DIS', values: [{ code: 'ARC' }, { code: 'STR' }] },
    },
    { key: 'CAT', order: 1, source: 'FREE_TEXT', minLength: 3, maxLength: 24 },
    { key: 'DESC', order: 2, source: 'FREE_TEXT', minLength: 3, maxLength: 40 },
  ],
})

const legacyFamily = compileConvention({
  key: 'FAMILY_LEGACY',
  target: 'FAMILY',
  separator: '-',
  caseRule: 'UPPER',
  fields: [
    { key: 'A', order: 0, source: 'FREE_TEXT', minLength: 2, maxLength: 10 },
    { key: 'B', order: 1, source: 'NUMERIC', minLength: 3, maxLength: 3 },
  ],
})

const standard: AuditStandard = {
  conventions: [family],
  sharedParameters: [
    {
      guid: '3F2504E0-4F89-11D3-9A0C-0305E82C3301',
      name: 'GEN_CodigoClasificacion',
      isInstance: true,
      categories: ['OST_Walls', 'OST_Doors'],
      required: true,
    },
    {
      guid: 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',
      name: 'GEN_Opcional',
      isInstance: false,
      categories: ['OST_Walls'],
      required: false,
    },
  ],
  worksets: ['GEN_Niveles y rejillas', 'ARC_General'],
  projectInformation: { name: 'Edificio', number: 'EDI', clientName: 'Cliente S.A.' },
}

const baseSubmission = {
  model: { title: 'EDI-JSE-ZZ-XX-M3-A-0001', isWorkshared: true },
  names: [],
}

describe('judgeName', () => {
  it('accepts a name matching any active convention for the target', () => {
    expect(judgeName([family, legacyFamily], 'PUERTA-001').valid).toBe(true)
    expect(judgeName([family, legacyFamily], 'ARC_Puerta_Batiente simple').valid).toBe(true)
  })

  it('explains the closest convention when none matches', () => {
    const verdict = judgeName([legacyFamily, family], 'XXX_Puerta_Batiente simple')
    expect(verdict.valid).toBe(false)
    if (!verdict.valid) {
      expect(verdict.convention.key).toBe('FAMILY')
      expect(verdict.errors[0]!.code).toBe('NOT_IN_CODE_TABLE')
    }
  })
})

describe('evaluateAudit — names', () => {
  it('reports a wrong family name with the engine’s own per-segment errors', () => {
    const { findings, summary } = evaluateAudit(standard, {
      ...baseSubmission,
      names: [
        { target: 'FAMILY', name: 'ARC_Puerta_Batiente simple', elementId: '1' },
        { target: 'FAMILY', name: 'Puerta genérica', elementId: '2', category: 'OST_Doors' },
      ],
    })

    const naming = findings.filter((finding) => finding.code === 'NAMING')
    expect(naming).toHaveLength(1)
    expect(naming[0]).toMatchObject({
      severity: 'ERROR',
      target: 'FAMILY',
      elementId: '2',
      elementName: 'Puerta genérica',
      category: 'OST_Doors',
      ruleKey: 'naming.FAMILY',
    })
    expect((naming[0]!.params.errors as Array<{ code: string }>)[0]!.code).toBe('SEGMENT_COUNT')
    expect(summary.byTarget.FAMILY).toMatchObject({ checked: 2, errors: 1 })
  })

  it('does not judge a target no active convention covers, and says so', () => {
    const { findings, summary } = evaluateAudit(standard, {
      ...baseSubmission,
      names: [{ target: 'LEVEL', name: 'Nivel 1' }],
    })
    expect(findings.filter((finding) => finding.target === 'LEVEL')).toHaveLength(0)
    expect(summary.byTarget.LEVEL).toMatchObject({ checked: 0, unchecked: 1 })
    expect(summary.uncheckedTargets).toEqual(['LEVEL'])
  })
})

describe('evaluateAudit — shared parameters', () => {
  const bound = {
    name: 'GEN_CodigoClasificacion',
    guid: '3f2504e0-4f89-11d3-9a0c-0305e82c3301',
    isInstance: true,
    categories: ['OST_Walls', 'OST_Doors'],
  }

  it('accepts a correctly bound parameter, comparing GUIDs case-insensitively', () => {
    const { findings } = evaluateAudit(standard, { ...baseSubmission, sharedParameters: [bound] })
    expect(findings.filter((finding) => finding.ruleKey === 'parameter.GEN_CodigoClasificacion')).toEqual([])
  })

  it('flags the same name under a different GUID as an error', () => {
    const { findings } = evaluateAudit(standard, {
      ...baseSubmission,
      sharedParameters: [{ ...bound, guid: '11111111-2222-4333-8444-555555555555' }],
    })
    expect(findings.find((finding) => finding.ruleKey === 'parameter.GEN_CodigoClasificacion')).toMatchObject({
      severity: 'ERROR',
      code: 'PARAMETER_GUID_MISMATCH',
    })
  })

  it('treats a missing required parameter as an error and a missing optional one as information', () => {
    const { findings } = evaluateAudit(standard, { ...baseSubmission, sharedParameters: [] })
    expect(findings.find((f) => f.ruleKey === 'parameter.GEN_CodigoClasificacion')).toMatchObject({
      severity: 'ERROR',
      code: 'PARAMETER_MISSING',
    })
    expect(findings.find((f) => f.ruleKey === 'parameter.GEN_Opcional')).toMatchObject({
      severity: 'INFO',
      code: 'PARAMETER_ABSENT',
    })
  })

  it('reports categories the parameter is not bound to', () => {
    const { findings } = evaluateAudit(standard, {
      ...baseSubmission,
      sharedParameters: [{ ...bound, categories: ['OST_Walls'] }],
    })
    expect(findings.find((f) => f.code === 'PARAMETER_BINDING_INCOMPLETE')).toMatchObject({
      severity: 'WARNING',
      params: { missing: ['OST_Doors'] },
    })
  })

  it('reports a parameter loaded but bound to nothing', () => {
    const { findings } = evaluateAudit(standard, {
      ...baseSubmission,
      sharedParameters: [{ ...bound, categories: [], isInstance: null }],
    })
    expect(findings.find((f) => f.ruleKey === 'parameter.GEN_CodigoClasificacion')).toMatchObject({
      severity: 'ERROR',
      code: 'PARAMETER_NOT_BOUND',
    })
  })

  it('reports an instance parameter bound as a type parameter', () => {
    const { findings } = evaluateAudit(standard, {
      ...baseSubmission,
      sharedParameters: [{ ...bound, isInstance: false }],
    })
    expect(findings.find((f) => f.code === 'PARAMETER_BINDING_KIND')).toMatchObject({
      params: { expected: 'INSTANCE', actual: 'TYPE' },
    })
  })

  it('reports a renamed parameter that kept its GUID', () => {
    const { findings } = evaluateAudit(standard, {
      ...baseSubmission,
      sharedParameters: [{ ...bound, name: 'Codigo clasificacion' }],
    })
    expect(findings.find((f) => f.code === 'PARAMETER_RENAMED')).toMatchObject({
      params: { expected: 'GEN_CodigoClasificacion', actual: 'Codigo clasificacion' },
    })
  })

  it('skips the parameter check entirely when the add-in sent no parameter facts', () => {
    const { findings } = evaluateAudit(standard, baseSubmission)
    expect(findings.some((f) => f.target === 'PARAMETER')).toBe(false)
  })
})

describe('evaluateAudit — worksets and project information', () => {
  it('reports standard worksets missing from a workshared model', () => {
    const { findings } = evaluateAudit(standard, {
      ...baseSubmission,
      worksets: ['ARC_General', 'Workset1'],
    })
    const missing = findings.filter((f) => f.code === 'WORKSET_MISSING')
    expect(missing.map((f) => f.params.name)).toEqual(['GEN_Niveles y rejillas'])
  })

  it('notes once that a non-workshared model cannot carry the standard worksets', () => {
    const { findings } = evaluateAudit(standard, {
      ...baseSubmission,
      model: { title: 'x', isWorkshared: false },
    })
    expect(findings.filter((f) => f.code === 'MODEL_NOT_WORKSHARED')).toHaveLength(1)
    expect(findings.some((f) => f.code === 'WORKSET_MISSING')).toBe(false)
  })

  it('checks the worksets it is sent even when the model does not say it is workshared', () => {
    const { findings, summary } = evaluateAudit(standard, {
      model: { title: 'x' },
      names: [],
      worksets: ['ARC_General'],
    })
    expect(findings.filter((f) => f.code === 'WORKSET_MISSING').map((f) => f.params.name)).toEqual([
      'GEN_Niveles y rejillas',
    ])
    expect(summary.byTarget.WORKSET?.checked).toBe(2)
  })

  it('checks only the project information fields it is sent', () => {
    const { findings } = evaluateAudit(standard, {
      ...baseSubmission,
      projectInformation: { number: 'EDI' },
    })
    expect(findings.filter((f) => f.code === 'PROJECT_INFO_MISMATCH')).toEqual([])

    const empty = evaluateAudit(standard, { ...baseSubmission, projectInformation: { clientName: null } })
    expect(empty.findings.filter((f) => f.code === 'PROJECT_INFO_MISMATCH').map((f) => f.params.field)).toEqual([
      'clientName',
    ])
  })

  it('compares project information with the protocol', () => {
    const { findings } = evaluateAudit(standard, {
      ...baseSubmission,
      projectInformation: { name: 'Edificio', number: '0001', clientName: '' },
    })
    const mismatches = findings.filter((f) => f.code === 'PROJECT_INFO_MISMATCH')
    expect(mismatches.map((f) => f.params.field).sort()).toEqual(['clientName', 'number'])
  })
})

describe('evaluateAudit — totals', () => {
  it('adds up findings by severity and target', () => {
    const { summary } = evaluateAudit(standard, {
      ...baseSubmission,
      names: [{ target: 'FAMILY', name: 'mal' }],
      sharedParameters: [],
      worksets: [],
    })
    expect(summary.errors).toBe(2) // bad family name + missing required parameter
    expect(summary.warnings).toBe(2) // two missing worksets
    expect(summary.infos).toBe(1) // missing optional parameter
    expect(summary.byTarget.PARAMETER).toMatchObject({ checked: 2, errors: 1, infos: 1 })
  })

  it('keeps a bounded number of naming findings but counts every one', () => {
    const names = Array.from({ length: 50 }, (_, i) => ({ target: 'FAMILY' as const, name: `mal${i}` }))
    const { findings, findingsTotal, summary } = evaluateAudit(
      standard,
      { ...baseSubmission, names, sharedParameters: [], worksets: [] },
      { maxNamingFindings: 10 },
    )
    expect(summary.byTarget.FAMILY).toMatchObject({ checked: 50, errors: 50 })
    expect(findingsTotal).toBe(50 + 1 + 1 + 2) // names + missing required + missing optional + worksets
    expect(findings.filter((f) => f.code === 'NAMING')).toHaveLength(10)
    // Model-wide findings survive the cap, and errors come first.
    expect(findings.some((f) => f.code === 'PARAMETER_MISSING')).toBe(true)
    expect(findings.some((f) => f.code === 'WORKSET_MISSING')).toBe(true)
    const ranks = findings.map((f) => ({ ERROR: 0, WARNING: 1, INFO: 2 })[f.severity])
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b))
    expect(findings[0]!.code).toBe('PARAMETER_MISSING')
  })
})

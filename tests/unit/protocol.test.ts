import { describe, expect, it } from 'vitest'
import { computeCompleteness } from '@/server/protocol/completeness'
import { diffLines, diffProtocols, type SectionSnapshot } from '@/server/protocol/diff'
import { ISO19650_TEMPLATE, REQUIRED_SECTION_KEYS } from '@/server/protocol/template'

describe('diffLines', () => {
  it('marks untouched lines as context', () => {
    const lines = diffLines(['a', 'b'], ['a', 'b'])
    expect(lines.every((line) => line.type === 'CONTEXT')).toBe(true)
  })

  it('detects an inserted line without rewriting its neighbours', () => {
    const lines = diffLines(['a', 'c'], ['a', 'b', 'c'])
    expect(lines).toEqual([
      { type: 'CONTEXT', text: 'a' },
      { type: 'ADDED', text: 'b' },
      { type: 'CONTEXT', text: 'c' },
    ])
  })

  it('detects a removed line', () => {
    const lines = diffLines(['a', 'b', 'c'], ['a', 'c'])
    expect(lines.filter((line) => line.type === 'REMOVED')).toEqual([{ type: 'REMOVED', text: 'b' }])
  })

  it('represents a replacement as a removal plus an addition', () => {
    const lines = diffLines(['old'], ['new'])
    expect(lines.map((line) => line.type).sort()).toEqual(['ADDED', 'REMOVED'])
  })
})

describe('diffProtocols', () => {
  const before: SectionSnapshot[] = [
    { key: 'PURPOSE', title: 'Objeto', body: 'Primera línea\nSegunda línea', order: 1 },
    { key: 'CDE', title: 'CDE', body: 'Contenido CDE', order: 2 },
  ]

  it('reports no changes between identical versions', () => {
    const diff = diffProtocols(before, before)
    expect(diff.hasChanges).toBe(false)
    expect(diff.sections.every((section) => section.status === 'UNCHANGED')).toBe(true)
  })

  it('counts added and removed lines per section', () => {
    const after: SectionSnapshot[] = [
      { key: 'PURPOSE', title: 'Objeto', body: 'Primera línea\nSegunda línea cambiada', order: 1 },
      { key: 'CDE', title: 'CDE', body: 'Contenido CDE', order: 2 },
    ]
    const diff = diffProtocols(before, after)
    const purpose = diff.sections.find((section) => section.key === 'PURPOSE')!

    expect(diff.hasChanges).toBe(true)
    expect(purpose.status).toBe('MODIFIED')
    expect(purpose.addedCount).toBe(1)
    expect(purpose.removedCount).toBe(1)
    expect(diff.modifiedSections).toBe(1)
  })

  it('flags a renamed section title as a modification', () => {
    const after = [{ ...before[0]!, title: 'Objeto y alcance' }, before[1]!]
    const diff = diffProtocols(before, after)
    const purpose = diff.sections.find((section) => section.key === 'PURPOSE')!
    expect(purpose.status).toBe('MODIFIED')
    expect(purpose.titleChanged).toBe(true)
    expect(purpose.previousTitle).toBe('Objeto')
  })

  it('reports whole sections added and removed', () => {
    const after: SectionSnapshot[] = [
      before[0]!,
      { key: 'SECURITY', title: 'Seguridad', body: 'Nuevo', order: 3 },
    ]
    const diff = diffProtocols(before, after)
    expect(diff.addedSections).toBe(1)
    expect(diff.removedSections).toBe(1)
    expect(diff.sections.find((section) => section.key === 'SECURITY')!.status).toBe('ADDED')
    expect(diff.sections.find((section) => section.key === 'CDE')!.status).toBe('REMOVED')
  })

  it('orders sections by the newer version', () => {
    const after: SectionSnapshot[] = [
      { key: 'CDE', title: 'CDE', body: 'Contenido CDE', order: 1 },
      { key: 'PURPOSE', title: 'Objeto', body: 'Primera línea\nSegunda línea', order: 2 },
    ]
    expect(diffProtocols(before, after).sections.map((section) => section.key)).toEqual([
      'CDE',
      'PURPOSE',
    ])
  })
})

describe('computeCompleteness', () => {
  const sections = [
    {
      key: 'A',
      isRequired: true,
      title: 'A',
      contents: [
        { locale: 'ES' as const, body: 'texto' },
        { locale: 'EN' as const, body: 'text' },
      ],
    },
    { key: 'B', isRequired: true, title: 'B', contents: [{ locale: 'ES' as const, body: 'texto' }] },
    { key: 'C', isRequired: true, title: 'C', contents: [{ locale: 'ES' as const, body: '   ' }] },
    { key: 'D', isRequired: false, title: 'D', contents: [] },
  ]

  it('measures required sections written in the base language', () => {
    const result = computeCompleteness(sections, 'ES', ['ES', 'EN', 'PT'])
    expect(result.requiredTotal).toBe(3)
    expect(result.requiredDone).toBe(2)
    expect(result.percent).toBe(67)
    expect(result.missing).toEqual([{ key: 'C', title: 'C' }])
  })

  it('treats whitespace-only content as empty', () => {
    const result = computeCompleteness(sections, 'ES', ['ES'])
    expect(result.missing.map((entry) => entry.key)).toContain('C')
  })

  it('measures translation coverage against what is actually written', () => {
    const result = computeCompleteness(sections, 'ES', ['ES', 'EN', 'PT'])
    const english = result.translation.find((entry) => entry.locale === 'EN')!
    const portuguese = result.translation.find((entry) => entry.locale === 'PT')!

    expect(english).toMatchObject({ translated: 1, total: 2, percent: 50 })
    expect(portuguese).toMatchObject({ translated: 0, total: 2, percent: 0 })
    expect(result.translation.some((entry) => entry.locale === 'ES')).toBe(false)
  })

  it('never counts generated sections as work to write', () => {
    const withGenerated = [
      ...sections,
      {
        key: 'TEAM',
        isRequired: true,
        isGenerated: true,
        title: 'Equipo',
        contents: [],
      },
    ]

    const result = computeCompleteness(withGenerated, 'ES', ['ES', 'EN'])

    // Same numbers as without the generated section: it adds no authoring work.
    expect(result.requiredTotal).toBe(3)
    expect(result.requiredDone).toBe(2)
    expect(result.missing.map((entry) => entry.key)).not.toContain('TEAM')
  })

  it('never counts generated sections as work to translate', () => {
    const withGenerated = [
      ...sections,
      { key: 'TEAM', isRequired: true, isGenerated: true, title: 'Equipo', contents: [] },
    ]

    const english = computeCompleteness(withGenerated, 'ES', ['ES', 'EN']).translation.find(
      (entry) => entry.locale === 'EN',
    )!
    expect(english.total).toBe(2)
  })

  it('reports a protocol of only generated sections as complete', () => {
    const result = computeCompleteness(
      [{ key: 'TEAM', isRequired: true, isGenerated: true, title: 'Equipo', contents: [] }],
      'ES',
      ['ES'],
    )
    expect(result.percent).toBe(100)
    expect(result.missing).toEqual([])
  })

  it('reports an empty protocol as zero per cent', () => {
    expect(computeCompleteness([], 'ES', ['ES']).percent).toBe(100)
    expect(
      computeCompleteness(
        [{ key: 'A', isRequired: true, title: 'A', contents: [] }],
        'ES',
        ['ES'],
      ).percent,
    ).toBe(0)
  })
})

describe('ISO 19650 template', () => {
  it('has unique keys and a stable order', () => {
    const keys = ISO19650_TEMPLATE.map((section) => section.key)
    expect(new Set(keys).size).toBe(keys.length)

    const orders = ISO19650_TEMPLATE.map((section) => section.order)
    expect([...orders].sort((a, b) => a - b)).toEqual(orders)
  })

  it('titles and guidance exist in the three languages', () => {
    for (const section of ISO19650_TEMPLATE) {
      for (const locale of ['es', 'en', 'pt'] as const) {
        expect(section.titles[locale], `${section.key}.titles.${locale}`).toBeTruthy()
        expect(section.guidance[locale], `${section.key}.guidance.${locale}`).toBeTruthy()
      }
      if (section.defaultBody) {
        for (const locale of ['es', 'en', 'pt'] as const) {
          expect(section.defaultBody[locale], `${section.key}.defaultBody.${locale}`).toBeTruthy()
        }
      }
    }
  })

  it('covers the mandatory ISO 19650 topics', () => {
    for (const key of ['EIR', 'CDE', 'NAMING', 'LOIN', 'MIDP', 'QA', 'COORDINATES']) {
      expect(REQUIRED_SECTION_KEYS).toContain(key)
    }
  })

  it('every generated section declares its generator', () => {
    for (const section of ISO19650_TEMPLATE) {
      if (section.kind === 'GENERATED') expect(section.generator).toBeTruthy()
      if (section.generator) expect(section.kind).toBe('GENERATED')
    }
  })
})

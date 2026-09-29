import { describe, expect, it } from 'vitest'
import { compileConvention, validateName, type NamingConventionSpec } from '@/server/naming'
import {
  CODE_TABLE_SEEDS,
  NAMING_CONVENTION_SEEDS,
  SHARED_PARAMETER_SEEDS,
  WORKSET_SEEDS,
} from '@/server/protocol/baseline'
import {
  REVIT_CATEGORIES,
  REVIT_CATEGORY_IDS,
  REVIT_DATA_TYPE_IDS,
  REVIT_PALETTE_GROUP_IDS,
} from '@/server/revit/catalog'

/** Compile a seeded convention exactly as provisioning would store it. */
function seededConvention(key: string) {
  const seed = NAMING_CONVENTION_SEEDS.find((convention) => convention.key === key)!
  const spec: NamingConventionSpec = {
    key: seed.key,
    target: seed.target,
    separator: seed.separator,
    caseRule: seed.caseRule,
    maxLength: seed.maxLength,
    fields: seed.fields.map((field) => ({
      ...field,
      codeTable: field.codeTableKey
        ? {
            key: field.codeTableKey,
            values: CODE_TABLE_SEEDS.find((table) => table.key === field.codeTableKey)!.values,
          }
        : null,
    })),
  }
  return compileConvention(spec)
}

describe('baseline Revit standard', () => {
  it('names every shared parameter according to the PARAMETER convention it ships with', () => {
    const convention = seededConvention('PARAMETER')
    for (const parameter of SHARED_PARAMETER_SEEDS) {
      expect({ name: parameter.name, valid: validateName(convention, parameter.name).valid }).toEqual({
        name: parameter.name,
        valid: true,
      })
    }
  })

  it('names every workset according to the WORKSET convention it ships with', () => {
    const convention = seededConvention('WORKSET')
    for (const workset of WORKSET_SEEDS) {
      expect({ name: workset.name, valid: validateName(convention, workset.name).valid }).toEqual({
        name: workset.name,
        valid: true,
      })
    }
  })

  it('uses only categories, data types and palette groups the add-in knows', () => {
    for (const parameter of SHARED_PARAMETER_SEEDS) {
      expect(REVIT_DATA_TYPE_IDS.has(parameter.dataType)).toBe(true)
      expect(REVIT_PALETTE_GROUP_IDS.has(parameter.paletteGroup)).toBe(true)
      for (const category of parameter.categories) {
        expect({ category, known: REVIT_CATEGORY_IDS.has(category) }).toEqual({ category, known: true })
      }
    }
  })

  it('gives every baseline parameter a distinct, well-formed GUID', () => {
    const guids = SHARED_PARAMETER_SEEDS.map((parameter) => parameter.guid)
    expect(new Set(guids).size).toBe(guids.length)
    for (const guid of guids) {
      expect(guid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u)
    }
  })

  it('describes every parameter in the three languages', () => {
    for (const parameter of SHARED_PARAMETER_SEEDS) {
      for (const locale of ['es', 'en', 'pt'] as const) {
        expect(parameter.description[locale], `${parameter.name}.${locale}`).toBeTruthy()
        expect(parameter.group[locale], `${parameter.name}.group.${locale}`).toBeTruthy()
      }
    }
  })

  it('names every Revit category distinctly in each language, so pickers can tell them apart', () => {
    for (const locale of ['es', 'en', 'pt'] as const) {
      const labels = REVIT_CATEGORIES.map((category) => category.labels[locale])
      const repeated = labels.filter((label, index) => labels.indexOf(label) !== index)
      expect({ locale, repeated }).toEqual({ locale, repeated: [] })
    }
  })
})

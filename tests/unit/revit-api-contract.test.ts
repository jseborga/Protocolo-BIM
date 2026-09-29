import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { compileConvention, type NamingConventionSpec } from '@/server/naming'
import {
  CODE_TABLE_SEEDS,
  NAMING_CONVENTION_SEEDS,
  SHARED_PARAMETER_SEEDS,
  WORKSET_SEEDS,
} from '@/server/protocol/baseline'
import {
  auditSubmissionSchema,
  auditSummarySchema,
  namingValidateRequestSchema,
  standardDocumentSchema,
} from '@/server/revit/apiSchemas'
import { evaluateAudit } from '@/server/revit/audit'
import { buildOpenApiDocument } from '@/server/revit/openapi'
import { buildStandard } from '@/server/revit/standard'

const V1_DIR = path.join(process.cwd(), 'src/app/api/v1')

/** Every route under /api/v1 as an OpenAPI path: `[projectId]` → `{projectId}`. */
function routePaths(dir = V1_DIR, prefix = ''): string[] {
  const found: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const segment = entry.name.replace(/^\[(.+)\]$/u, '{$1}')
    const routeDir = path.join(dir, entry.name)
    if (fs.existsSync(path.join(routeDir, 'route.ts'))) found.push(`${prefix}/${segment}`)
    found.push(...routePaths(routeDir, `${prefix}/${segment}`))
  }
  return found
}

function exportedMethods(openApiPath: string): string[] {
  const file = path.join(V1_DIR, openApiPath.replace(/\{(.+?)\}/gu, '[$1]'), 'route.ts')
  const source = fs.readFileSync(file, 'utf8')
  return [...source.matchAll(/export (?:async )?function (GET|POST|PUT|PATCH|DELETE)\b/gu)].map((m) => m[1]!.toLowerCase())
}

function collectRefs(node: unknown, refs: string[] = []): string[] {
  if (Array.isArray(node)) node.forEach((item) => collectRefs(item, refs))
  else if (node && typeof node === 'object') {
    for (const [key, value] of Object.entries(node)) {
      if (key === '$ref' && typeof value === 'string') refs.push(value)
      else collectRefs(value, refs)
    }
  }
  return refs
}

function seededConventions() {
  return NAMING_CONVENTION_SEEDS.map((seed) => {
    const spec: NamingConventionSpec = {
      key: seed.key,
      target: seed.target,
      separator: seed.separator,
      caseRule: seed.caseRule,
      maxLength: seed.maxLength,
      fields: seed.fields.map((field) => ({
        ...field,
        codeTable: field.codeTableKey
          ? { key: field.codeTableKey, values: CODE_TABLE_SEEDS.find((t) => t.key === field.codeTableKey)!.values }
          : null,
      })),
    }
    return compileConvention(spec)
  })
}

describe('/api/v1 contract', () => {
  const document = buildOpenApiDocument('https://bim.example.com') as {
    paths: Record<string, Record<string, unknown>>
    components: { schemas: Record<string, unknown> }
    servers: Array<{ url: string }>
  }

  it('documents every route and every method it exports, and nothing else', () => {
    const exported = routePaths().filter((p) => p !== '/openapi.json')
    expect(Object.keys(document.paths).sort()).toEqual(exported.sort())
    for (const openApiPath of exported) {
      expect({ path: openApiPath, methods: Object.keys(document.paths[openApiPath]!).sort() }).toEqual({
        path: openApiPath,
        methods: exportedMethods(openApiPath).sort(),
      })
    }
  })

  it('resolves every schema reference and never closes an object to new fields', () => {
    for (const reference of collectRefs(document)) {
      const name = reference.replace('#/components/schemas/', '')
      expect(document.components.schemas[name], reference).toBeDefined()
    }
    expect(JSON.stringify(document)).not.toContain('"additionalProperties":false')
  })

  it('points at the server it is served from', () => {
    expect(document.servers).toEqual([{ url: 'https://bim.example.com/api/v1' }])
  })

  it('describes the request bodies the routes actually accept', () => {
    const submission = document.components.schemas.AuditSubmission as {
      required: string[]
      properties: Record<string, unknown>
    }
    expect(submission.required.sort()).toEqual(['model', 'names'])
    expect(Object.keys(submission.properties).sort()).toEqual(
      ['model', 'names', 'projectInformation', 'ruleSetVersion', 'sharedParameters', 'worksets'].sort(),
    )
  })

  it('accepts a realistic audit submission and refuses malformed ones', () => {
    const valid = {
      model: { title: 'EDI-JSE-01-ZZ-M3-A-0001', isWorkshared: true, revitVersion: '2026' },
      ruleSetVersion: 1,
      names: [{ target: 'SHEET', name: 'A-101', elementId: '123', category: 'OST_Sheets' }],
      sharedParameters: [{ name: 'GEN_Originador', guid: '7668ad9f-7aa3-47a1-ad54-32c4d1626dbd', isInstance: null, categories: [] }],
      worksets: ['ARC_General'],
      projectInformation: { name: 'Edificio', number: 'EDI', clientName: null },
    }
    expect(auditSubmissionSchema.safeParse(valid).success).toBe(true)
    expect(auditSubmissionSchema.safeParse({ ...valid, names: [{ target: 'ROOM', name: 'x' }] }).success).toBe(false)
    expect(auditSubmissionSchema.safeParse({ ...valid, model: { title: '   ' } }).success).toBe(false)
    expect(auditSubmissionSchema.safeParse({ names: [] }).success).toBe(false)
    expect(namingValidateRequestSchema.safeParse({ items: [] }).success).toBe(false)
  })

  it('describes the standard document the server builds', () => {
    const conventions = seededConventions()
    const body = buildStandard({
      project: {
        id: 'p1',
        code: 'EDI',
        name: 'Edificio',
        description: null,
        standard: 'ISO 19650',
        baseLocale: 'es',
        locales: ['es', 'en', 'pt'],
        address: 'Av. Siempre Viva 1',
        city: 'La Paz',
        country: 'BO',
        statusLabel: 'Activo',
      },
      organisationName: 'JSE',
      client: { legalName: 'Cliente SA', taxId: null, contactName: null, contactEmail: null },
      conventions,
      parameters: SHARED_PARAMETER_SEEDS.map((parameter) => ({
        guid: parameter.guid,
        name: parameter.name,
        group: parameter.group.es ?? null,
        dataType: parameter.dataType,
        paletteGroup: parameter.paletteGroup,
        isInstance: parameter.isInstance,
        categories: parameter.categories,
        required: parameter.required,
        description: parameter.description.es ?? null,
        ifcPset: parameter.ifcPset,
        ifcProperty: parameter.ifcProperty,
      })),
      worksets: WORKSET_SEEDS.map((workset) => ({ name: workset.name, discipline: null, description: null })),
    })
    const document = {
      ...body,
      ruleSet: { version: 1, hash: 'abc', publishedAt: new Date().toISOString() },
      webUrl: 'https://bim.example.com/es/p/p1',
    }
    const parsed = standardDocumentSchema.safeParse(document)
    expect(parsed.success, JSON.stringify(parsed.error?.issues.slice(0, 3))).toBe(true)
  })

  it('describes the audit summary the evaluator produces', () => {
    const evaluation = evaluateAudit(
      {
        conventions: seededConventions(),
        sharedParameters: [],
        worksets: ['ARC_General'],
        projectInformation: { name: 'Edificio', number: 'EDI', clientName: null },
      },
      {
        model: { title: 'x', isWorkshared: true },
        names: [
          { target: 'SHEET', name: 'bad name' },
          { target: 'LEVEL', name: 'Nivel 1' },
        ],
        worksets: [],
      },
    )
    const parsed = auditSummarySchema.safeParse(evaluation.summary)
    expect(parsed.success, JSON.stringify(parsed.error?.issues.slice(0, 3))).toBe(true)
  })
})

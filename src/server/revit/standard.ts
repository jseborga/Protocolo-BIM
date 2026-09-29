import crypto from 'node:crypto'
import type { CompiledConvention, LocalizedText } from '@/server/naming/types'
import { REVIT_DATA_TYPES, REVIT_PALETTE_GROUPS } from './catalog'

/**
 * The project standard as the Revit add-in consumes it.
 *
 * Everything the add-in needs to set a model up and audit it, in one document:
 * the Project Information values, the active naming conventions already
 * compiled, the shared parameters with their GUIDs and bindings, and the
 * worksets. It is versioned by content: the version only moves when the rules
 * actually change, so an audit can say exactly which rules it was checked
 * against.
 */

export const STANDARD_SCHEMA_VERSION = 1

export interface StandardConventionField {
  key: string
  labels: LocalizedText
  source: string
  required: boolean
  minLength: number | null
  maxLength: number | null
  dateFormat: string | null
  allowedCodes: string[] | null
  example: string | null
}

export interface StandardConvention {
  key: string
  target: string
  labels: LocalizedText
  separator: string
  caseRule: string
  maxLength: number | null
  mask: string
  pattern: string
  fields: StandardConventionField[]
}

export interface StandardSharedParameter {
  guid: string
  name: string
  group: string
  dataType: string
  /** SpecTypeId member path, e.g. "String.Text". */
  spec: string
  paletteGroup: string
  /** GroupTypeId member name, e.g. "IdentityData". */
  groupTypeId: string
  isInstance: boolean
  categories: string[]
  required: boolean
  description: string
  ifc: { pset: string | null; property: string | null }
}

export interface StandardWorkset {
  name: string
  discipline: string | null
  description: string | null
}

export interface ProjectInformationValues {
  name: string
  number: string
  clientName: string | null
  address: string | null
  status: string | null
  organizationName: string | null
}

export interface StandardBody {
  schemaVersion: typeof STANDARD_SCHEMA_VERSION
  project: {
    id: string
    code: string
    name: string
    description: string | null
    standard: string
    baseLocale: string
    locales: string[]
  }
  organisation: { name: string }
  client: {
    legalName: string
    taxId: string | null
    contactName: string | null
    contactEmail: string | null
  } | null
  revit: { projectInformation: ProjectInformationValues }
  naming: { conventions: StandardConvention[] }
  sharedParameters: { groups: string[]; parameters: StandardSharedParameter[] }
  worksets: StandardWorkset[]
}

export interface StandardDocument extends StandardBody {
  ruleSet: { version: number; hash: string; publishedAt: string }
  webUrl: string
}

export interface StandardInput {
  project: {
    id: string
    code: string
    name: string
    description: string | null
    standard: string
    baseLocale: string
    locales: string[]
    address: string | null
    city: string | null
    country: string | null
    statusLabel: string
  }
  organisationName: string
  client: {
    legalName: string
    taxId: string | null
    contactName: string | null
    contactEmail: string | null
  } | null
  conventions: CompiledConvention[]
  parameters: Array<{
    guid: string
    name: string
    group: string | null
    dataType: string
    paletteGroup: string
    isInstance: boolean
    categories: string[]
    required: boolean
    description: string | null
    ifcPset: string | null
    ifcProperty: string | null
  }>
  worksets: Array<{ name: string; discipline: string | null; description: string | null }>
}

const DEFAULT_PARAMETER_GROUP = 'Protocolo BIM'

function specFor(dataType: string): string {
  return REVIT_DATA_TYPES.find((type) => type.id === dataType)?.spec ?? 'String.Text'
}

function groupTypeIdFor(paletteGroup: string): string {
  return REVIT_PALETTE_GROUPS.find((group) => group.id === paletteGroup)?.groupTypeId ?? 'IdentityData'
}

/** Build the standard from already-loaded records. Pure, so it can be tested. */
export function buildStandard(input: StandardInput): StandardBody {
  const address = [input.project.address, input.project.city, input.project.country]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(', ')

  const parameters = input.parameters
    .map<StandardSharedParameter>((parameter) => ({
      guid: parameter.guid.toLowerCase(),
      name: parameter.name,
      group: parameter.group?.trim() || DEFAULT_PARAMETER_GROUP,
      dataType: parameter.dataType,
      spec: specFor(parameter.dataType),
      paletteGroup: parameter.paletteGroup,
      groupTypeId: groupTypeIdFor(parameter.paletteGroup),
      isInstance: parameter.isInstance,
      categories: [...parameter.categories].sort(),
      required: parameter.required,
      description: parameter.description?.trim() ?? '',
      ifc: { pset: parameter.ifcPset, property: parameter.ifcProperty },
    }))
    .sort((a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name))

  return {
    schemaVersion: STANDARD_SCHEMA_VERSION,
    project: {
      id: input.project.id,
      code: input.project.code,
      name: input.project.name,
      description: input.project.description,
      standard: input.project.standard,
      baseLocale: input.project.baseLocale,
      locales: input.project.locales,
    },
    organisation: { name: input.organisationName },
    client: input.client,
    revit: {
      projectInformation: {
        name: input.project.name,
        number: input.project.code,
        clientName: input.client?.legalName ?? null,
        address: address || null,
        status: input.project.statusLabel || null,
        organizationName: input.organisationName,
      },
    },
    naming: {
      conventions: [...input.conventions]
        .sort((a, b) => a.target.localeCompare(b.target) || a.key.localeCompare(b.key))
        .map((convention) => ({
          key: convention.key,
          target: convention.target,
          labels: convention.labels,
          separator: convention.separator,
          caseRule: convention.caseRule,
          maxLength: convention.maxLength,
          mask: convention.mask,
          pattern: convention.regexSource,
          fields: convention.fields.map((field) => ({
            key: field.key,
            labels: field.labels,
            source: field.source,
            required: field.required,
            minLength: field.minLength,
            maxLength: field.maxLength,
            dateFormat: field.dateFormat,
            allowedCodes: field.allowedCodes,
            example: field.example,
          })),
        })),
    },
    sharedParameters: {
      groups: [...new Set(parameters.map((parameter) => parameter.group))].sort(),
      parameters,
    },
    worksets: [...input.worksets].sort((a, b) => a.name.localeCompare(b.name)),
  }
}

/**
 * JSON with object keys sorted at every level, so the same content always
 * produces the same bytes — and the same hash — regardless of query order.
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`).join(',')}}`
}

export function hashStandard(body: StandardBody): string {
  return crypto.createHash('sha256').update(canonicalJson(body)).digest('hex')
}

/** Weak validator for HTTP caching: changes whenever the rules change. */
export function etagFor(version: number, hash: string): string {
  return `"rs-${version}-${hash.slice(0, 16)}"`
}

/**
 * The `/api/v1` contract, as schemas.
 *
 * Requests are validated with these very schemas, and the OpenAPI document at
 * `/api/v1/openapi.json` is generated from them, so what the documentation
 * promises and what the server accepts cannot drift apart. Response schemas
 * describe what the routes return and are checked against real responses in
 * the tests.
 *
 * Written with zod v4 (bundled as `zod/v4`) for its JSON Schema output.
 */

import { z } from 'zod/v4'
import { AUDIT_TARGETS } from './audit'
import { TOKEN_SCOPES } from './tokens'

export const MAX_VALIDATE_ITEMS = 5000
export const MAX_AUDIT_NAMES = 200_000

const LOCALES = ['es', 'en', 'pt'] as const
const SEVERITIES = ['ERROR', 'WARNING', 'INFO'] as const

export const auditTargetSchema = z.enum(AUDIT_TARGETS)

const localizedText = z
  .object({ es: z.string().optional(), en: z.string().optional(), pt: z.string().optional() })
  .describe('The same text in each language that has it.')

// --- requests ----------------------------------------------------------------

export const namingValidateRequestSchema = z.object({
  items: z
    .array(
      z.object({
        target: auditTargetSchema,
        name: z.string().max(512),
      }),
    )
    .min(1)
    .max(MAX_VALIDATE_ITEMS)
    .describe('Names to check, each with the kind of thing it names.'),
})

const optionalText = z.string().max(512).nullable().optional()

export const auditSubmissionSchema = z.object({
  model: z.object({
    title: z.string().trim().min(1).max(260).describe('Model title, e.g. the .rvt file name without extension.'),
    isWorkshared: z.boolean().optional(),
    revitVersion: z.string().max(40).optional(),
    revitBuild: z.string().max(80).optional(),
  }),
  ruleSetVersion: z
    .number()
    .int()
    .nonnegative()
    .optional()
    .describe('The rule set version the client synced. The audit always uses the current one and says whether they differ.'),
  names: z
    .array(
      z.object({
        target: auditTargetSchema,
        name: z.string().max(512),
        elementId: z.string().max(40).optional(),
        uniqueId: z.string().max(80).optional(),
        category: z.string().max(80).optional().describe('BuiltInCategory name, e.g. "OST_Doors".'),
      }),
    )
    .max(MAX_AUDIT_NAMES)
    .describe('Every name found in the model, for the server to judge.'),
  sharedParameters: z
    .array(
      z.object({
        name: z.string().max(256),
        guid: z.string().max(40),
        isInstance: z
          .boolean()
          .nullable()
          .optional()
          .describe('null when the parameter is loaded but not bound, so its kind is unknown.'),
        categories: z.array(z.string().max(80)).max(1000).describe('BuiltInCategory names it is bound to.'),
      }),
    )
    .max(10_000)
    .optional()
    .describe('Shared parameters present in the model. Omit to skip the parameter checks.'),
  worksets: z
    .array(z.string().max(256))
    .max(5000)
    .optional()
    .describe('User workset names. Omit to skip the workset checks.'),
  projectInformation: z
    .object({ name: optionalText, number: optionalText, clientName: optionalText })
    .optional()
    .describe('Project Information values in the model. Omit to skip that check.'),
})

export type NamingValidateRequest = z.infer<typeof namingValidateRequestSchema>
export type AuditSubmissionRequest = z.infer<typeof auditSubmissionSchema>

// --- responses ---------------------------------------------------------------

export const apiErrorSchema = z.object({
  error: z
    .string()
    .describe(
      'Stable code: invalid_token, insufficient_scope, not_found, invalid_json, unreadable_body, payload_too_large, invalid_request.',
    ),
  message: z.string().optional(),
})

const ruleSetRefSchema = z.object({
  version: z.number().int().describe('Moves only when the rules actually change.'),
  hash: z.string().describe('SHA-256 of the standard content.'),
})

export const connectionSchema = z.object({
  apiVersion: z.literal(1),
  server: z.string(),
  token: z.object({ name: z.string(), scopes: z.array(z.enum(TOKEN_SCOPES)) }),
  project: z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    organisation: z.string(),
    baseLocale: z.enum(LOCALES),
  }),
  ruleSet: ruleSetRefSchema.nullable(),
  webUrl: z.string().describe('The project in the web application.'),
})

const conventionFieldSchema = z.object({
  key: z.string(),
  labels: localizedText,
  source: z.enum(['CODE_TABLE', 'FREE_TEXT', 'NUMERIC', 'DATE', 'REGEX']),
  required: z.boolean(),
  minLength: z.number().int().nullable(),
  maxLength: z.number().int().nullable(),
  dateFormat: z.string().nullable(),
  allowedCodes: z.array(z.string()).nullable().describe('Codes accepted by a CODE_TABLE field.'),
  example: z.string().nullable(),
})

const conventionSchema = z.object({
  key: z.string(),
  target: z.string().describe('FILE, MODEL, SHEET, VIEW, FOLDER, FAMILY, TYPE, PARAMETER, WORKSET, LEVEL or GRID.'),
  labels: localizedText,
  separator: z.string(),
  caseRule: z.string(),
  maxLength: z.number().int().nullable(),
  mask: z.string().describe('Human-readable shape, e.g. "PRJ-ORG-VOL-LVL-TYP-ROL-NUM".'),
  pattern: z.string().describe('Anchored regular expression equivalent to the convention (ECMAScript syntax).'),
  fields: z.array(conventionFieldSchema),
})

const sharedParameterSchema = z.object({
  guid: z.string().describe('Lower-case GUID without braces. Never changes once issued.'),
  name: z.string(),
  group: z.string().describe('Group in the shared parameter file.'),
  dataType: z.string().describe('TEXT, MULTILINE_TEXT, URL, INTEGER, NUMBER, LENGTH, AREA, VOLUME, ANGLE, YESNO or CURRENCY.'),
  spec: z.string().describe('SpecTypeId member path in the Revit API, e.g. "String.Text".'),
  paletteGroup: z.string(),
  groupTypeId: z.string().describe('GroupTypeId member name in the Revit API, e.g. "IdentityData".'),
  isInstance: z.boolean(),
  categories: z.array(z.string()).describe('BuiltInCategory names to bind it to, e.g. "OST_Walls".'),
  required: z.boolean(),
  description: z.string(),
  ifc: z.object({ pset: z.string().nullable(), property: z.string().nullable() }),
})

export const standardDocumentSchema = z.object({
  schemaVersion: z.literal(1),
  project: z.object({
    id: z.string(),
    code: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    standard: z.string(),
    baseLocale: z.enum(LOCALES),
    locales: z.array(z.enum(LOCALES)),
  }),
  organisation: z.object({ name: z.string() }),
  client: z
    .object({
      legalName: z.string(),
      taxId: z.string().nullable(),
      contactName: z.string().nullable(),
      contactEmail: z.string().nullable(),
    })
    .nullable(),
  revit: z.object({
    projectInformation: z.object({
      name: z.string(),
      number: z.string(),
      clientName: z.string().nullable(),
      address: z.string().nullable(),
      status: z.string().nullable(),
      organizationName: z.string().nullable(),
    }),
  }),
  naming: z.object({ conventions: z.array(conventionSchema).describe('Active conventions only.') }),
  sharedParameters: z.object({ groups: z.array(z.string()), parameters: z.array(sharedParameterSchema) }),
  worksets: z.array(
    z.object({ name: z.string(), discipline: z.string().nullable(), description: z.string().nullable() }),
  ),
  ruleSet: ruleSetRefSchema.extend({ publishedAt: z.string().describe('ISO 8601.') }),
  webUrl: z.string(),
})

const namingErrorSchema = z.object({
  code: z.enum([
    'EMPTY_VALUE',
    'TOO_LONG',
    'SEGMENT_COUNT',
    'EMPTY_REQUIRED',
    'NOT_IN_CODE_TABLE',
    'FIELD_TOO_SHORT',
    'FIELD_TOO_LONG',
    'NOT_NUMERIC',
    'BAD_DATE',
    'PATTERN_MISMATCH',
    'WRONG_CASE',
    'ILLEGAL_CHARACTER',
  ]),
  fieldKey: z.string().optional(),
  fieldIndex: z.number().int().optional(),
  params: z.record(z.string(), z.union([z.string(), z.number()])).optional(),
})

export const namingValidateResponseSchema = z.object({
  ruleSet: ruleSetRefSchema.extend({ publishedAt: z.string() }),
  locale: z.enum(LOCALES),
  results: z.array(
    z.object({
      target: auditTargetSchema,
      name: z.string(),
      checked: z.boolean().describe('false when no active convention covers the target.'),
      valid: z.boolean().nullable(),
      conventionKey: z.string().nullable().describe('The convention the name came closest to, when invalid.'),
      errors: z.array(namingErrorSchema),
      messages: z.array(z.string()).describe('One sentence per error, in the response locale.'),
    }),
  ),
})

const targetSummarySchema = z.object({
  checked: z.number().int(),
  errors: z.number().int(),
  warnings: z.number().int(),
  infos: z.number().int(),
  unchecked: z.number().int().describe('Submitted but no active convention covers it.'),
})

export const auditSummarySchema = z.object({
  checked: z.number().int(),
  errors: z.number().int(),
  warnings: z.number().int(),
  infos: z.number().int(),
  byTarget: z.record(z.string(), targetSummarySchema),
  uncheckedTargets: z.array(z.string()),
})

export const renderedFindingSchema = z.object({
  severity: z.enum(SEVERITIES),
  target: z.string().describe('An audit target, or PROJECT_INFO.'),
  code: z.enum([
    'NAMING',
    'PARAMETER_MISSING',
    'PARAMETER_ABSENT',
    'PARAMETER_GUID_MISMATCH',
    'PARAMETER_RENAMED',
    'PARAMETER_NOT_BOUND',
    'PARAMETER_BINDING_INCOMPLETE',
    'PARAMETER_BINDING_KIND',
    'WORKSET_MISSING',
    'MODEL_NOT_WORKSHARED',
    'PROJECT_INFO_MISMATCH',
  ]),
  ruleKey: z.string().describe('Stable key of the rule, for grouping findings across runs.'),
  elementId: z.string().nullable(),
  elementName: z.string().nullable(),
  category: z.string().nullable(),
  message: z.string().describe('In the response locale.'),
  details: z.array(z.string()),
  params: z.record(z.string(), z.unknown()),
})

const runSchema = z.object({
  id: z.string(),
  modelName: z.string(),
  startedAt: z.string().describe('ISO 8601.'),
  ruleSetVersion: z.number().int().nullable(),
})

export const auditRunCreatedSchema = z.object({
  run: runSchema.extend({
    rulesChangedSinceSync: z.boolean().describe('The client synced a different rule set version than the one used.'),
  }),
  summary: auditSummarySchema,
  findings: z.array(renderedFindingSchema).describe('At most 5 000; the rest are on the web page.'),
  findingsTotal: z.number().int(),
  findingsReturned: z.number().int(),
  findingsStored: z.number().int(),
  truncated: z.boolean(),
  locale: z.enum(LOCALES),
  webUrl: z.string(),
})

export const auditRunDetailSchema = z.object({
  run: runSchema,
  summary: auditSummarySchema.nullable(),
  findings: z.array(renderedFindingSchema),
  truncated: z.boolean(),
  locale: z.enum(LOCALES),
  webUrl: z.string(),
})

export const auditRunListSchema = z.object({
  runs: z.array(
    runSchema.extend({
      checked: z.number().int(),
      errors: z.number().int(),
      warnings: z.number().int(),
      infos: z.number().int(),
      webUrl: z.string(),
    }),
  ),
  nextCursor: z.string().nullable().describe('Pass as ?cursor= to get the next, older page.'),
})

/** Named schemas, in the order they appear in the OpenAPI document. */
export const API_SCHEMAS = {
  Error: apiErrorSchema,
  Connection: connectionSchema,
  StandardDocument: standardDocumentSchema,
  NamingValidateRequest: namingValidateRequestSchema,
  NamingValidateResponse: namingValidateResponseSchema,
  AuditSubmission: auditSubmissionSchema,
  AuditSummary: auditSummarySchema,
  Finding: renderedFindingSchema,
  AuditRunCreated: auditRunCreatedSchema,
  AuditRunDetail: auditRunDetailSchema,
  AuditRunList: auditRunListSchema,
} as const

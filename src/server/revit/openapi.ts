/**
 * OpenAPI 3.1 description of `/api/v1`, served at `/api/v1/openapi.json`.
 *
 * Component schemas are generated from `apiSchemas.ts` — the same schemas the
 * routes validate with — so importing this document into Postman, Swagger UI
 * or a client generator gives exactly what the server accepts and returns.
 */

import { z } from 'zod/v4'
import { API_SCHEMAS } from './apiSchemas'
import { TOKEN_SCOPES } from './tokens'

type Json = Record<string, unknown>

const ref = (name: keyof typeof API_SCHEMAS) => ({ $ref: `#/components/schemas/${name}` })

const json = (name: keyof typeof API_SCHEMAS) => ({ 'application/json': { schema: ref(name) } })

const errorResponse = (description: string) => ({ description, content: json('Error') })

const projectIdParameter = {
  name: 'projectId',
  in: 'path',
  required: true,
  description: 'The project the API key belongs to (returned by GET /connection).',
  schema: { type: 'string' },
}

const localeParameter = {
  name: 'locale',
  in: 'query',
  required: false,
  description: 'Language of messages: es, en or pt. Defaults to Accept-Language, then the project language.',
  schema: { type: 'string', enum: ['es', 'en', 'pt'] },
}

/** Responses every authenticated operation can give. */
const authErrors = {
  '401': errorResponse('The API key is missing, malformed, unknown, revoked or expired.'),
  '403': errorResponse('The API key lacks the scope this operation needs.'),
  '404': errorResponse('Not found, or the API key belongs to another project.'),
}

const bodyErrors = {
  '400': errorResponse('The body is not valid JSON.'),
  '413': errorResponse('The body is larger than 25 MB.'),
  '422': errorResponse('The body does not match the schema; `message` names the first offending field.'),
}

/**
 * The generator marks every object closed (`additionalProperties: false`);
 * the API promises the opposite — new optional fields may appear in
 * responses, and unknown request fields are ignored — so those marks go, as
 * do the ±2^53 bounds it adds to every integer.
 */
function tidy(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(tidy)
  if (!node || typeof node !== 'object') return node
  const out: Json = {}
  for (const [key, value] of Object.entries(node as Json)) {
    if (key === '$schema' || key === '$id') continue
    if (key === 'additionalProperties' && value === false) continue
    if ((key === 'maximum' && value === Number.MAX_SAFE_INTEGER) || (key === 'minimum' && value === Number.MIN_SAFE_INTEGER)) {
      continue
    }
    out[key] = tidy(value)
  }
  return out
}

function componentSchemas(): Json {
  const registry = z.registry<{ id: string }>()
  for (const [id, schema] of Object.entries(API_SCHEMAS)) registry.add(schema, { id })
  const generated = z.toJSONSchema(registry, {
    uri: (id) => `#/components/schemas/${id}`,
    io: 'input',
    unrepresentable: 'any',
  })
  return tidy(generated.schemas) as Json
}

export function buildOpenApiDocument(serverUrl: string): Json {
  return {
    openapi: '3.1.0',
    info: {
      title: 'Protocolo BIM API',
      version: '1',
      description: [
        'Connects external tools — the Revit add-in, scripts, dashboards — to one project of Protocolo BIM.',
        '',
        'Authenticate with a project API key created in Project settings → API keys, sent as',
        '`Authorization: Bearer <key>` or `X-API-Key: <key>`. A key opens one project only.',
        '',
        'Typical flow: GET /connection → GET the standard (keep its ETag) → POST an audit of a model →',
        'read the findings in the response or on the web page it links to.',
      ].join('\n'),
    },
    servers: [{ url: `${serverUrl}/api/v1` }],
    security: [{ bearerAuth: [] }, { apiKeyHeader: [] }],
    tags: [
      { name: 'Connection' },
      { name: 'Standard', description: 'The project rules: naming, shared parameters, worksets, project information.' },
      { name: 'Audits', description: 'Model audits judged against the standard.' },
    ],
    paths: {
      '/connection': {
        get: {
          tags: ['Connection'],
          operationId: 'getConnection',
          summary: 'Check the key and learn which project it opens',
          description: 'Needs no particular scope. Call it first: it returns the project id every other path uses.',
          responses: {
            '200': { description: 'The key works.', content: json('Connection') },
            '401': authErrors['401'],
          },
        },
      },
      '/projects/{projectId}/standard': {
        get: {
          tags: ['Standard'],
          operationId: 'getStandard',
          summary: 'Download the project standard',
          description:
            'Scope `standard:read`. Send the ETag of the copy you hold as If-None-Match to get 304 when nothing changed.',
          parameters: [
            projectIdParameter,
            { name: 'If-None-Match', in: 'header', required: false, schema: { type: 'string' } },
          ],
          responses: {
            '200': {
              description: 'The standard, with its version.',
              headers: { ETag: { schema: { type: 'string' }, description: 'e.g. "rs-3-1a2b3c4d5e6f7a8b"' } },
              content: json('StandardDocument'),
            },
            '304': { description: 'The copy you hold is current.' },
            ...authErrors,
          },
        },
      },
      '/projects/{projectId}/shared-parameters.txt': {
        get: {
          tags: ['Standard'],
          operationId: 'getSharedParameterFile',
          summary: 'Download the Revit shared parameter file',
          description: 'Scope `standard:read`. UTF-16 LE with BOM and CRLF line ends, as Revit writes it.',
          parameters: [projectIdParameter],
          responses: {
            '200': {
              description: 'The shared parameter file.',
              content: { 'text/plain; charset=utf-16le': { schema: { type: 'string' } } },
            },
            ...authErrors,
          },
        },
      },
      '/projects/{projectId}/naming/validate': {
        post: {
          tags: ['Standard'],
          operationId: 'validateNames',
          summary: 'Check names against the naming conventions',
          description: 'Scope `standard:read`. Records nothing. Up to 5 000 names per call.',
          parameters: [projectIdParameter, localeParameter],
          requestBody: { required: true, content: json('NamingValidateRequest') },
          responses: {
            '200': { description: 'One result per name, in order.', content: json('NamingValidateResponse') },
            ...authErrors,
            ...bodyErrors,
          },
        },
      },
      '/projects/{projectId}/audit-runs': {
        get: {
          tags: ['Audits'],
          operationId: 'listAuditRuns',
          summary: 'List audits, newest first',
          description: 'Scope `standard:read` or `audit:write`.',
          parameters: [
            projectIdParameter,
            localeParameter,
            { name: 'limit', in: 'query', required: false, schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 } },
            { name: 'cursor', in: 'query', required: false, schema: { type: 'string' }, description: 'nextCursor of the previous page.' },
          ],
          responses: {
            '200': { description: 'A page of audits.', content: json('AuditRunList') },
            ...authErrors,
            '422': errorResponse('The cursor is unknown.'),
          },
        },
        post: {
          tags: ['Audits'],
          operationId: 'createAuditRun',
          summary: 'Submit the facts of a model and get it audited',
          description: [
            'Scope `audit:write`. The client reports what the model contains; the server judges it against the',
            'current standard, stores the run and returns the findings. Parts left out of the body are not checked.',
          ].join(' '),
          parameters: [projectIdParameter, localeParameter],
          requestBody: { required: true, content: json('AuditSubmission') },
          responses: {
            '201': {
              description: 'The audit was recorded.',
              headers: { Location: { schema: { type: 'string' } } },
              content: json('AuditRunCreated'),
            },
            ...authErrors,
            ...bodyErrors,
          },
        },
      },
      '/projects/{projectId}/audit-runs/{runId}': {
        get: {
          tags: ['Audits'],
          operationId: 'getAuditRun',
          summary: 'Read one audit with its findings',
          description: 'Scope `standard:read` or `audit:write`.',
          parameters: [
            projectIdParameter,
            { name: 'runId', in: 'path', required: true, schema: { type: 'string' } },
            localeParameter,
          ],
          responses: {
            '200': { description: 'The audit.', content: json('AuditRunDetail') },
            ...authErrors,
          },
        },
      },
    },
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'pbim_<8 characters>_<secret>',
          description: `Project API key. Scopes: ${TOKEN_SCOPES.join(', ')}.`,
        },
        apiKeyHeader: { type: 'apiKey', in: 'header', name: 'X-API-Key' },
      },
      schemas: componentSchemas(),
    },
  }
}

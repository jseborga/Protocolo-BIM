import 'server-only'
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import {
  apiKeyFrom,
  hashToken,
  hasScope,
  isTokenUsable,
  parseToken,
  type TokenScope,
} from './tokens'

export interface ApiContext {
  tokenId: string
  tokenName: string
  scopes: string[]
  createdById: string
  project: {
    id: string
    code: string
    name: string
    orgId: string
    orgName: string
    baseLocale: 'ES' | 'EN' | 'PT'
  }
}

export type ApiAuthResult = { ok: true; context: ApiContext } | { ok: false; response: NextResponse }

/**
 * A JSON response that states its charset. JSON is UTF-8 by definition, but
 * Windows PowerShell 5.1 decodes a response without `charset` as ISO-8859-1,
 * which turns every accented message into mojibake.
 */
export function apiJson(body: unknown, init: ResponseInit = {}) {
  const response = NextResponse.json(body, init)
  response.headers.set('Content-Type', 'application/json; charset=utf-8')
  return response
}

/** JSON error with a stable machine-readable `error` code. */
export function apiError(status: number, error: string, message?: string, headers?: HeadersInit) {
  return apiJson({ error, ...(message ? { message } : {}) }, { status, headers })
}

const UNAUTHORIZED = {
  'WWW-Authenticate': 'Bearer realm="protocolo-bim", error="invalid_token"',
  'Cache-Control': 'no-store',
}

/**
 * Authenticate an `/api/v1` request by project API key.
 *
 * A token belongs to one project, so the project in the URL must be that one.
 * A mismatch answers 404 rather than 403: a token holder learns nothing about
 * projects it was not issued for.
 */
export async function authenticateApi(
  request: Request,
  /** The scope required; with a list, any one of them is enough. */
  needed: TokenScope | readonly TokenScope[] | null,
  projectIdFromUrl?: string,
): Promise<ApiAuthResult> {
  const parsed = parseToken(apiKeyFrom(request.headers))
  if (!parsed) {
    return {
      ok: false,
      response: apiError(
        401,
        'invalid_token',
        'Missing or malformed API key: send "Authorization: Bearer <key>" or "X-API-Key: <key>"',
        UNAUTHORIZED,
      ),
    }
  }

  const token = await prisma.apiToken.findUnique({
    where: { tokenHash: hashToken(parsed.token) },
    include: {
      project: {
        select: { id: true, code: true, name: true, orgId: true, baseLocale: true, org: { select: { name: true } } },
      },
    },
  })

  if (!token || !isTokenUsable(token)) {
    return { ok: false, response: apiError(401, 'invalid_token', 'API key is unknown, revoked or expired', UNAUTHORIZED) }
  }

  if (projectIdFromUrl && projectIdFromUrl !== token.projectId) {
    return { ok: false, response: apiError(404, 'not_found') }
  }

  const accepted = needed === null ? [] : typeof needed === 'string' ? [needed] : needed
  if (accepted.length > 0 && !accepted.some((scope) => hasScope(token.scopes, scope))) {
    const wanted = accepted.join(' ')
    return {
      ok: false,
      response: apiError(403, 'insufficient_scope', `This API key lacks the ${accepted.join(' or ')} scope`, {
        'WWW-Authenticate': `Bearer realm="protocolo-bim", error="insufficient_scope", scope="${wanted}"`,
      }),
    }
  }

  // Best effort: a failed timestamp update must never fail the request.
  prisma.apiToken
    .update({ where: { id: token.id }, data: { lastUsedAt: new Date() } })
    .catch(() => undefined)

  return {
    ok: true,
    context: {
      tokenId: token.id,
      tokenName: token.name,
      scopes: token.scopes,
      createdById: token.createdById,
      project: {
        id: token.project.id,
        code: token.project.code,
        name: token.project.name,
        orgId: token.project.orgId,
        orgName: token.project.org.name,
        baseLocale: token.project.baseLocale,
      },
    },
  }
}

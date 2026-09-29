import crypto from 'node:crypto'

/**
 * Project API keys, used by the Revit add-in (or any other client) instead of
 * a person's session.
 *
 * Format: `pbim_<prefix>_<secret>`. The prefix is stored in clear so a token
 * can be recognised in the list ("pbim_k3v9…"), the whole token is stored only
 * as a SHA-256 hash, and the plain value exists exactly once — in the response
 * that creates it.
 */

export const TOKEN_SCOPES = ['standard:read', 'audit:write'] as const
export type TokenScope = (typeof TOKEN_SCOPES)[number]

const TOKEN_PATTERN = /^pbim_([A-Za-z0-9]{8})_([A-Za-z0-9_-]{32,})$/u

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function generateToken(): { token: string; prefix: string; hash: string } {
  const prefix = crypto
    .randomBytes(6)
    .toString('base64url')
    .replace(/[^A-Za-z0-9]/gu, 'x')
    .slice(0, 8)
  const secret = crypto.randomBytes(32).toString('base64url')
  const token = `pbim_${prefix}_${secret}`
  return { token, prefix, hash: hashToken(token) }
}

/** Shape check before touching the database, so garbage costs nothing. */
export function parseToken(raw: string | null | undefined): { token: string; prefix: string } | null {
  const token = raw?.trim()
  if (!token) return null
  const match = TOKEN_PATTERN.exec(token)
  return match ? { token, prefix: match[1]! } : null
}

/** Reads `Authorization: Bearer <token>`. */
export function bearerFrom(header: string | null): string | null {
  if (!header) return null
  const match = /^Bearer\s+(.+)$/iu.exec(header.trim())
  return match ? match[1]!.trim() : null
}

/**
 * The key a request presents: `Authorization: Bearer <key>` or, for clients
 * that only let you set a named header (Power Query, some HTTP tools),
 * `X-API-Key: <key>`. Authorization wins when both are sent.
 */
export function apiKeyFrom(headers: Headers): string | null {
  return bearerFrom(headers.get('authorization')) ?? (headers.get('x-api-key')?.trim() || null)
}

export function hasScope(scopes: readonly string[], needed: TokenScope): boolean {
  return scopes.includes(needed)
}

export interface TokenState {
  revokedAt: Date | null
  expiresAt: Date | null
}

export function isTokenUsable(token: TokenState, now: Date = new Date()): boolean {
  if (token.revokedAt) return false
  if (token.expiresAt && token.expiresAt <= now) return false
  return true
}

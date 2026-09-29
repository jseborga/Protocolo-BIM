import { describe, expect, it } from 'vitest'
import {
  apiKeyFrom,
  bearerFrom,
  generateToken,
  hashToken,
  hasScope,
  isTokenUsable,
  parseToken,
} from '@/server/revit/tokens'

describe('project API tokens', () => {
  it('generates a token its own parser accepts, with a visible prefix', () => {
    const { token, prefix, hash } = generateToken()
    expect(token.startsWith(`pbim_${prefix}_`)).toBe(true)
    expect(prefix).toMatch(/^[A-Za-z0-9]{8}$/u)
    expect(parseToken(token)).toEqual({ token, prefix })
    expect(hash).toBe(hashToken(token))
  })

  it('never stores the token itself', () => {
    const { token, hash } = generateToken()
    expect(hash).not.toContain(token)
    expect(hash).toMatch(/^[0-9a-f]{64}$/u)
  })

  it('generates different tokens every time', () => {
    const tokens = new Set(Array.from({ length: 50 }, () => generateToken().token))
    expect(tokens.size).toBe(50)
  })

  it('rejects malformed tokens before any lookup', () => {
    expect(parseToken('')).toBeNull()
    expect(parseToken('pbim_short_x')).toBeNull()
    expect(parseToken('ghp_abcdefghijklmnopqrstuvwxyz0123456789')).toBeNull()
    expect(parseToken(null)).toBeNull()
  })

  it('reads a bearer header case-insensitively and ignores other schemes', () => {
    expect(bearerFrom('Bearer abc')).toBe('abc')
    expect(bearerFrom('bearer   abc  ')).toBe('abc')
    expect(bearerFrom('Basic dXNlcjpwYXNz')).toBeNull()
    expect(bearerFrom(null)).toBeNull()
  })

  it('accepts the key as a bearer token or in X-API-Key, preferring Authorization', () => {
    expect(apiKeyFrom(new Headers({ authorization: 'Bearer abc' }))).toBe('abc')
    expect(apiKeyFrom(new Headers({ 'x-api-key': '  abc ' }))).toBe('abc')
    expect(apiKeyFrom(new Headers({ authorization: 'Bearer one', 'x-api-key': 'two' }))).toBe('one')
    expect(apiKeyFrom(new Headers({ authorization: 'Basic dXNlcjpwYXNz', 'x-api-key': 'two' }))).toBe('two')
    expect(apiKeyFrom(new Headers({ 'x-api-key': '   ' }))).toBeNull()
    expect(apiKeyFrom(new Headers())).toBeNull()
  })

  it('checks scopes exactly', () => {
    expect(hasScope(['standard:read'], 'standard:read')).toBe(true)
    expect(hasScope(['standard:read'], 'audit:write')).toBe(false)
  })

  it('refuses revoked and expired tokens', () => {
    const now = new Date('2026-09-29T12:00:00Z')
    expect(isTokenUsable({ revokedAt: null, expiresAt: null }, now)).toBe(true)
    expect(isTokenUsable({ revokedAt: new Date('2026-09-01'), expiresAt: null }, now)).toBe(false)
    expect(isTokenUsable({ revokedAt: null, expiresAt: new Date('2026-09-29T11:59:59Z') }, now)).toBe(false)
    expect(isTokenUsable({ revokedAt: null, expiresAt: new Date('2026-10-01') }, now)).toBe(true)
  })
})

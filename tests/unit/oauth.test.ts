import { describe, expect, it } from 'vitest'
import { decideLink, isEmailTrustworthy } from '@/server/auth/oauth/linking'
import { MICROSOFT_CONSUMER_TENANT } from '@/server/auth/oauth/providers'
import { safeNextPath } from '@/server/auth/redirects'

const googleClaims = {
  subject: 'g-123',
  email: 'ana@estudio.test',
  emailVerified: true,
  name: 'Ana Ribeiro',
}

const workMicrosoftClaims = {
  subject: 'm-456',
  email: 'ana@estudio.test',
  name: 'Ana Ribeiro',
  tenantId: '8f1ec1a1-0000-4000-9000-abcdefabcdef',
}

describe('isEmailTrustworthy', () => {
  it('trusts Google only when it says the address is verified', () => {
    expect(isEmailTrustworthy('google', googleClaims)).toBe(true)
    expect(isEmailTrustworthy('google', { ...googleClaims, emailVerified: false })).toBe(false)
    expect(isEmailTrustworthy('google', { ...googleClaims, emailVerified: undefined })).toBe(false)
  })

  it('trusts a Microsoft work or school tenant', () => {
    expect(isEmailTrustworthy('microsoft', workMicrosoftClaims)).toBe(true)
  })

  it('does not trust a personal Microsoft account', () => {
    expect(
      isEmailTrustworthy('microsoft', {
        ...workMicrosoftClaims,
        tenantId: MICROSOFT_CONSUMER_TENANT,
      }),
    ).toBe(false)
    expect(isEmailTrustworthy('microsoft', { ...workMicrosoftClaims, tenantId: undefined })).toBe(
      false,
    )
  })

  it('never trusts claims without an address', () => {
    expect(isEmailTrustworthy('google', { subject: 'x', emailVerified: true })).toBe(false)
  })
})

describe('decideLink', () => {
  it('signs in an account already bound to the provider', () => {
    expect(
      decideLink({
        provider: 'google',
        claims: googleClaims,
        linkedUserId: 'user-1',
        existingUser: null,
      }),
    ).toEqual({ action: 'SIGN_IN', userId: 'user-1' })
  })

  it('prefers the existing binding even when another account holds the address', () => {
    expect(
      decideLink({
        provider: 'google',
        claims: googleClaims,
        linkedUserId: 'user-1',
        existingUser: { id: 'user-2', isActive: true },
      }),
    ).toEqual({ action: 'SIGN_IN', userId: 'user-1' })
  })

  it('creates an account when nobody holds the verified address', () => {
    expect(
      decideLink({
        provider: 'google',
        claims: googleClaims,
        linkedUserId: null,
        existingUser: null,
      }),
    ).toEqual({ action: 'CREATE' })
  })

  it('links a password account when the provider vouches for the address', () => {
    expect(
      decideLink({
        provider: 'google',
        claims: googleClaims,
        linkedUserId: null,
        existingUser: { id: 'user-9', isActive: true },
      }),
    ).toEqual({ action: 'LINK', userId: 'user-9' })
  })

  it('links a work Microsoft account to an existing address', () => {
    expect(
      decideLink({
        provider: 'microsoft',
        claims: workMicrosoftClaims,
        linkedUserId: null,
        existingUser: { id: 'user-9', isActive: true },
      }),
    ).toEqual({ action: 'LINK', userId: 'user-9' })
  })

  it('refuses to take over an address the provider has not verified', () => {
    expect(
      decideLink({
        provider: 'google',
        claims: { ...googleClaims, emailVerified: false },
        linkedUserId: null,
        existingUser: { id: 'user-9', isActive: true },
      }),
    ).toEqual({ action: 'REFUSE', reason: 'EMAIL_NOT_VERIFIED' })
  })

  it('refuses a personal Microsoft account claiming an existing address', () => {
    expect(
      decideLink({
        provider: 'microsoft',
        claims: { ...workMicrosoftClaims, tenantId: MICROSOFT_CONSUMER_TENANT },
        linkedUserId: null,
        existingUser: { id: 'user-9', isActive: true },
      }),
    ).toEqual({ action: 'REFUSE', reason: 'EMAIL_NOT_VERIFIED' })
  })

  it('refuses to create an account from an unverified address', () => {
    expect(
      decideLink({
        provider: 'google',
        claims: { ...googleClaims, emailVerified: false },
        linkedUserId: null,
        existingUser: null,
      }),
    ).toEqual({ action: 'REFUSE', reason: 'EMAIL_NOT_VERIFIED' })
  })

  it('refuses when the provider sends no address at all', () => {
    expect(
      decideLink({
        provider: 'google',
        claims: { subject: 'g-1' },
        linkedUserId: null,
        existingUser: null,
      }),
    ).toEqual({ action: 'REFUSE', reason: 'NO_EMAIL' })
  })

  it('refuses a deactivated account', () => {
    expect(
      decideLink({
        provider: 'google',
        claims: googleClaims,
        linkedUserId: null,
        existingUser: { id: 'user-9', isActive: false },
      }),
    ).toEqual({ action: 'REFUSE', reason: 'ACCOUNT_DISABLED' })
  })

  it('matches the address case-insensitively', () => {
    expect(
      decideLink({
        provider: 'google',
        claims: { ...googleClaims, email: 'ANA@Estudio.TEST' },
        linkedUserId: null,
        existingUser: { id: 'user-9', isActive: true },
      }),
    ).toEqual({ action: 'LINK', userId: 'user-9' })
  })
})

describe('safeNextPath', () => {
  it('keeps a same-site path', () => {
    expect(safeNextPath('/es/projects', '/fallback')).toBe('/es/projects')
  })

  it('rejects an absolute URL', () => {
    expect(safeNextPath('https://evil.example/steal', '/fallback')).toBe('/fallback')
  })

  it('rejects a protocol-relative URL', () => {
    expect(safeNextPath('//evil.example', '/fallback')).toBe('/fallback')
  })

  it('rejects a backslash-obfuscated URL', () => {
    expect(safeNextPath('/\\evil.example', '/fallback')).toBe('/fallback')
  })

  it('falls back on empty input', () => {
    expect(safeNextPath(null, '/fallback')).toBe('/fallback')
    expect(safeNextPath('', '/fallback')).toBe('/fallback')
  })
})

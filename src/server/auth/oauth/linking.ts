import { MICROSOFT_CONSUMER_TENANT, type OAuthProviderId } from './providers'

/** The subset of ID token claims this application reads. */
export interface IdentityClaims {
  /** Stable identifier of the account at the provider. */
  subject: string
  email?: string
  emailVerified?: boolean
  name?: string
  picture?: string
  /** Microsoft tenant the account belongs to. */
  tenantId?: string
}

export type LinkDecision =
  /** The provider account is already bound to a user. */
  | { action: 'SIGN_IN'; userId: string }
  /** No account yet, and nobody holds the address: create one. */
  | { action: 'CREATE' }
  /** Somebody holds the address and the provider vouches for it: bind them. */
  | { action: 'LINK'; userId: string }
  /** Refused, with the reason to show the person. */
  | { action: 'REFUSE'; reason: LinkRefusal }

export type LinkRefusal =
  | 'NO_EMAIL'
  | 'EMAIL_NOT_VERIFIED'
  | 'ACCOUNT_DISABLED'

export interface LinkInput {
  provider: OAuthProviderId
  claims: IdentityClaims
  /** The user already bound to this provider account, if any. */
  linkedUserId: string | null
  /** A user holding the same email address, if any. */
  existingUser: { id: string; isActive: boolean } | null
}

/**
 * Decide what a federated sign-in should do.
 *
 * Binding a provider account to an existing address is how someone who
 * registered with a password later signs in with Google. It is also how an
 * account gets taken over if the provider does not actually own the address,
 * so linking happens only against a verified email:
 *
 *  - Google states `email_verified` and is trusted when it is true.
 *  - Microsoft work and school accounts are verified by their tenant, but
 *    personal Microsoft accounts can carry an unverified address, so they are
 *    treated as unverified and refused rather than linked.
 *
 * Kept pure so the rule can be read and tested on its own.
 */
export function decideLink(input: LinkInput): LinkDecision {
  if (input.linkedUserId) return { action: 'SIGN_IN', userId: input.linkedUserId }

  const email = input.claims.email?.trim().toLowerCase()
  if (!email) return { action: 'REFUSE', reason: 'NO_EMAIL' }

  const verified = isEmailTrustworthy(input.provider, input.claims)

  if (!input.existingUser) {
    return verified ? { action: 'CREATE' } : { action: 'REFUSE', reason: 'EMAIL_NOT_VERIFIED' }
  }

  if (!input.existingUser.isActive) return { action: 'REFUSE', reason: 'ACCOUNT_DISABLED' }
  if (!verified) return { action: 'REFUSE', reason: 'EMAIL_NOT_VERIFIED' }

  return { action: 'LINK', userId: input.existingUser.id }
}

export function isEmailTrustworthy(provider: OAuthProviderId, claims: IdentityClaims): boolean {
  if (!claims.email) return false
  if (provider === 'google') return claims.emailVerified === true
  // Entra ID does not emit `email_verified`; a work or school tenant vouches
  // for the address, the consumer tenant does not.
  return Boolean(claims.tenantId) && claims.tenantId !== MICROSOFT_CONSUMER_TENANT
}

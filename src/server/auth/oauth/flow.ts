import 'server-only'
import { cookies } from 'next/headers'
import * as client from 'openid-client'
import {
  callbackUrl,
  getProviderConfig,
  type OAuthProviderConfig,
  type OAuthProviderId,
} from './providers'
import type { IdentityClaims } from './linking'

const TRANSACTION_COOKIE = 'pbim_oauth'
const TRANSACTION_TTL_SECONDS = 10 * 60

interface Transaction {
  provider: OAuthProviderId
  state: string
  nonce: string
  codeVerifier: string
  /** Interface language the sign-in started in. */
  locale: string
  /** Destination once signed in, without the locale prefix. */
  next: string
}

/** Discovery results are stable; caching avoids a round trip per sign-in. */
const discoveryCache = new Map<string, Promise<client.Configuration>>()

async function discover(config: OAuthProviderConfig): Promise<client.Configuration> {
  const cached = discoveryCache.get(config.id)
  if (cached) return cached

  const discovered = client.discovery(
    new URL(config.issuer),
    config.clientId,
    config.clientSecret,
  )
  discoveryCache.set(config.id, discovered)
  return discovered
}

/**
 * Start a sign-in: build the authorization URL and remember the one-time
 * values the callback has to check.
 *
 * The state, nonce and PKCE verifier live in a short-lived HttpOnly cookie
 * rather than in the session, so the flow works for someone who has no session
 * yet, and a stale transaction simply expires.
 */
export async function beginOAuth(
  provider: OAuthProviderId,
  locale: string,
  next: string,
): Promise<string | null> {
  const config = getProviderConfig(provider)
  if (!config) return null

  const discovered = await discover(config)

  const codeVerifier = client.randomPKCECodeVerifier()
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier)
  const state = client.randomState()
  const nonce = client.randomNonce()

  const url = client.buildAuthorizationUrl(discovered, {
    redirect_uri: callbackUrl(provider),
    scope: config.scope,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state,
    nonce,
    ...(config.authorizationParams ?? {}),
  })

  const transaction: Transaction = { provider, state, nonce, codeVerifier, locale, next }
  const store = await cookies()
  store.set(TRANSACTION_COOKIE, JSON.stringify(transaction), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TRANSACTION_TTL_SECONDS,
  })

  return url.href
}

export async function readTransaction(): Promise<Transaction | null> {
  const raw = (await cookies()).get(TRANSACTION_COOKIE)?.value
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as Transaction
    return parsed.state && parsed.codeVerifier && parsed.nonce ? parsed : null
  } catch {
    return null
  }
}

export async function clearTransaction(): Promise<void> {
  ;(await cookies()).delete(TRANSACTION_COOKIE)
}

/**
 * Finish a sign-in: exchange the code and validate the ID token.
 *
 * `authorizationCodeGrant` checks the state, the PKCE verifier, and the ID
 * token's signature, issuer, audience, expiry and nonce. Claims are only read
 * after all of that passes.
 */
export async function completeOAuth(
  transaction: Transaction,
  currentUrl: URL,
): Promise<IdentityClaims | null> {
  const config = getProviderConfig(transaction.provider)
  if (!config) return null

  const discovered = await discover(config)

  const tokens = await client.authorizationCodeGrant(discovered, currentUrl, {
    pkceCodeVerifier: transaction.codeVerifier,
    expectedState: transaction.state,
    expectedNonce: transaction.nonce,
    idTokenExpected: true,
  })

  const claims = tokens.claims()
  if (!claims?.sub) return null

  return {
    subject: String(claims.sub),
    email: typeof claims.email === 'string' ? claims.email : undefined,
    emailVerified: claims.email_verified === true || claims.email_verified === 'true',
    name:
      typeof claims.name === 'string'
        ? claims.name
        : typeof claims.preferred_username === 'string'
          ? claims.preferred_username
          : undefined,
    picture: typeof claims.picture === 'string' ? claims.picture : undefined,
    tenantId: typeof claims.tid === 'string' ? claims.tid : undefined,
  }
}

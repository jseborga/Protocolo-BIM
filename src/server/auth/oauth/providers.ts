/**
 * Federated identity providers.
 *
 * Both Google and Microsoft Entra ID are OpenID Connect providers, so the flow
 * is the same for each: discovery, authorization code with PKCE, then an ID
 * token whose signature and nonce are verified before a single claim is read.
 */

import { appUrl } from '@/lib/app-url'

export type OAuthProviderId = 'google' | 'microsoft'

export interface OAuthProviderConfig {
  id: OAuthProviderId
  label: string
  issuer: string
  scope: string
  clientId: string
  clientSecret: string
  /** Extra parameters the provider needs on the authorization request. */
  authorizationParams?: Record<string, string>
}

/** Microsoft's tenant id for consumer (personal) Microsoft accounts. */
export const MICROSOFT_CONSUMER_TENANT = '9188040d-6c67-4c5b-b112-36a304b66dad'

function issuerFor(provider: OAuthProviderId): string {
  if (provider === 'google') return 'https://accounts.google.com'
  // `common` accepts both work/school and personal accounts; a single-tenant
  // deployment can pin its own tenant id instead.
  const tenant = process.env.MICROSOFT_TENANT_ID?.trim() || 'common'
  return `https://login.microsoftonline.com/${tenant}/v2.0`
}

/** Configuration for a provider, or null when it has not been set up. */
export function getProviderConfig(provider: OAuthProviderId): OAuthProviderConfig | null {
  const prefix = provider === 'google' ? 'GOOGLE' : 'MICROSOFT'
  const clientId = process.env[`${prefix}_CLIENT_ID`]?.trim()
  const clientSecret = process.env[`${prefix}_CLIENT_SECRET`]?.trim()
  if (!clientId || !clientSecret) return null

  return {
    id: provider,
    label: provider === 'google' ? 'Google' : 'Microsoft',
    issuer: issuerFor(provider),
    scope: 'openid email profile',
    clientId,
    clientSecret,
    authorizationParams:
      provider === 'google'
        ? // Ask for the account chooser rather than silently reusing whichever
          // Google session the browser happens to hold.
          { prompt: 'select_account' }
        : { prompt: 'select_account' },
  }
}

export function configuredProviders(): OAuthProviderId[] {
  return (['google', 'microsoft'] as const).filter((provider) => getProviderConfig(provider) !== null)
}

/** Where the provider sends the browser back to. */
export function callbackUrl(provider: OAuthProviderId): string {
  return `${appUrl()}/api/auth/${provider}/callback`
}

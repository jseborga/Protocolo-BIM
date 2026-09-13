export {
  callbackUrl,
  configuredProviders,
  getProviderConfig,
  MICROSOFT_CONSUMER_TENANT,
  type OAuthProviderConfig,
  type OAuthProviderId,
} from './providers'
export {
  decideLink,
  isEmailTrustworthy,
  type IdentityClaims,
  type LinkDecision,
  type LinkInput,
  type LinkRefusal,
} from './linking'
export { beginOAuth, clearTransaction, completeOAuth, readTransaction } from './flow'
export { signInWithProvider, type OAuthOutcome } from './signIn'

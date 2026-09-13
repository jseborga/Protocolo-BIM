import { getTranslations } from 'next-intl/server'
import { configuredProviders, type OAuthProviderId } from '@/server/auth/oauth/providers'

const LABELS: Record<OAuthProviderId, string> = { google: 'Google', microsoft: 'Microsoft' }

/** Brand marks, inlined so the buttons need no external requests. */
function ProviderMark({ provider }: { provider: OAuthProviderId }) {
  if (provider === 'google') {
    return (
      <svg viewBox="0 0 18 18" className="size-4" aria-hidden focusable="false">
        <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
        <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
        <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
        <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 18 18" className="size-4" aria-hidden focusable="false">
      <path fill="#F25022" d="M0 0h8.5v8.5H0z" />
      <path fill="#7FBA00" d="M9.5 0H18v8.5H9.5z" />
      <path fill="#00A4EF" d="M0 9.5h8.5V18H0z" />
      <path fill="#FFB900" d="M9.5 9.5H18V18H9.5z" />
    </svg>
  )
}

/**
 * Federated sign-in buttons. Only the providers this deployment has credentials
 * for are rendered, so a self-hosted install without them looks intentional
 * rather than broken.
 */
export async function ProviderButtons({
  locale,
  next,
}: {
  locale: string
  next?: string
}) {
  const providers = configuredProviders()
  if (providers.length === 0) return null

  const t = await getTranslations({ locale, namespace: 'auth' })
  const query = (provider: OAuthProviderId) => {
    const params = new URLSearchParams({ locale })
    if (next) params.set('next', next)
    return `/api/auth/${provider}/start?${params.toString()}`
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {providers.map((provider) => (
          <a key={provider} href={query(provider)} className="btn-secondary w-full">
            <ProviderMark provider={provider} />
            {t('continueWith', { provider: LABELS[provider] })}
          </a>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <span className="h-px flex-1 bg-[color:var(--border)]" />
        <span className="muted text-xs">{t('orWithEmail')}</span>
        <span className="h-px flex-1 bg-[color:var(--border)]" />
      </div>
    </div>
  )
}

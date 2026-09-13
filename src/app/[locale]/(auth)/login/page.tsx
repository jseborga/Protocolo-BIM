import { getTranslations } from 'next-intl/server'
import { Card } from '@/components/ui'
import { Link, redirect } from '@/i18n/navigation'
import type { AppLocale } from '@/i18n/locales'
import { getCurrentUser } from '@/server/auth'
import { loginAction, type AuthFormState } from '@/server/auth/actions'
import { safeNextPath } from '@/server/auth/redirects'
import { LoginForm } from './AuthForms'
import { ProviderButtons } from './ProviderButtons'

/** Maps a callback's `?error=` onto the message to show. */
const PROVIDER_ERRORS: Record<string, string> = {
  provider: 'errorProvider',
  state: 'errorState',
  cancelled: 'errorCancelled',
  exchange: 'errorExchange',
  email_not_verified: 'errorEmailNotVerified',
  no_email: 'errorNoEmail',
  account_disabled: 'errorAccountDisabled',
}

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ next?: string; error?: string }>
}) {
  const { locale } = await params
  const { next: requestedNext, error } = await searchParams
  const next = safeNextPath(requestedNext, '/projects')

  if (await getCurrentUser()) redirect({ href: next, locale })

  const t = await getTranslations({ locale, namespace: 'auth' })

  async function action(state: AuthFormState, formData: FormData) {
    'use server'
    return loginAction(locale as AppLocale, state, formData)
  }

  return (
    <Card>
      <h1 className="text-lg font-semibold">{t('loginTitle')}</h1>
      <p className="muted mb-5 mt-1 text-sm">{t('loginSubtitle')}</p>

      <div className="space-y-5">
        <ProviderButtons locale={locale} next={next} />
        <LoginForm
          action={action}
          next={next}
          providerError={error ? PROVIDER_ERRORS[error] : undefined}
        />
      </div>

      <p className="muted mt-5 text-center text-sm">
        {t('noAccount')}{' '}
        <Link
          href={{ pathname: '/register', query: next === '/projects' ? undefined : { next } }}
          className="text-brand-600 underline underline-offset-2"
        >
          {t('registerTitle')}
        </Link>
      </p>
    </Card>
  )
}

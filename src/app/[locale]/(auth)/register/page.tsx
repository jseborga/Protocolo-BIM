import { getTranslations } from 'next-intl/server'
import { Card } from '@/components/ui'
import { Link, redirect } from '@/i18n/navigation'
import type { AppLocale } from '@/i18n/locales'
import { getCurrentUser } from '@/server/auth'
import { registerAction, type AuthFormState } from '@/server/auth/actions'
import { safeNextPath } from '@/server/auth/redirects'
import { RegisterForm } from '../login/AuthForms'
import { ProviderButtons } from '../login/ProviderButtons'

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>
  searchParams: Promise<{ next?: string }>
}) {
  const { locale } = await params
  const { next: requestedNext } = await searchParams
  const next = safeNextPath(requestedNext, '/projects')

  if (await getCurrentUser()) redirect({ href: next, locale })

  const t = await getTranslations({ locale, namespace: 'auth' })

  async function action(state: AuthFormState, formData: FormData) {
    'use server'
    return registerAction(locale as AppLocale, state, formData)
  }

  return (
    <Card>
      <h1 className="text-lg font-semibold">{t('registerTitle')}</h1>
      <p className="muted mb-5 mt-1 text-sm">{t('registerSubtitle')}</p>

      <div className="space-y-5">
        <ProviderButtons locale={locale} next={next} />
        <RegisterForm action={action} next={next} />
      </div>

      <p className="muted mt-5 text-center text-sm">
        {t('hasAccount')}{' '}
        <Link
          href={{ pathname: '/login', query: next === '/projects' ? undefined : { next } }}
          className="text-brand-600 underline underline-offset-2"
        >
          {t('loginTitle')}
        </Link>
      </p>
    </Card>
  )
}

import { getTranslations } from 'next-intl/server'
import { Card } from '@/components/ui'
import { Link, redirect } from '@/i18n/navigation'
import type { AppLocale } from '@/i18n/routing'
import { getCurrentUser } from '@/server/auth'
import { registerAction, type AuthFormState } from '@/server/auth/actions'
import { RegisterForm } from '../login/AuthForms'

export default async function RegisterPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (await getCurrentUser()) redirect({ href: '/projects', locale })

  const t = await getTranslations({ locale, namespace: 'auth' })

  async function action(state: AuthFormState, formData: FormData) {
    'use server'
    return registerAction(locale as AppLocale, state, formData)
  }

  return (
    <Card>
      <h1 className="text-lg font-semibold">{t('registerTitle')}</h1>
      <p className="muted mb-5 mt-1 text-sm">{t('registerSubtitle')}</p>
      <RegisterForm action={action} />
      <p className="muted mt-5 text-center text-sm">
        {t('hasAccount')}{' '}
        <Link href="/login" className="text-brand-600 underline underline-offset-2">
          {t('loginTitle')}
        </Link>
      </p>
    </Card>
  )
}

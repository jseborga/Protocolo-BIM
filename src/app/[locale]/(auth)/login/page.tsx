import { getTranslations } from 'next-intl/server'
import { redirect } from '@/i18n/navigation'
import { Link } from '@/i18n/navigation'
import { Card } from '@/components/ui'
import type { AppLocale } from '@/i18n/routing'
import { getCurrentUser } from '@/server/auth'
import { loginAction, type AuthFormState } from '@/server/auth/actions'
import { LoginForm } from './AuthForms'

export default async function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  if (await getCurrentUser()) redirect({ href: '/projects', locale })

  const t = await getTranslations({ locale, namespace: 'auth' })

  async function action(state: AuthFormState, formData: FormData) {
    'use server'
    return loginAction(locale as AppLocale, state, formData)
  }

  return (
    <Card>
      <h1 className="text-lg font-semibold">{t('loginTitle')}</h1>
      <p className="muted mb-5 mt-1 text-sm">{t('loginSubtitle')}</p>
      <LoginForm action={action} />
      <p className="muted mt-5 text-center text-sm">
        {t('noAccount')}{' '}
        <Link href="/register" className="text-brand-600 underline underline-offset-2">
          {t('registerTitle')}
        </Link>
      </p>
    </Card>
  )
}

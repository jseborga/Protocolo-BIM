import { getTranslations } from 'next-intl/server'
import { Badge, Card } from '@/components/ui'
import { Link, redirect } from '@/i18n/navigation'
import type { AppLocale } from '@/i18n/locales'
import { getCurrentUser } from '@/server/auth'
import { logoutAction } from '@/server/auth/actions'
import { acceptInvitationAction, describeInvitation } from '@/server/team/invitations'
import { AcceptForm } from './AcceptForm'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ locale: string; token: string }>
}) {
  const { locale, token } = await params
  const appLocale = locale as AppLocale

  const t = await getTranslations({ locale, namespace: 'invite' })
  const common = await getTranslations({ locale, namespace: 'common' })
  const roles = await getTranslations({ locale, namespace: 'projectRole' })

  const invitation = await describeInvitation(token)

  if (!invitation) {
    return (
      <Card>
        <h1 className="text-lg font-semibold">{t('title')}</h1>
        <p className="muted mt-2 text-sm">{t('invalid')}</p>
      </Card>
    )
  }

  const user = await getCurrentUser()
  const next = `/invite/${token}`

  const summary = (
    <>
      <h1 className="text-lg font-semibold">{t('title')}</h1>
      <p className="muted mt-1 text-sm">{t('subtitle', { inviter: invitation.inviterName })}</p>

      <dl className="mt-5 space-y-3 rounded-lg border border-[color:var(--border)] p-4 text-sm">
        <div className="flex items-start justify-between gap-3">
          <dt className="muted text-xs uppercase tracking-wide">{common('name')}</dt>
          <dd className="text-right font-medium">
            <span className="font-mono text-xs text-brand-600">{invitation.projectCode}</span>{' '}
            {invitation.projectName}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="muted text-xs uppercase tracking-wide">{common('role')}</dt>
          <dd>
            <Badge tone="brand">{roles(invitation.role)}</Badge>
          </dd>
        </div>
        <div className="flex items-center justify-between gap-3">
          <dt className="muted text-xs uppercase tracking-wide">{common('email')}</dt>
          <dd className="text-xs">{invitation.email}</dd>
        </div>
      </dl>

      <p className="muted mt-4 text-xs">{t('onlyThisProject', { org: invitation.organisation })}</p>
    </>
  )

  if (!invitation.isUsable) {
    const reason = invitation.acceptedAt
      ? 'alreadyAccepted'
      : invitation.revokedAt
        ? 'invalid'
        : 'expired'
    return (
      <Card>
        {summary}
        <p className="mt-5 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
          {t(reason)}
        </p>
      </Card>
    )
  }

  if (!user) {
    return (
      <Card>
        {summary}
        <p className="muted mt-5 text-sm">{t('signInFirst')}</p>
        <div className="mt-3 space-y-2">
          <Link
            href={{ pathname: '/register', query: { next } }}
            className="btn-primary w-full"
          >
            {t('createAccountToAccept')}
          </Link>
          <Link href={{ pathname: '/login', query: { next } }} className="btn-secondary w-full">
            {t('signInToAccept')}
          </Link>
        </div>
      </Card>
    )
  }

  if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    async function signOut() {
      'use server'
      await logoutAction(appLocale)
    }

    return (
      <Card>
        {summary}
        <p className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {t('wrongAccount', { email: invitation.email })}
        </p>
        <form action={signOut} className="mt-3">
          <button type="submit" className="btn-secondary w-full">
            {common('logout')}
          </button>
        </form>
      </Card>
    )
  }

  async function accept() {
    'use server'
    const result = await acceptInvitationAction(appLocale, token)
    if (result.projectId) redirect({ href: `/p/${result.projectId}`, locale: appLocale })
    return result
  }

  return (
    <Card>
      {summary}
      <div className="mt-5">
        <AcceptForm onAccept={accept} />
      </div>
    </Card>
  )
}

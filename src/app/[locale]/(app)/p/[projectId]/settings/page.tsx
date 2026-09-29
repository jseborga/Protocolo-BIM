import { getTranslations } from 'next-intl/server'
import { Badge, EmptyState, PageHeader, SectionCard } from '@/components/ui'
import { appUrl } from '@/lib/app-url'
import { prisma } from '@/lib/prisma'
import { createApiTokenAction, revokeApiTokenAction, type TokenFormState } from '@/server/revit/tokenActions'
import { isTokenUsable } from '@/server/revit/tokens'
import { ApiTokenForm } from './ApiTokenForm'
import { type AppLocale, dbLocaleToApp } from '@/i18n/locales'
import { requireProjectAccess } from '@/server/authz'
import { updateProjectAction, type SettingsState } from '@/server/projects/settings'
import { SettingsForm } from './SettingsForm'

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>
}) {
  const { locale, projectId } = await params
  const access = await requireProjectAccess(projectId)
  const appLocale = locale as AppLocale

  const t = await getTranslations({ locale, namespace: 'settings' })
  const tokensT = await getTranslations({ locale, namespace: 'apiTokens' })
  const canManage = access.can('settings:manage')

  const tokens = canManage
    ? await prisma.apiToken.findMany({
        where: { projectId },
        include: { createdBy: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
      })
    : []

  const format = (value: Date | null) =>
    value ? new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value) : tokensT('never')

  async function createToken(state: TokenFormState, formData: FormData) {
    'use server'
    return createApiTokenAction(appLocale, projectId, state, formData)
  }

  async function save(state: SettingsState, formData: FormData) {
    'use server'
    return updateProjectAction(appLocale, projectId, state, formData)
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} />

      <SectionCard title={t('general')}>
        <SettingsForm
          action={save}
          readOnly={!access.can('settings:manage')}
          project={{
            name: access.project.name,
            description: access.project.description,
            status: access.project.status,
            visibility: access.project.visibility,
            country: access.project.country,
            city: access.project.city,
            address: access.project.address,
            baseLocale: dbLocaleToApp[access.project.baseLocale],
            enabledLocales: access.project.enabledLocales.map((entry) => dbLocaleToApp[entry]),
          }}
        />
      </SectionCard>

      {canManage ? (
        <SectionCard title={tokensT('title')} description={tokensT('hint')}>
          {tokens.length === 0 ? (
            <EmptyState>{tokensT('empty')}</EmptyState>
          ) : (
            <div className="mb-5 overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>{tokensT('name')}</th>
                    <th>{tokensT('scopes')}</th>
                    <th>{tokensT('created')}</th>
                    <th>{tokensT('lastUsed')}</th>
                    <th>{tokensT('expires')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token) => {
                    const usable = isTokenUsable(token)
                    return (
                      <tr key={token.id} className={usable ? '' : 'opacity-60'}>
                        <td>
                          <span className="font-medium">{token.name}</span>
                          <span className="muted ml-2 font-mono text-xs">pbim_{token.prefix}_…</span>
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1">
                            {token.scopes.map((scope) => (
                              <Badge key={scope} tone="slate">
                                {scope}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="muted text-xs">
                          {format(token.createdAt)} · {token.createdBy.name}
                        </td>
                        <td className="muted text-xs">{format(token.lastUsedAt)}</td>
                        <td className="muted text-xs">
                          {token.revokedAt ? (
                            <Badge tone="red">{tokensT('revoked')}</Badge>
                          ) : !usable ? (
                            <Badge tone="amber">{tokensT('expired')}</Badge>
                          ) : (
                            format(token.expiresAt)
                          )}
                        </td>
                        <td>
                          {usable ? (
                            <form
                              action={async () => {
                                'use server'
                                await revokeApiTokenAction(appLocale, projectId, token.id)
                              }}
                            >
                              <button type="submit" className="btn-ghost text-xs">
                                {tokensT('revoke')}
                              </button>
                            </form>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
          <ApiTokenForm action={createToken} serverUrl={appUrl()} />
        </SectionCard>
      ) : null}
    </div>
  )
}

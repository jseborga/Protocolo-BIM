import { getTranslations } from 'next-intl/server'
import { PageHeader, SectionCard } from '@/components/ui'
import { type AppLocale, dbLocaleToApp } from '@/i18n/routing'
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
            country: access.project.country,
            city: access.project.city,
            address: access.project.address,
            baseLocale: dbLocaleToApp[access.project.baseLocale],
            enabledLocales: access.project.enabledLocales.map((entry) => dbLocaleToApp[entry]),
          }}
        />
      </SectionCard>

      <SectionCard title={t('apiTokens')} description={t('apiTokensHint')}>
        <p className="muted text-sm">{t('apiTokensHint')}</p>
      </SectionCard>
    </div>
  )
}

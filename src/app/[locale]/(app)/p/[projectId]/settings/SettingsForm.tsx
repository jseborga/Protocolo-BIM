'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'
import { SubmitButton } from '@/components/SubmitButton'
import { FormError } from '@/components/ui'
import { localeNames, locales } from '@/i18n/routing'
import type { SettingsState } from '@/server/projects/settings'

export function SettingsForm({
  action,
  project,
  readOnly,
}: {
  action: (state: SettingsState, formData: FormData) => Promise<SettingsState>
  project: {
    name: string
    description: string | null
    status: 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'CLOSED'
    visibility: 'ORGANISATION' | 'MEMBERS_ONLY'
    country: string | null
    city: string | null
    address: string | null
    baseLocale: string
    enabledLocales: string[]
  }
  readOnly: boolean
}) {
  const t = useTranslations('projects')
  const settings = useTranslations('settings')
  const statuses = useTranslations('projectStatus')
  const common = useTranslations('common')
  const [state, formAction] = useActionState<SettingsState, FormData>(action, {})
  const [baseLocale, setBaseLocale] = useState(project.baseLocale)

  return (
    <form action={formAction} className="space-y-5">
      <FormError>{state.error ? t(state.error) : null}</FormError>

      <div>
        <label className="label" htmlFor="settings-name">
          {t('name')}
        </label>
        <input
          id="settings-name"
          name="name"
          required
          defaultValue={project.name}
          disabled={readOnly}
          className="field"
        />
      </div>

      <div>
        <label className="label" htmlFor="settings-description">
          {common('description')}
        </label>
        <textarea
          id="settings-description"
          name="description"
          rows={3}
          defaultValue={project.description ?? ''}
          disabled={readOnly}
          className="field"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <div>
          <label className="label" htmlFor="settings-status">
            {common('status')}
          </label>
          <select
            id="settings-status"
            name="status"
            defaultValue={project.status}
            disabled={readOnly}
            className="field"
          >
            {(['PLANNING', 'ACTIVE', 'ON_HOLD', 'CLOSED'] as const).map((status) => (
              <option key={status} value={status}>
                {statuses(status)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="settings-country">
            {t('country')}
          </label>
          <input
            id="settings-country"
            name="country"
            defaultValue={project.country ?? ''}
            disabled={readOnly}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="settings-city">
            {t('city')}
          </label>
          <input
            id="settings-city"
            name="city"
            defaultValue={project.city ?? ''}
            disabled={readOnly}
            className="field"
          />
        </div>
        <div>
          <label className="label" htmlFor="settings-address">
            {t('address')}
          </label>
          <input
            id="settings-address"
            name="address"
            defaultValue={project.address ?? ''}
            disabled={readOnly}
            className="field"
          />
        </div>
      </div>

      <div className="max-w-md">
        <label className="label" htmlFor="settings-visibility">
          {t('visibility')}
        </label>
        <select
          id="settings-visibility"
          name="visibility"
          defaultValue={project.visibility}
          disabled={readOnly}
          className="field"
        >
          {(['ORGANISATION', 'MEMBERS_ONLY'] as const).map((value) => (
            <option key={value} value={value}>
              {t(`visibility${value}`)}
            </option>
          ))}
        </select>
        <p className="muted mt-1 text-xs">{t('visibilityHint')}</p>
      </div>

      <fieldset className="rounded-lg border border-[color:var(--border)] p-4">
        <legend className="label mb-0 px-1">{settings('languages')}</legend>
        <p className="muted mb-3 text-xs">{settings('languagesHint')}</p>

        <div className="mb-4 max-w-xs">
          <label className="label" htmlFor="settings-base">
            {t('baseLocale')}
          </label>
          <select
            id="settings-base"
            name="baseLocale"
            className="field"
            value={baseLocale}
            disabled={readOnly}
            onChange={(event) => setBaseLocale(event.target.value)}
          >
            {locales.map((locale) => (
              <option key={locale} value={locale}>
                {localeNames[locale]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap gap-4">
          {locales.map((locale) => (
            <label key={locale} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="enabledLocales"
                value={locale}
                defaultChecked={project.enabledLocales.includes(locale)}
                disabled={readOnly || locale === baseLocale}
                className="size-4"
              />
              {localeNames[locale]}
            </label>
          ))}
        </div>
      </fieldset>

      {!readOnly ? (
        <div className="flex items-center gap-3">
          <SubmitButton pendingLabel={common('saving')}>{common('save')}</SubmitButton>
          {state.ok ? <span className="text-xs text-emerald-600">{common('saved')}</span> : null}
        </div>
      ) : null}
    </form>
  )
}

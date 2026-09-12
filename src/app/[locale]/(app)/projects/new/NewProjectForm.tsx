'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'
import { SubmitButton } from '@/components/SubmitButton'
import { FormError } from '@/components/ui'
import { localeNames, locales } from '@/i18n/routing'
import type { ProjectFormState } from '@/server/projects/actions'

export function NewProjectForm({
  action,
  organisations,
  defaultLocale,
}: {
  action: (state: ProjectFormState, formData: FormData) => Promise<ProjectFormState>
  organisations: Array<{ id: string; name: string }>
  defaultLocale: string
}) {
  const t = useTranslations('projects')
  const common = useTranslations('common')
  const client = useTranslations('client')
  const [state, formAction] = useActionState<ProjectFormState, FormData>(action, {})
  const [baseLocale, setBaseLocale] = useState(defaultLocale)

  return (
    <form action={formAction} className="space-y-5">
      <FormError>{state.error ? t(state.error) : null}</FormError>

      {organisations.length > 1 ? (
        <div>
          <label className="label" htmlFor="orgId">
            {common('name')}
          </label>
          <select id="orgId" name="orgId" className="field">
            {organisations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <input type="hidden" name="orgId" value={organisations[0]?.id ?? ''} />
      )}

      <div className="grid gap-4 sm:grid-cols-[10rem_1fr]">
        <div>
          <label className="label" htmlFor="code">
            {t('code')}
          </label>
          <input
            id="code"
            name="code"
            required
            maxLength={10}
            pattern="[A-Za-z0-9]{2,10}"
            className="field font-mono uppercase"
            placeholder="EDI"
          />
        </div>
        <div>
          <label className="label" htmlFor="name">
            {t('name')}
          </label>
          <input id="name" name="name" required minLength={3} className="field" />
        </div>
      </div>
      <p className="muted -mt-3 text-xs">{t('codeHint')}</p>

      <div>
        <label className="label" htmlFor="description">
          {common('description')}
        </label>
        <textarea id="description" name="description" rows={3} className="field" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="country">
            {t('country')}
          </label>
          <input id="country" name="country" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="city">
            {t('city')}
          </label>
          <input id="city" name="city" className="field" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="clientLegalName">
          {client('legalName')}
        </label>
        <input id="clientLegalName" name="clientLegalName" className="field" />
      </div>

      <fieldset className="rounded-lg border border-[color:var(--border)] p-4">
        <legend className="label mb-0 px-1">{t('enabledLocales')}</legend>
        <div className="mb-4">
          <label className="label" htmlFor="baseLocale">
            {t('baseLocale')}
          </label>
          <select
            id="baseLocale"
            name="baseLocale"
            className="field"
            value={baseLocale}
            onChange={(event) => setBaseLocale(event.target.value)}
          >
            {locales.map((locale) => (
              <option key={locale} value={locale}>
                {localeNames[locale]}
              </option>
            ))}
          </select>
          <p className="muted mt-1 text-xs">{t('baseLocaleHint')}</p>
        </div>

        <div className="flex flex-wrap gap-4">
          {locales.map((locale) => (
            <label key={locale} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name="enabledLocales"
                value={locale}
                defaultChecked
                disabled={locale === baseLocale}
                className="size-4 rounded border-[color:var(--border)]"
              />
              {localeNames[locale]}
              {locale === baseLocale ? <span className="muted text-xs">({common('required')})</span> : null}
            </label>
          ))}
        </div>
      </fieldset>

      <p className="muted text-xs">{t('createdFrom')}</p>

      <SubmitButton pendingLabel={common('loading')}>{t('new')}</SubmitButton>
    </form>
  )
}

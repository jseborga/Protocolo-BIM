'use client'

import { useTranslations } from 'next-intl'
import { useMemo, useState } from 'react'
import type { AppLocale } from '@/i18n/routing'
import {
  buildName,
  type CompiledConvention,
  type NamingError,
  validateName,
} from '@/server/naming'

function useErrorText(compiled: CompiledConvention, locale: AppLocale) {
  const t = useTranslations('namingError')

  return (error: NamingError): string => {
    const field = compiled.fields.find((entry) => entry.key === error.fieldKey)
    const fieldLabel = field ? (field.labels[locale] ?? field.key) : (error.fieldKey ?? '')
    return t(error.code, { ...(error.params ?? {}), field: fieldLabel })
  }
}

/**
 * Live validator. It runs the very same compiler the server and the Revit
 * add-in use, so what the browser says here is what the audit will say.
 */
export function NamingValidator({
  compiled,
  locale,
  initialValue = '',
}: {
  compiled: CompiledConvention
  locale: AppLocale
  initialValue?: string
}) {
  const t = useTranslations('naming')
  const describe = useErrorText(compiled, locale)
  const [value, setValue] = useState(initialValue)

  const result = useMemo(
    () => (value.trim() === '' ? null : validateName(compiled, value)),
    [compiled, value],
  )

  return (
    <div className="space-y-3">
      <input
        className="field font-mono"
        placeholder={t('validatorPlaceholder')}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        spellCheck={false}
        aria-label={t('validator')}
        data-testid="naming-validator-input"
      />

      {result ? (
        <>
          <p
            data-testid="naming-validator-result"
            className={`rounded-lg px-3 py-2 text-sm ${
              result.valid
                ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
                : 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200'
            }`}
          >
            {result.valid ? t('valid') : t('invalid')}
          </p>

          {result.segments.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th className="w-10" />
                    <th>{t('fieldKey')}</th>
                    <th>{t('generated')}</th>
                    <th>{t('invalid')}</th>
                  </tr>
                </thead>
                <tbody>
                  {result.segments.map((segment) => {
                    const field = compiled.fields[segment.fieldIndex]
                    return (
                      <tr key={segment.fieldKey}>
                        <td className="text-center">
                          <span
                            className={`inline-block size-2 rounded-full ${
                              segment.valid ? 'bg-emerald-500' : 'bg-red-500'
                            }`}
                          />
                        </td>
                        <td>
                          <span className="font-mono text-xs">{segment.fieldKey}</span>
                          <span className="muted ml-2 text-xs">{field?.labels[locale] ?? ''}</span>
                        </td>
                        <td className="font-mono text-xs">{segment.value || '—'}</td>
                        <td>
                          {segment.errors.length === 0 ? (
                            <span className="muted text-xs">—</span>
                          ) : (
                            <ul className="space-y-1 text-xs text-red-700 dark:text-red-300">
                              {segment.errors.map((error, index) => (
                                <li key={index}>{describe(error)}</li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="space-y-1 text-sm text-red-700 dark:text-red-300">
              {result.errors.map((error, index) => (
                <li key={index}>{describe(error)}</li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <p className="muted text-xs">{t('validatorHint')}</p>
      )}
    </div>
  )
}

/** Compose a name from the code tables instead of typing it by hand. */
export function NameBuilder({
  compiled,
  locale,
}: {
  compiled: CompiledConvention
  locale: AppLocale
}) {
  const t = useTranslations('naming')
  const common = useTranslations('common')
  const describe = useErrorText(compiled, locale)
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(compiled.fields.map((field) => [field.key, field.example ?? ''])),
  )

  const { name, result } = useMemo(() => buildName(compiled, values), [compiled, values])

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {compiled.fields.map((field) => (
          <div key={field.key}>
            <label className="label" htmlFor={`build-${field.key}`}>
              {field.labels[locale] ?? field.key}
              {!field.required ? <span className="muted"> ({common('optional')})</span> : null}
            </label>
            {field.allowedCodes ? (
              <select
                id={`build-${field.key}`}
                className="field font-mono text-sm"
                value={values[field.key] ?? ''}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.key]: event.target.value }))
                }
              >
                <option value="">—</option>
                {field.allowedCodes.map((code) => (
                  <option key={code} value={code}>
                    {code}
                    {field.codeLabels?.[code]?.[locale] ? ` · ${field.codeLabels[code]![locale]}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`build-${field.key}`}
                className="field font-mono text-sm"
                value={values[field.key] ?? ''}
                placeholder={field.example ?? ''}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field.key]: event.target.value }))
                }
              />
            )}
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-[color:var(--border)] bg-[color:var(--surface-sunken)] p-3">
        <p className="muted text-xs uppercase tracking-wide">{t('generated')}</p>
        <p className="mt-1 break-all font-mono text-sm font-medium" data-testid="built-name">
          {name || '—'}
        </p>
        {!result.valid && name ? (
          <ul className="mt-2 space-y-1 text-xs text-red-700 dark:text-red-300">
            {result.errors.map((error, index) => (
              <li key={index}>{describe(error)}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}

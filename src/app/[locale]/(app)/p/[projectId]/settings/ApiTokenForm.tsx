'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'
import { SubmitButton } from '@/components/SubmitButton'
import { FormError } from '@/components/ui'
import type { TokenFormState } from '@/server/revit/tokenActions'

export function ApiTokenForm({
  action,
  serverUrl,
}: {
  action: (state: TokenFormState, formData: FormData) => Promise<TokenFormState>
  serverUrl: string
}) {
  const t = useTranslations('apiTokens')
  const common = useTranslations('common')
  const [state, formAction] = useActionState<TokenFormState, FormData>(action, {})

  return (
    <div className="space-y-4">
      {state.token ? (
        <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100">
          <p className="font-medium">{t('shownOnce')}</p>
          <div>
            <p className="label !text-amber-900 dark:!text-amber-200">{t('serverUrl')}</p>
            <p
              data-testid="api-server-url"
              className="break-all rounded border border-amber-200 bg-white/80 p-2 font-mono text-xs dark:border-amber-900 dark:bg-black/30"
            >
              {serverUrl}
            </p>
          </div>
          <div>
            <p className="label !text-amber-900 dark:!text-amber-200">{t('token')}</p>
            <p
              data-testid="new-api-token"
              className="break-all rounded border border-amber-200 bg-white/80 p-2 font-mono text-xs dark:border-amber-900 dark:bg-black/30"
            >
              {state.token}
            </p>
            <CopyButton text={state.token} label={t('copy')} copiedLabel={t('copied')} />
          </div>
          <div className="space-y-2">
            <p className="label !text-amber-900 dark:!text-amber-200">{t('testCommand')}</p>
            {testCommands(serverUrl, state.token).map((command) => (
              <div key={command}>
                <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded border border-amber-200 bg-white/80 p-2 font-mono text-xs dark:border-amber-900 dark:bg-black/30">
                  {command}
                </pre>
                <CopyButton text={command} label={t('copyCommand')} copiedLabel={t('copied')} />
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <form action={formAction} className="space-y-3">
        <FormError>{state.error ? t(state.error) : null}</FormError>
        <div className="grid gap-3 sm:grid-cols-[1fr_12rem]">
          <div>
            <label className="label" htmlFor="token-name">
              {common('name')}
            </label>
            <input
              id="token-name"
              name="name"
              required
              minLength={2}
              maxLength={80}
              placeholder={t('namePlaceholder')}
              className="field"
            />
          </div>
          <div>
            <label className="label" htmlFor="token-expiry">
              {t('expires')}
            </label>
            <select id="token-expiry" name="expiresInDays" className="field" defaultValue="365">
              <option value="30">{t('days', { days: 30 })}</option>
              <option value="90">{t('days', { days: 90 })}</option>
              <option value="365">{t('days', { days: 365 })}</option>
              <option value="0">{t('never')}</option>
            </select>
          </div>
        </div>
        <fieldset className="flex flex-wrap gap-4">
          <legend className="label">{t('scopes')}</legend>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="scopes" value="standard:read" defaultChecked className="size-4" />
            {t('scopeStandard')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="scopes" value="audit:write" defaultChecked className="size-4" />
            {t('scopeAudit')}
          </label>
        </fieldset>
        <SubmitButton className="btn-secondary text-xs" pendingLabel={common('loading')}>
          {t('create')}
        </SubmitButton>
      </form>
      <p className="text-xs">
        <a href="/api/v1/openapi.json" target="_blank" rel="noreferrer" className="underline">
          {t('apiDocs')}
        </a>
      </p>
    </div>
  )
}

/** Ready-to-paste commands that call `/api/v1/connection` with the new key. */
function testCommands(serverUrl: string, token: string): string[] {
  const url = `${serverUrl}/api/v1/connection`
  return [
    `Invoke-RestMethod -Uri "${url}" -Headers @{ Authorization = "Bearer ${token}" }`,
    `curl -H "Authorization: Bearer ${token}" ${url}`,
  ]
}

function CopyButton({ text, label, copiedLabel }: { text: string; label: string; copiedLabel: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="btn-secondary mt-1 text-xs"
      onClick={async () => {
        await navigator.clipboard.writeText(text)
        setCopied(true)
      }}
    >
      {copied ? copiedLabel : label}
    </button>
  )
}

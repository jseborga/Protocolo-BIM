'use client'

import { useTranslations } from 'next-intl'
import { useActionState } from 'react'
import { FormError } from '@/components/ui'
import { SubmitButton } from '@/components/SubmitButton'
import type { AppLocale } from '@/i18n/routing'
import type { AuthFormState } from '@/server/auth/actions'

type Action = (state: AuthFormState, formData: FormData) => Promise<AuthFormState>

export function LoginForm({ action }: { action: Action }) {
  const t = useTranslations('auth')
  const common = useTranslations('common')
  const [state, formAction] = useActionState<AuthFormState, FormData>(action, {})

  return (
    <form action={formAction} className="space-y-4">
      <FormError>{state.error ? t(state.error) : null}</FormError>
      <div>
        <label className="label" htmlFor="email">
          {common('email')}
        </label>
        <input id="email" name="email" type="email" autoComplete="email" required className="field" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          {common('password')}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="field"
        />
      </div>
      <SubmitButton className="btn-primary w-full" pendingLabel={common('loading')}>
        {t('submitLogin')}
      </SubmitButton>
    </form>
  )
}

export function RegisterForm({ action }: { action: Action }) {
  const t = useTranslations('auth')
  const common = useTranslations('common')
  const [state, formAction] = useActionState<AuthFormState, FormData>(action, {})

  return (
    <form action={formAction} className="space-y-4">
      <FormError>{state.error ? t(state.error) : null}</FormError>
      <div>
        <label className="label" htmlFor="name">
          {t('fullName')}
        </label>
        <input id="name" name="name" required className="field" autoComplete="name" />
      </div>
      <div>
        <label className="label" htmlFor="orgName">
          {t('orgName')}
        </label>
        <input id="orgName" name="orgName" required className="field" autoComplete="organization" />
      </div>
      <div>
        <label className="label" htmlFor="email">
          {common('email')}
        </label>
        <input id="email" name="email" type="email" required className="field" autoComplete="email" />
      </div>
      <div>
        <label className="label" htmlFor="password">
          {common('password')}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={8}
          className="field"
          autoComplete="new-password"
        />
      </div>
      <SubmitButton className="btn-primary w-full" pendingLabel={common('loading')}>
        {t('submitRegister')}
      </SubmitButton>
    </form>
  )
}

export type { AppLocale }

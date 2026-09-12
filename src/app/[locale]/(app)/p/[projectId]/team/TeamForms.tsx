'use client'

import { useTranslations } from 'next-intl'
import { useActionState } from 'react'
import { SubmitButton } from '@/components/SubmitButton'
import { FormError } from '@/components/ui'
import type { TeamActionState } from '@/server/team/actions'

type Action = (state: TeamActionState, formData: FormData) => Promise<TeamActionState>

export interface Option {
  id: string
  label: string
}

const ROLES = [
  'INFORMATION_MANAGER',
  'BIM_MANAGER',
  'BIM_COORDINATOR',
  'BIM_MODELLER',
  'REVIEWER',
  'CLIENT',
  'VIEWER',
] as const

export function AddMemberForm({
  action,
  disciplines,
  parties,
}: {
  action: Action
  disciplines: Option[]
  parties: Option[]
}) {
  const t = useTranslations('team')
  const roles = useTranslations('projectRole')
  const common = useTranslations('common')
  const [state, formAction] = useActionState<TeamActionState, FormData>(action, {})

  return (
    <form action={formAction} className="space-y-3">
      <FormError>{state.error ? t(state.error) : null}</FormError>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="member-email">
            {t('memberEmail')}
          </label>
          <input id="member-email" name="email" type="email" required className="field" />
        </div>
        <div>
          <label className="label" htmlFor="member-role">
            {common('role')}
          </label>
          <select id="member-role" name="role" className="field" defaultValue="BIM_MODELLER">
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {roles(role)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="member-discipline">
            {common('discipline')}
          </label>
          <select id="member-discipline" name="disciplineId" className="field">
            <option value="">{common('none')}</option>
            {disciplines.map((discipline) => (
              <option key={discipline.id} value={discipline.id}>
                {discipline.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="member-party">
            {t('parties')}
          </label>
          <select id="member-party" name="partyId" className="field">
            <option value="">{common('none')}</option>
            {parties.map((party) => (
              <option key={party.id} value={party.id}>
                {party.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <SubmitButton className="btn-secondary text-xs">{t('addMember')}</SubmitButton>
    </form>
  )
}

export function AddPartyForm({
  action,
  disciplines,
}: {
  action: Action
  disciplines: Option[]
}) {
  const t = useTranslations('team')
  const types = useTranslations('partyType')
  const common = useTranslations('common')
  const [state, formAction] = useActionState<TeamActionState, FormData>(action, {})

  return (
    <form action={formAction} className="space-y-3">
      <FormError>{state.error ? t(state.error) : null}</FormError>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="lg:col-span-2">
          <label className="label" htmlFor="party-name">
            {common('name')}
          </label>
          <input id="party-name" name="name" required className="field" />
        </div>
        <div>
          <label className="label" htmlFor="party-type">
            {common('role')}
          </label>
          <select id="party-type" name="type" className="field" defaultValue="APPOINTED">
            {(['APPOINTING', 'LEAD_APPOINTED', 'APPOINTED'] as const).map((type) => (
              <option key={type} value={type}>
                {types(type)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="party-code">
            {common('code')}
          </label>
          <input
            id="party-code"
            name="code"
            pattern="[A-Za-z0-9]{2,6}"
            className="field font-mono uppercase"
            placeholder="JSE"
          />
        </div>
        <div>
          <label className="label" htmlFor="party-discipline">
            {common('discipline')}
          </label>
          <select id="party-discipline" name="disciplineId" className="field">
            <option value="">{common('none')}</option>
            {disciplines.map((discipline) => (
              <option key={discipline.id} value={discipline.id}>
                {discipline.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <SubmitButton className="btn-secondary text-xs">{t('addParty')}</SubmitButton>
    </form>
  )
}

export function AddSoftwareForm({
  action,
  disciplines,
}: {
  action: Action
  disciplines: Option[]
}) {
  const t = useTranslations('team')
  const common = useTranslations('common')
  const [state, formAction] = useActionState<TeamActionState, FormData>(action, {})

  return (
    <form action={formAction} className="space-y-3">
      <FormError>{state.error ? t(state.error) : null}</FormError>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <div className="lg:col-span-2">
          <label className="label" htmlFor="software-name">
            {common('name')}
          </label>
          <input id="software-name" name="name" required className="field" />
        </div>
        <div>
          <label className="label" htmlFor="software-version">
            {t('softwareVersion')}
          </label>
          <input id="software-version" name="version" className="field" />
        </div>
        <div>
          <label className="label" htmlFor="software-discipline">
            {common('discipline')}
          </label>
          <select id="software-discipline" name="disciplineId" className="field">
            <option value="">{common('none')}</option>
            {disciplines.map((discipline) => (
              <option key={discipline.id} value={discipline.id}>
                {discipline.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="software-native">
            {t('nativeFormat')}
          </label>
          <input id="software-native" name="nativeFormat" className="field" placeholder="RVT" />
        </div>
        <div>
          <label className="label" htmlFor="software-exchange">
            {t('exchangeFormat')}
          </label>
          <input id="software-exchange" name="exchangeFormat" className="field" placeholder="IFC 4" />
        </div>
      </div>
      <div>
        <label className="label" htmlFor="software-purpose">
          {t('purpose')}
        </label>
        <input id="software-purpose" name="purpose" className="field" />
      </div>
      <SubmitButton className="btn-secondary text-xs">{t('addSoftware')}</SubmitButton>
    </form>
  )
}

export function RaciMatrix({
  action,
  activities,
  assignments,
  readOnly,
}: {
  action: Action
  activities: Array<{ id: string; label: string }>
  assignments: Record<string, string>
  readOnly: boolean
}) {
  const t = useTranslations('team')
  const roles = useTranslations('projectRole')
  const common = useTranslations('common')
  const [state, formAction] = useActionState<TeamActionState, FormData>(action, {})

  const shown = ROLES.filter((role) => role !== 'VIEWER')

  return (
    <form action={formAction} className="space-y-3">
      <FormError>{state.error ? t(state.error) : null}</FormError>
      <div className="overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="min-w-[16rem]">{t('activity')}</th>
              {shown.map((role) => (
                <th key={role} className="text-center">
                  {roles(role)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activities.map((activity) => (
              <tr key={activity.id}>
                <td className="text-sm">{activity.label}</td>
                {shown.map((role) => {
                  const name = `raci:${activity.id}:${role}`
                  const value = assignments[name] ?? ''
                  return (
                    <td key={role} className="text-center">
                      {readOnly ? (
                        <span className="font-mono text-sm">{value || '—'}</span>
                      ) : (
                        <select
                          name={name}
                          defaultValue={value}
                          aria-label={`${activity.label} — ${roles(role)}`}
                          className="field w-16 px-1 py-1 text-center font-mono text-sm"
                        >
                          <option value="">—</option>
                          {(['R', 'A', 'C', 'I'] as const).map((letter) => (
                            <option key={letter} value={letter}>
                              {letter}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!readOnly ? (
        <div className="flex items-center gap-3">
          <SubmitButton className="btn-secondary text-xs" pendingLabel={common('saving')}>
            {common('save')}
          </SubmitButton>
          {state.ok ? <span className="text-xs text-emerald-600">{common('saved')}</span> : null}
        </div>
      ) : null}
    </form>
  )
}

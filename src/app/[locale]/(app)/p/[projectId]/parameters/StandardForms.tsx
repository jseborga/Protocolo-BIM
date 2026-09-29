'use client'

import { useTranslations } from 'next-intl'
import { useActionState } from 'react'
import { SubmitButton } from '@/components/SubmitButton'
import { FormError } from '@/components/ui'
import type { StandardFormState } from '@/server/revit/standardActions'

type Action = (state: StandardFormState, formData: FormData) => Promise<StandardFormState>

export interface Choice {
  id: string
  label: string
}

export interface CategoryChoice extends Choice {
  group: string
}

function NamingDetails({ state }: { state: StandardFormState }) {
  if (!state.details?.length) return null
  return (
    <ul className="space-y-1 text-xs text-red-700 dark:text-red-300" data-testid="naming-details">
      {state.details.map((line, index) => (
        <li key={index}>{line}</li>
      ))}
    </ul>
  )
}

export function AddParameterForm({
  action,
  groups,
  dataTypes,
  paletteGroups,
  categories,
  categoryGroups,
}: {
  action: Action
  groups: string[]
  dataTypes: Choice[]
  paletteGroups: Choice[]
  categories: CategoryChoice[]
  categoryGroups: Choice[]
}) {
  const t = useTranslations('parameters')
  const common = useTranslations('common')
  const [state, formAction] = useActionState<StandardFormState, FormData>(action, {})

  return (
    <form action={formAction} className="space-y-4">
      <FormError>{state.error ? t(state.error) : null}</FormError>
      <NamingDetails state={state} />
      {state.ok ? <p className="text-xs text-emerald-600">{common('saved')}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="lg:col-span-2">
          <label className="label" htmlFor="parameter-name">
            {common('name')}
          </label>
          <input
            id="parameter-name"
            name="name"
            required
            className="field font-mono text-sm"
            placeholder="GEN_NombreParametro"
          />
          <p className="muted mt-1 text-xs">{t('nameHint')}</p>
        </div>
        <div>
          <label className="label" htmlFor="parameter-group">
            {t('group')}
          </label>
          <input
            id="parameter-group"
            name="group"
            required
            list="parameter-groups"
            className="field"
            defaultValue={groups[0] ?? ''}
          />
          <datalist id="parameter-groups">
            {groups.map((group) => (
              <option key={group} value={group} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="label" htmlFor="parameter-type">
            {t('dataType')}
          </label>
          <select id="parameter-type" name="dataType" className="field" defaultValue="TEXT">
            {dataTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="parameter-palette">
            {t('paletteGroup')}
          </label>
          <select id="parameter-palette" name="paletteGroup" className="field" defaultValue="IDENTITY_DATA">
            {paletteGroups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.label}
              </option>
            ))}
          </select>
        </div>
        <fieldset>
          <legend className="label">{t('binding')}</legend>
          <div className="flex gap-4 pt-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" name="binding" value="INSTANCE" defaultChecked className="size-4" />
              {t('instance')}
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="binding" value="TYPE" className="size-4" />
              {t('type')}
            </label>
          </div>
        </fieldset>
        <div>
          <label className="label" htmlFor="parameter-pset">
            {t('ifcPset')}
          </label>
          <input id="parameter-pset" name="ifcPset" className="field font-mono text-xs" placeholder="Pset_ProtocoloBIM" />
        </div>
        <div>
          <label className="label" htmlFor="parameter-property">
            {t('ifcProperty')}
          </label>
          <input id="parameter-property" name="ifcProperty" className="field font-mono text-xs" />
        </div>
      </div>

      <div>
        <label className="label" htmlFor="parameter-description">
          {common('description')}
        </label>
        <input id="parameter-description" name="description" maxLength={500} className="field" />
      </div>

      <fieldset>
        <legend className="label">{t('categories')}</legend>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {categoryGroups.map((group) => (
            <div key={group.id}>
              <p className="muted mb-1 text-xs font-semibold uppercase tracking-wide">{group.label}</p>
              <div className="space-y-1">
                {categories
                  .filter((category) => category.group === group.id)
                  .map((category) => (
                    <label key={category.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="categories" value={category.id} className="size-4" />
                      {category.label}
                    </label>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="required" defaultChecked className="size-4" />
        {t('requiredHint')}
      </label>

      <SubmitButton className="btn-secondary text-xs" pendingLabel={common('saving')}>
        {t('add')}
      </SubmitButton>
    </form>
  )
}

export function AddWorksetForm({ action, disciplines }: { action: Action; disciplines: Choice[] }) {
  const t = useTranslations('parameters')
  const common = useTranslations('common')
  const [state, formAction] = useActionState<StandardFormState, FormData>(action, {})

  return (
    <form action={formAction} className="space-y-3">
      <FormError>{state.error ? t(state.error) : null}</FormError>
      <NamingDetails state={state} />
      <div className="grid gap-3 sm:grid-cols-[1fr_12rem_1fr]">
        <div>
          <label className="label" htmlFor="workset-name">
            {common('name')}
          </label>
          <input id="workset-name" name="name" required className="field text-sm" placeholder="ARC_Torre A_Fachada" />
        </div>
        <div>
          <label className="label" htmlFor="workset-discipline">
            {common('discipline')}
          </label>
          <select id="workset-discipline" name="disciplineId" className="field">
            <option value="">{common('none')}</option>
            {disciplines.map((discipline) => (
              <option key={discipline.id} value={discipline.id}>
                {discipline.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="workset-description">
            {common('description')}
          </label>
          <input id="workset-description" name="description" maxLength={300} className="field" />
        </div>
      </div>
      <SubmitButton className="btn-secondary text-xs" pendingLabel={common('saving')}>
        {t('addWorkset')}
      </SubmitButton>
    </form>
  )
}

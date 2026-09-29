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

/** Form values as submitted: `required` is present only when ticked. */
export type ParameterValues = Record<string, string | string[]>

export function ParameterForm({
  action,
  groups,
  dataTypes,
  paletteGroups,
  categories,
  categoryGroups,
  initial,
  submitLabel,
  idPrefix = 'parameter',
}: {
  action: Action
  groups: string[]
  dataTypes: Choice[]
  paletteGroups: Choice[]
  categories: CategoryChoice[]
  categoryGroups: Choice[]
  /** Set when editing: the name is then fixed, since it identifies the parameter. */
  initial?: ParameterValues
  submitLabel: string
  /** Keeps element ids unique when the add and edit forms share a page. */
  idPrefix?: string
}) {
  const t = useTranslations('parameters')
  const common = useTranslations('common')
  const [state, formAction] = useActionState<StandardFormState, FormData>(action, {})
  // A rejected submission comes back with what was typed; otherwise start
  // from the parameter being edited, or blank.
  const values = state.values ?? initial
  const text = (key: string, fallback = '') => {
    const value = values?.[key]
    return typeof value === 'string' ? value : fallback
  }
  const chosen = new Set(Array.isArray(values?.categories) ? values.categories : [])
  const editing = Boolean(initial)

  return (
    <form action={formAction} className="space-y-4">
      <FormError>{state.error ? t(state.error) : null}</FormError>
      <NamingDetails state={state} />
      {state.ok ? <p className="text-xs text-emerald-600">{common('saved')}</p> : null}

      {/* Remounted on every answer so the defaults below take effect. */}
      <div key={state.submission ?? 0} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="label" htmlFor={`${idPrefix}-name`}>
              {common('name')}
            </label>
            <input
              id={`${idPrefix}-name`}
              name="name"
              required
              readOnly={editing}
              className={`field font-mono text-sm${editing ? ' opacity-70' : ''}`}
              placeholder="GEN_NombreParametro"
              defaultValue={text('name')}
            />
            <p className="muted mt-1 text-xs">{editing ? t('nameFixed') : t('nameHint')}</p>
          </div>
          <div>
            <label className="label" htmlFor={`${idPrefix}-group`}>
              {t('group')}
            </label>
            <input
              id={`${idPrefix}-group`}
              name="group"
              required
              list={`${idPrefix}-groups`}
              className="field"
              defaultValue={text('group', groups[0] ?? '')}
            />
            <datalist id={`${idPrefix}-groups`}>
              {groups.map((group) => (
                <option key={group} value={group} />
              ))}
            </datalist>
          </div>
          <div>
            <label className="label" htmlFor={`${idPrefix}-type`}>
              {t('dataType')}
            </label>
            <select id={`${idPrefix}-type`} name="dataType" className="field" defaultValue={text('dataType', 'TEXT')}>
              {dataTypes.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor={`${idPrefix}-palette`}>
              {t('paletteGroup')}
            </label>
            <select
              id={`${idPrefix}-palette`}
              name="paletteGroup"
              className="field"
              defaultValue={text('paletteGroup', 'IDENTITY_DATA')}
            >
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
                <input
                  type="radio"
                  name="binding"
                  value="INSTANCE"
                  defaultChecked={text('binding', 'INSTANCE') !== 'TYPE'}
                  className="size-4"
                />
                {t('instance')}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="binding"
                  value="TYPE"
                  defaultChecked={text('binding') === 'TYPE'}
                  className="size-4"
                />
                {t('type')}
              </label>
            </div>
          </fieldset>
          <div>
            <label className="label" htmlFor={`${idPrefix}-pset`}>
              {t('ifcPset')}
            </label>
            <input
              id={`${idPrefix}-pset`}
              name="ifcPset"
              className="field font-mono text-xs"
              placeholder="Pset_ProtocoloBIM"
              defaultValue={text('ifcPset')}
            />
          </div>
          <div>
            <label className="label" htmlFor={`${idPrefix}-property`}>
              {t('ifcProperty')}
            </label>
            <input
              id={`${idPrefix}-property`}
              name="ifcProperty"
              className="field font-mono text-xs"
              defaultValue={text('ifcProperty')}
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor={`${idPrefix}-description`}>
            {common('description')}
          </label>
          <input
            id={`${idPrefix}-description`}
            name="description"
            maxLength={500}
            className="field"
            defaultValue={text('description')}
          />
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
                        <input
                          type="checkbox"
                          name="categories"
                          value={category.id}
                          defaultChecked={chosen.has(category.id)}
                          className="size-4"
                        />
                        {category.label}
                      </label>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </fieldset>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="required"
            defaultChecked={values ? 'required' in values : true}
            className="size-4"
          />
          {t('requiredHint')}
        </label>
      </div>

      <SubmitButton className="btn-secondary text-xs" pendingLabel={common('saving')}>
        {submitLabel}
      </SubmitButton>
    </form>
  )
}

export function AddWorksetForm({ action, disciplines }: { action: Action; disciplines: Choice[] }) {
  const t = useTranslations('parameters')
  const common = useTranslations('common')
  const [state, formAction] = useActionState<StandardFormState, FormData>(action, {})
  const text = (key: string) => {
    const value = state.values?.[key]
    return typeof value === 'string' ? value : ''
  }

  return (
    <form action={formAction} className="space-y-3">
      <FormError>{state.error ? t(state.error) : null}</FormError>
      <NamingDetails state={state} />
      <div key={state.submission ?? 0} className="grid gap-3 sm:grid-cols-[1fr_12rem_1fr]">
        <div>
          <label className="label" htmlFor="workset-name">
            {common('name')}
          </label>
          <input
            id="workset-name"
            name="name"
            required
            className="field text-sm"
            placeholder="ARC_Torre A_Fachada"
            defaultValue={text('name')}
          />
        </div>
        <div>
          <label className="label" htmlFor="workset-discipline">
            {common('discipline')}
          </label>
          <select id="workset-discipline" name="disciplineId" className="field" defaultValue={text('disciplineId')}>
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
          <input
            id="workset-description"
            name="description"
            maxLength={300}
            className="field"
            defaultValue={text('description')}
          />
        </div>
      </div>
      <SubmitButton className="btn-secondary text-xs" pendingLabel={common('saving')}>
        {t('addWorkset')}
      </SubmitButton>
    </form>
  )
}

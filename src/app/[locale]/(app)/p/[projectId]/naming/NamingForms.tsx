'use client'

import { useTranslations } from 'next-intl'
import { useActionState, useState } from 'react'
import { SubmitButton } from '@/components/SubmitButton'
import { FormError } from '@/components/ui'
import type { NamingActionState } from '@/server/naming/actions'

type Action = (state: NamingActionState, formData: FormData) => Promise<NamingActionState>

const TARGETS = [
  'FILE',
  'MODEL',
  'SHEET',
  'VIEW',
  'FOLDER',
  'FAMILY',
  'TYPE',
  'PARAMETER',
  'WORKSET',
  'LEVEL',
  'GRID',
] as const

function useError() {
  const t = useTranslations('naming')
  return (state: NamingActionState) =>
    state.error ? t(state.error, { count: state.detail ?? '', message: state.detail ?? '' }) : null
}

export function CreateConventionForm({ action }: { action: Action }) {
  const t = useTranslations('naming')
  const targets = useTranslations('namingTarget')
  const caseRules = useTranslations('caseRule')
  const common = useTranslations('common')
  const [state, formAction] = useActionState<NamingActionState, FormData>(action, {})
  const describe = useError()

  return (
    <form action={formAction} className="space-y-3">
      <FormError>{describe(state)}</FormError>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="convention-key">
            {t('fieldKey')}
          </label>
          <input
            id="convention-key"
            name="key"
            required
            pattern="[A-Za-z0-9_]{2,24}"
            className="field font-mono uppercase"
            placeholder="MODEL"
          />
        </div>
        <div>
          <label className="label" htmlFor="convention-label">
            {common('name')}
          </label>
          <input id="convention-label" name="label" required className="field" />
        </div>
        <div>
          <label className="label" htmlFor="convention-target">
            {t('target')}
          </label>
          <select id="convention-target" name="target" className="field">
            {TARGETS.map((target) => (
              <option key={target} value={target}>
                {targets(target)}
              </option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="label" htmlFor="convention-separator">
              {t('separator')}
            </label>
            <input
              id="convention-separator"
              name="separator"
              defaultValue="-"
              maxLength={3}
              className="field text-center font-mono"
            />
          </div>
          <div>
            <label className="label" htmlFor="convention-case">
              {t('caseRule')}
            </label>
            <select id="convention-case" name="caseRule" className="field" defaultValue="UPPER">
              {(['ANY', 'UPPER', 'LOWER'] as const).map((rule) => (
                <option key={rule} value={rule}>
                  {caseRules(rule)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="convention-max">
              {t('maxLength')}
            </label>
            <input
              id="convention-max"
              name="maxLength"
              type="number"
              min={1}
              max={500}
              className="field"
            />
          </div>
        </div>
      </div>
      <SubmitButton pendingLabel={common('loading')}>{t('newConvention')}</SubmitButton>
    </form>
  )
}

export function AddFieldForm({
  action,
  codeTables,
}: {
  action: Action
  codeTables: Array<{ id: string; key: string; label: string }>
}) {
  const t = useTranslations('naming')
  const sources = useTranslations('fieldSource')
  const common = useTranslations('common')
  const [state, formAction] = useActionState<NamingActionState, FormData>(action, {})
  const [source, setSource] = useState<'CODE_TABLE' | 'FREE_TEXT' | 'NUMERIC' | 'DATE' | 'REGEX'>(
    'CODE_TABLE',
  )
  const describe = useError()

  return (
    <form action={formAction} className="space-y-3">
      <FormError>{describe(state)}</FormError>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="label" htmlFor="field-key">
            {t('fieldKey')}
          </label>
          <input
            id="field-key"
            name="key"
            required
            pattern="[A-Za-z0-9_]{1,16}"
            className="field font-mono uppercase"
          />
        </div>
        <div>
          <label className="label" htmlFor="field-label">
            {common('name')}
          </label>
          <input id="field-label" name="label" required className="field" />
        </div>
        <div>
          <label className="label" htmlFor="field-source">
            {t('fieldSource')}
          </label>
          <select
            id="field-source"
            name="source"
            className="field"
            value={source}
            onChange={(event) => setSource(event.target.value as typeof source)}
          >
            {(['CODE_TABLE', 'FREE_TEXT', 'NUMERIC', 'DATE', 'REGEX'] as const).map((entry) => (
              <option key={entry} value={entry}>
                {sources(entry)}
              </option>
            ))}
          </select>
        </div>

        {source === 'CODE_TABLE' ? (
          <div>
            <label className="label" htmlFor="field-table">
              {t('codeTable')}
            </label>
            <select id="field-table" name="codeTableId" className="field" required>
              {codeTables.map((table) => (
                <option key={table.id} value={table.id}>
                  {table.key} · {table.label}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {source === 'REGEX' ? (
          <div>
            <label className="label" htmlFor="field-pattern">
              {t('regexPattern')}
            </label>
            <input
              id="field-pattern"
              name="pattern"
              className="field font-mono text-xs"
              placeholder="[A-Z]{3}"
              required
            />
          </div>
        ) : null}

        {source === 'DATE' ? (
          <div>
            <label className="label" htmlFor="field-date">
              {t('dateFormat')}
            </label>
            <input
              id="field-date"
              name="dateFormat"
              className="field font-mono text-xs"
              defaultValue="YYYYMMDD"
            />
          </div>
        ) : null}

        {source === 'FREE_TEXT' || source === 'NUMERIC' ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label" htmlFor="field-min">
                {t('minLength')}
              </label>
              <input id="field-min" name="minLength" type="number" min={1} className="field" />
            </div>
            <div>
              <label className="label" htmlFor="field-max">
                {t('maxFieldLength')}
              </label>
              <input id="field-max" name="maxLength" type="number" min={1} className="field" />
            </div>
          </div>
        ) : null}

        <div>
          <label className="label" htmlFor="field-example">
            {common('example')}
          </label>
          <input id="field-example" name="example" className="field font-mono text-xs" />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="required" defaultChecked className="size-4" />
        {common('required')}
      </label>

      <SubmitButton className="btn-secondary text-xs" pendingLabel={common('loading')}>
        {t('addField')}
      </SubmitButton>
    </form>
  )
}

export function AddExampleForm({ action }: { action: Action }) {
  const t = useTranslations('naming')
  const common = useTranslations('common')
  const [state, formAction] = useActionState<NamingActionState, FormData>(action, {})
  const describe = useError()

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <FormError>{describe(state)}</FormError>
      <div className="min-w-[16rem] flex-1">
        <label className="label" htmlFor="example-sample">
          {common('example')}
        </label>
        <input id="example-sample" name="sample" required className="field font-mono text-sm" />
      </div>
      <div>
        <label className="label" htmlFor="example-expect">
          {t('expectValid')}
        </label>
        <select id="example-expect" name="shouldBeValid" className="field" defaultValue="true">
          <option value="true">{t('expectValid')}</option>
          <option value="false">{t('expectInvalid')}</option>
        </select>
      </div>
      <SubmitButton className="btn-secondary text-xs">{t('addExample')}</SubmitButton>
    </form>
  )
}

export function CreateCodeTableForm({ action }: { action: Action }) {
  const t = useTranslations('naming')
  const common = useTranslations('common')
  const [state, formAction] = useActionState<NamingActionState, FormData>(action, {})
  const describe = useError()

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <FormError>{describe(state)}</FormError>
      <div>
        <label className="label" htmlFor="table-key">
          {common('code')}
        </label>
        <input
          id="table-key"
          name="key"
          required
          pattern="[A-Za-z0-9_]{2,24}"
          className="field w-40 font-mono uppercase"
        />
      </div>
      <div className="min-w-[12rem] flex-1">
        <label className="label" htmlFor="table-label">
          {common('name')}
        </label>
        <input id="table-label" name="label" required className="field" />
      </div>
      <SubmitButton className="btn-secondary text-xs">{t('newCodeTable')}</SubmitButton>
    </form>
  )
}

export function AddCodeValueForm({ action, tableId }: { action: Action; tableId: string }) {
  const t = useTranslations('naming')
  const common = useTranslations('common')
  const [state, formAction] = useActionState<NamingActionState, FormData>(action, {})
  const describe = useError()

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="tableId" value={tableId} />
      <FormError>{describe(state)}</FormError>
      <input
        name="code"
        required
        maxLength={40}
        placeholder={common('code')}
        aria-label={common('code')}
        className="field w-28 font-mono text-sm"
      />
      <input
        name="label"
        maxLength={120}
        placeholder={common('description')}
        aria-label={common('description')}
        className="field w-48 text-sm"
      />
      <SubmitButton className="btn-ghost text-xs">{t('addValue')}</SubmitButton>
    </form>
  )
}

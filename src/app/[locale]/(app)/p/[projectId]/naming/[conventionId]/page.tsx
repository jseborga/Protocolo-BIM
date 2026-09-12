import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Badge, EmptyState, Mono, PageHeader, SectionCard } from '@/components/ui'
import { Link } from '@/i18n/navigation'
import type { AppLocale } from '@/i18n/routing'
import { localized } from '@/lib/localized'
import { prisma } from '@/lib/prisma'
import { requireProjectAccess } from '@/server/authz'
import { checkExamples } from '@/server/naming'
import {
  addExampleAction,
  addFieldAction,
  deleteExampleAction,
  deleteFieldAction,
  toggleConventionAction,
  type NamingActionState,
} from '@/server/naming/actions'
import { loadConvention } from '@/server/naming/repository'
import { AddExampleForm, AddFieldForm } from '../NamingForms'
import { NameBuilder, NamingValidator } from '../NamingValidator'
import { ToggleActive } from './ToggleActive'

export default async function ConventionPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string; conventionId: string }>
}) {
  const { locale, projectId, conventionId } = await params
  const access = await requireProjectAccess(projectId)
  const appLocale = locale as AppLocale

  const loaded = await loadConvention(projectId, conventionId)
  if (!loaded) notFound()

  const { record, compiled, compileError } = loaded

  const t = await getTranslations({ locale, namespace: 'naming' })
  const targets = await getTranslations({ locale, namespace: 'namingTarget' })
  const sources = await getTranslations({ locale, namespace: 'fieldSource' })
  const caseRules = await getTranslations({ locale, namespace: 'caseRule' })
  const common = await getTranslations({ locale, namespace: 'common' })

  const codeTables = await prisma.codeTable.findMany({
    where: { projectId },
    orderBy: { key: 'asc' },
  })

  const canEdit = access.can('naming:edit')
  const examples = compiled
    ? checkExamples(compiled, record.examples)
    : { passed: false, checks: [] }

  async function addField(state: NamingActionState, formData: FormData) {
    'use server'
    return addFieldAction(appLocale, projectId, conventionId, state, formData)
  }
  async function addExample(state: NamingActionState, formData: FormData) {
    'use server'
    return addExampleAction(appLocale, projectId, conventionId, state, formData)
  }
  async function toggle() {
    'use server'
    return toggleConventionAction(appLocale, projectId, conventionId)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={localized(record.labels, appLocale, record.key)}
        subtitle={localized(record.description, appLocale, '')}
        actions={
          <>
            <a
              href={`/api/projects/${projectId}/naming/${conventionId}/export`}
              className="btn-secondary text-xs"
            >
              {t('exportJson')}
            </a>
            <Link href={`/p/${projectId}/naming`} className="btn-secondary text-xs">
              {common('back')}
            </Link>
          </>
        }
      />

      <div className="card grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="label">{t('target')}</p>
          <p className="text-sm">{targets(record.target)}</p>
        </div>
        <div>
          <p className="label">{t('separator')}</p>
          <p className="text-sm">
            {record.separator === '' ? t('separatorNone') : <Mono>{record.separator}</Mono>}
          </p>
        </div>
        <div>
          <p className="label">{t('caseRule')}</p>
          <p className="text-sm">{caseRules(record.caseRule)}</p>
        </div>
        <div>
          <p className="label">{common('status')}</p>
          <div className="flex items-center gap-2">
            <Badge tone={record.isActive ? 'green' : 'slate'}>
              {record.isActive ? t('active') : t('inactive')}
            </Badge>
            {canEdit ? <ToggleActive isActive={record.isActive} onToggle={toggle} /> : null}
          </div>
        </div>
      </div>

      {compileError ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {t('compileError', { message: compileError })}
        </p>
      ) : null}

      {compiled ? (
        <div className="card space-y-3 p-5">
          <div>
            <p className="label">{t('mask')}</p>
            <p className="font-mono text-base font-medium">{compiled.mask}</p>
          </div>
          <div>
            <p className="label">{t('pattern')}</p>
            <p className="muted overflow-x-auto whitespace-pre font-mono text-xs">
              {compiled.regexSource}
            </p>
          </div>
        </div>
      ) : null}

      <SectionCard title={t('fields')}>
        {record.fields.length === 0 ? (
          <EmptyState>{common('empty')}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-10">#</th>
                  <th>{t('fieldKey')}</th>
                  <th>{common('name')}</th>
                  <th>{t('fieldSource')}</th>
                  <th>{t('codeValues')}</th>
                  <th>{common('example')}</th>
                  {canEdit ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {record.fields.map((field) => (
                  <tr key={field.id}>
                    <td className="muted font-mono text-xs">{field.order + 1}</td>
                    <td>
                      <Mono>{field.key}</Mono>
                      {!field.required ? (
                        <span className="muted ml-2 text-xs">{common('optional')}</span>
                      ) : null}
                    </td>
                    <td className="text-sm">{localized(field.labels, appLocale, field.key)}</td>
                    <td className="text-xs">{sources(field.source)}</td>
                    <td className="text-xs">
                      {field.codeTable ? (
                        <span className="font-mono">
                          {field.codeTable.values.map((value) => value.code).join(', ') || '—'}
                        </span>
                      ) : field.pattern ? (
                        <Mono>{field.pattern}</Mono>
                      ) : field.dateFormat ? (
                        <Mono>{field.dateFormat}</Mono>
                      ) : (
                        <span className="muted">
                          {[field.minLength, field.maxLength].filter((v) => v != null).join('–') || '—'}
                        </span>
                      )}
                    </td>
                    <td className="font-mono text-xs">{field.example ?? '—'}</td>
                    {canEdit ? (
                      <td>
                        <form
                          action={async () => {
                            'use server'
                            await deleteFieldAction(appLocale, projectId, conventionId, field.id)
                          }}
                        >
                          <button type="submit" className="btn-ghost text-xs">
                            {common('delete')}
                          </button>
                        </form>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {canEdit ? (
          <details className="mt-5">
            <summary className="cursor-pointer text-sm font-medium">{t('addField')}</summary>
            <div className="mt-4 rounded-lg border border-[color:var(--border)] p-4">
              <AddFieldForm
                action={addField}
                codeTables={codeTables.map((table) => ({
                  id: table.id,
                  key: table.key,
                  label: localized(table.labels, appLocale, table.key),
                }))}
              />
            </div>
          </details>
        ) : null}
      </SectionCard>

      {compiled ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <SectionCard title={t('validator')} description={t('validatorHint')}>
            <NamingValidator compiled={compiled} locale={appLocale} />
          </SectionCard>

          <SectionCard title={t('builder')} description={t('builderHint')}>
            <NameBuilder compiled={compiled} locale={appLocale} />
          </SectionCard>
        </div>
      ) : null}

      <SectionCard title={t('examples')} description={t('examplesHint')}>
        {record.examples.length === 0 ? (
          <EmptyState>{common('empty')}</EmptyState>
        ) : (
          <ul className="mb-5 space-y-2">
            {record.examples.map((example) => {
              const check = examples.checks.find((entry) => entry.sample === example.sample)
              return (
                <li
                  key={example.id}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-[color:var(--border)] px-3 py-2"
                >
                  <span className="font-mono text-sm">{example.sample}</span>
                  <Badge tone={example.shouldBeValid ? 'brand' : 'slate'}>
                    {example.shouldBeValid ? t('expectValid') : t('expectInvalid')}
                  </Badge>
                  {check ? (
                    <Badge tone={check.passed ? 'green' : 'red'}>
                      {check.passed ? t('examplePass') : t('exampleFail')}
                    </Badge>
                  ) : null}
                  {canEdit ? (
                    <form
                      className="ml-auto"
                      action={async () => {
                        'use server'
                        await deleteExampleAction(appLocale, projectId, conventionId, example.id)
                      }}
                    >
                      <button type="submit" className="btn-ghost text-xs">
                        {common('delete')}
                      </button>
                    </form>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}

        {canEdit ? <AddExampleForm action={addExample} /> : null}
      </SectionCard>
    </div>
  )
}

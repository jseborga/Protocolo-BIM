import { getTranslations } from 'next-intl/server'
import { Badge, EmptyState, Mono, PageHeader, SectionCard } from '@/components/ui'
import { Link } from '@/i18n/navigation'
import type { AppLocale } from '@/i18n/routing'
import { localized } from '@/lib/localized'
import { prisma } from '@/lib/prisma'
import { requireProjectAccess } from '@/server/authz'
import { checkExamples } from '@/server/naming'
import {
  addCodeValueAction,
  createCodeTableAction,
  createConventionAction,
  deleteCodeValueAction,
  type NamingActionState,
} from '@/server/naming/actions'
import { loadProjectConventions } from '@/server/naming/repository'
import { AddCodeValueForm, CreateCodeTableForm, CreateConventionForm } from './NamingForms'

export default async function NamingPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>
}) {
  const { locale, projectId } = await params
  const access = await requireProjectAccess(projectId)
  const appLocale = locale as AppLocale

  const t = await getTranslations({ locale, namespace: 'naming' })
  const targets = await getTranslations({ locale, namespace: 'namingTarget' })
  const common = await getTranslations({ locale, namespace: 'common' })

  const [conventions, codeTables] = await Promise.all([
    loadProjectConventions(projectId),
    prisma.codeTable.findMany({
      where: { projectId },
      include: { values: { orderBy: { order: 'asc' } }, _count: { select: { fields: true } } },
      orderBy: { key: 'asc' },
    }),
  ])

  const canEdit = access.can('naming:edit')

  async function createConvention(state: NamingActionState, formData: FormData) {
    'use server'
    return createConventionAction(appLocale, projectId, state, formData)
  }
  async function createTable(state: NamingActionState, formData: FormData) {
    'use server'
    return createCodeTableAction(appLocale, projectId, state, formData)
  }
  async function addValue(state: NamingActionState, formData: FormData) {
    'use server'
    return addCodeValueAction(appLocale, projectId, state, formData)
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      <SectionCard title={t('conventions')}>
        {conventions.length === 0 ? (
          <EmptyState>{common('empty')}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{common('name')}</th>
                  <th>{t('target')}</th>
                  <th>{t('mask')}</th>
                  <th>{t('examples')}</th>
                  <th>{common('status')}</th>
                </tr>
              </thead>
              <tbody>
                {conventions.map(({ record, compiled, compileError }) => {
                  const examples = compiled
                    ? checkExamples(compiled, record.examples)
                    : { passed: false, checks: [] }
                  const failing = examples.checks.filter((check) => !check.passed).length

                  return (
                    <tr key={record.id}>
                      <td>
                        <Link
                          href={`/p/${projectId}/naming/${record.id}`}
                          className="font-medium text-brand-600 hover:underline"
                        >
                          {localized(record.labels, appLocale, record.key)}
                        </Link>
                        <span className="muted ml-2 font-mono text-xs">{record.key}</span>
                      </td>
                      <td className="text-xs">{targets(record.target)}</td>
                      <td>
                        {compiled ? (
                          <Mono>{compiled.mask}</Mono>
                        ) : (
                          <span className="text-xs text-red-600">{compileError}</span>
                        )}
                      </td>
                      <td className="text-xs">
                        {record.examples.length === 0 ? (
                          <span className="muted">—</span>
                        ) : failing === 0 ? (
                          <Badge tone="green">{record.examples.length}</Badge>
                        ) : (
                          <Badge tone="red">{t('examplesFailed', { count: failing })}</Badge>
                        )}
                      </td>
                      <td>
                        <Badge tone={record.isActive ? 'green' : 'slate'}>
                          {record.isActive ? t('active') : t('inactive')}
                        </Badge>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {canEdit ? (
          <details className="mt-5">
            <summary className="cursor-pointer text-sm font-medium">{t('newConvention')}</summary>
            <div className="mt-4 rounded-lg border border-[color:var(--border)] p-4">
              <CreateConventionForm action={createConvention} />
            </div>
          </details>
        ) : null}
      </SectionCard>

      <SectionCard title={t('codeTables')}>
        <div className="grid gap-4 md:grid-cols-2">
          {codeTables.map((table) => (
            <div key={table.id} className="rounded-lg border border-[color:var(--border)] p-4">
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold">
                    {localized(table.labels, appLocale, table.key)}
                  </h3>
                  <Mono>{table.key}</Mono>
                </div>
                <span className="muted text-xs">{table.values.length}</span>
              </div>

              {table.values.length === 0 ? (
                <p className="muted text-xs">{common('empty')}</p>
              ) : (
                <ul className="mb-3 flex flex-wrap gap-1.5">
                  {table.values.map((value) => (
                    <li key={value.id}>
                      <span
                        className="inline-flex items-center gap-1 rounded border border-[color:var(--border)] px-1.5 py-0.5 text-xs"
                        title={localized(value.labels, appLocale, value.code)}
                      >
                        <span className="font-mono">{value.code}</span>
                        {canEdit ? (
                          <form
                            action={async () => {
                              'use server'
                              await deleteCodeValueAction(appLocale, projectId, value.id)
                            }}
                          >
                            <button
                              type="submit"
                              className="muted hover:text-red-600"
                              aria-label={`${common('delete')} ${value.code}`}
                            >
                              ×
                            </button>
                          </form>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {canEdit ? <AddCodeValueForm action={addValue} tableId={table.id} /> : null}
            </div>
          ))}
        </div>

        {canEdit ? (
          <div className="mt-5 rounded-lg border border-dashed border-[color:var(--border)] p-4">
            <CreateCodeTableForm action={createTable} />
          </div>
        ) : null}
      </SectionCard>
    </div>
  )
}

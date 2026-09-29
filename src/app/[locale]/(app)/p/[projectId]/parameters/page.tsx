import { getTranslations } from 'next-intl/server'
import { Badge, EmptyState, Mono, PageHeader, SectionCard } from '@/components/ui'
import type { AppLocale } from '@/i18n/locales'
import { Link } from '@/i18n/navigation'
import { localized } from '@/lib/localized'
import { prisma } from '@/lib/prisma'
import { requireProjectAccess } from '@/server/authz'
import { REVIT_CATEGORIES, REVIT_DATA_TYPES, REVIT_PALETTE_GROUPS } from '@/server/revit/catalog'
import {
  addSharedParameterAction,
  addWorksetAction,
  deleteSharedParameterAction,
  deleteWorksetAction,
  type StandardFormState,
  updateSharedParameterAction,
} from '@/server/revit/standardActions'
import { AddWorksetForm, ParameterForm, type ParameterValues } from './StandardForms'

const CATEGORY_GROUPS = ['ARCHITECTURE', 'STRUCTURE', 'MEP', 'SITE', 'SPACES', 'DOCUMENTATION'] as const

export default async function ParametersPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; projectId: string }>
  searchParams: Promise<{ edit?: string }>
}) {
  const { locale, projectId } = await params
  const { edit } = await searchParams
  const access = await requireProjectAccess(projectId)
  const appLocale = locale as AppLocale

  const t = await getTranslations({ locale, namespace: 'parameters' })
  const common = await getTranslations({ locale, namespace: 'common' })

  const [parameters, groups, worksets, disciplines] = await Promise.all([
    prisma.sharedParameterDef.findMany({
      where: { projectId },
      include: { group: true },
      orderBy: [{ group: { order: 'asc' } }, { name: 'asc' }],
    }),
    prisma.parameterGroupDef.findMany({ where: { projectId }, orderBy: { order: 'asc' } }),
    prisma.worksetDef.findMany({
      where: { projectId },
      include: { discipline: true },
      orderBy: { order: 'asc' },
    }),
    prisma.discipline.findMany({ orderBy: { order: 'asc' } }),
  ])

  const canEdit = access.can('naming:edit')
  const categoryLabel = (id: string) =>
    REVIT_CATEGORIES.find((category) => category.id === id)?.labels[appLocale] ?? id
  const typeLabel = (id: string) =>
    REVIT_DATA_TYPES.find((type) => type.id === id)?.labels[appLocale] ?? id
  const paletteLabel = (id: string) =>
    REVIT_PALETTE_GROUPS.find((group) => group.id === id)?.labels[appLocale] ?? id

  async function addParameter(state: StandardFormState, formData: FormData) {
    'use server'
    return addSharedParameterAction(appLocale, projectId, state, formData)
  }

  const editing = canEdit && edit ? parameters.find((parameter) => parameter.id === edit) : undefined
  const editingId = editing?.id
  async function updateParameter(state: StandardFormState, formData: FormData) {
    'use server'
    return updateSharedParameterAction(appLocale, projectId, editingId ?? '', state, formData)
  }

  const formChoices = {
    groups: groups.map((group) => group.name),
    dataTypes: REVIT_DATA_TYPES.map((type) => ({ id: type.id, label: type.labels[appLocale] ?? type.id })),
    paletteGroups: REVIT_PALETTE_GROUPS.map((group) => ({ id: group.id, label: group.labels[appLocale] ?? group.id })),
    categories: REVIT_CATEGORIES.map((category) => ({
      id: category.id,
      group: category.group,
      label: category.labels[appLocale] ?? category.id,
    })),
    categoryGroups: CATEGORY_GROUPS.map((group) => ({ id: group, label: t(`categoryGroup.${group}`) })),
  }

  const editingValues: ParameterValues | undefined = editing
    ? {
        name: editing.name,
        group: editing.group?.name ?? '',
        dataType: editing.dataType,
        paletteGroup: editing.paletteGroup,
        binding: editing.isInstance ? 'INSTANCE' : 'TYPE',
        ifcPset: editing.ifcPset ?? '',
        ifcProperty: editing.ifcProperty ?? '',
        description: localized(editing.description, appLocale, ''),
        categories: editing.categories,
        ...(editing.required ? { required: 'on' } : {}),
      }
    : undefined
  async function addWorkset(state: StandardFormState, formData: FormData) {
    'use server'
    return addWorksetAction(appLocale, projectId, state, formData)
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('title')}
        subtitle={t('subtitle')}
        actions={
          <a href={`/api/projects/${projectId}/shared-parameters.txt`} className="btn-secondary text-xs">
            {t('downloadTxt')}
          </a>
        }
      />

      {editing && editingValues ? (
        <SectionCard title={t('editTitle', { name: editing.name })} description={t('editHint', { guid: editing.guid })}>
          <div id="edit-parameter">
            <ParameterForm
              key={editing.id}
              action={updateParameter}
              initial={editingValues}
              submitLabel={common('save')}
              idPrefix="edit-parameter"
              {...formChoices}
            />
            <Link href={`/p/${projectId}/parameters`} className="btn-ghost mt-2 inline-block text-xs">
              {common('cancel')}
            </Link>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title={t('library')} description={t('libraryHint')}>
        {parameters.length === 0 ? (
          <EmptyState>{common('empty')}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{common('name')}</th>
                  <th>{t('group')}</th>
                  <th>{t('dataType')}</th>
                  <th>{t('binding')}</th>
                  <th>{t('categories')}</th>
                  <th>IFC</th>
                  <th>GUID</th>
                  {canEdit ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {parameters.map((parameter) => (
                  <tr key={parameter.id}>
                    <td>
                      <Mono>{parameter.name}</Mono>
                      {parameter.required ? (
                        <Badge tone="brand">{common('required')}</Badge>
                      ) : null}
                      <p className="muted mt-1 text-xs">
                        {localized(parameter.description, appLocale, '')}
                      </p>
                    </td>
                    <td className="text-xs">{parameter.group?.name ?? '—'}</td>
                    <td className="text-xs">
                      {typeLabel(parameter.dataType)}
                      <p className="muted">{paletteLabel(parameter.paletteGroup)}</p>
                    </td>
                    <td className="text-xs">{parameter.isInstance ? t('instance') : t('type')}</td>
                    <td className="text-xs" title={parameter.categories.map(categoryLabel).join(', ')}>
                      {parameter.categories.length <= 3
                        ? parameter.categories.map(categoryLabel).join(', ')
                        : t('categoriesCount', { count: parameter.categories.length })}
                    </td>
                    <td className="font-mono text-xs">
                      {parameter.ifcPset ? `${parameter.ifcPset}.${parameter.ifcProperty ?? ''}` : '—'}
                    </td>
                    <td className="muted font-mono text-[11px]" title={parameter.guid} data-testid="parameter-guid">
                      {parameter.guid.slice(0, 8)}…
                    </td>
                    {canEdit ? (
                      <td>
                        <div className="flex items-center gap-1">
                          <Link
                            href={`/p/${projectId}/parameters?edit=${parameter.id}#edit-parameter`}
                            className="btn-ghost text-xs"
                          >
                            {common('edit')}
                          </Link>
                          <form
                            action={async () => {
                              'use server'
                              await deleteSharedParameterAction(appLocale, projectId, parameter.id)
                            }}
                          >
                            <button type="submit" className="btn-ghost text-xs">
                              {common('delete')}
                            </button>
                          </form>
                        </div>
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
            <summary className="cursor-pointer text-sm font-medium">{t('add')}</summary>
            <div className="mt-4 rounded-lg border border-[color:var(--border)] p-4">
              <ParameterForm action={addParameter} submitLabel={t('add')} {...formChoices} />
            </div>
          </details>
        ) : null}
      </SectionCard>

      <SectionCard title={t('worksets')} description={t('worksetsHint')}>
        {worksets.length === 0 ? (
          <EmptyState>{common('empty')}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{common('name')}</th>
                  <th>{common('discipline')}</th>
                  <th>{common('description')}</th>
                  {canEdit ? <th /> : null}
                </tr>
              </thead>
              <tbody>
                {worksets.map((workset) => (
                  <tr key={workset.id}>
                    <td>
                      <Mono>{workset.name}</Mono>
                    </td>
                    <td className="text-sm">
                      {workset.discipline
                        ? localized(workset.discipline.labels, appLocale, workset.discipline.code)
                        : '—'}
                    </td>
                    <td className="muted text-sm">{workset.description ?? '—'}</td>
                    {canEdit ? (
                      <td>
                        <form
                          action={async () => {
                            'use server'
                            await deleteWorksetAction(appLocale, projectId, workset.id)
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
          <div className="mt-5 rounded-lg border border-dashed border-[color:var(--border)] p-4">
            <AddWorksetForm
              action={addWorkset}
              disciplines={disciplines.map((discipline) => ({
                id: discipline.id,
                label: localized(discipline.labels, appLocale, discipline.code),
              }))}
            />
          </div>
        ) : null}
      </SectionCard>
    </div>
  )
}

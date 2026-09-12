import { getTranslations } from 'next-intl/server'
import { Badge, EmptyState, Mono, SectionCard } from '@/components/ui'
import { Markdown } from '@/components/Markdown'
import { Link } from '@/i18n/navigation'
import { appLocaleToDb, type AppLocale, dbLocaleToApp, localeNames } from '@/i18n/routing'
import { localized } from '@/lib/localized'
import { prisma } from '@/lib/prisma'
import { requireProjectAccess } from '@/server/authz'
import {
  addCommentAction,
  changeStatusAction,
  createVersionAction,
  resolveCommentAction,
  saveSectionAction,
  type ActionState,
} from '@/server/protocol/actions'
import { GENERATED_SECTIONS, renderGeneratedSection } from '@/server/protocol'
import { CommentBox } from './CommentBox'
import { SectionEditor } from './SectionEditor'
import { WorkflowBar } from './WorkflowBar'

const STATUS_TONE = {
  DRAFT: 'slate',
  IN_REVIEW: 'amber',
  APPROVED: 'green',
  SUPERSEDED: 'neutral',
} as const

export default async function ProtocolPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; projectId: string }>
  searchParams: Promise<{ section?: string }>
}) {
  const { locale, projectId } = await params
  const { section: requestedSection } = await searchParams
  const access = await requireProjectAccess(projectId)
  const appLocale = locale as AppLocale
  const contentLocale = appLocaleToDb[appLocale]

  const t = await getTranslations({ locale, namespace: 'protocol' })
  const common = await getTranslations({ locale, namespace: 'common' })
  const statusLabels = await getTranslations({ locale, namespace: 'protocolStatus' })

  const protocol = await prisma.protocol.findFirst({
    where: { projectId, status: { not: 'SUPERSEDED' } },
    orderBy: { createdAt: 'desc' },
    include: {
      approvedBy: true,
      sections: {
        orderBy: { order: 'asc' },
        include: {
          contents: true,
          comments: {
            orderBy: { createdAt: 'asc' },
            include: { user: { select: { name: true } } },
          },
        },
      },
    },
  })

  if (!protocol) return <EmptyState>{common('empty')}</EmptyState>

  const sections = protocol.sections
  const current =
    sections.find((section) => section.key === requestedSection) ?? sections[0]!

  const contentFor = (section: (typeof sections)[number], wanted: typeof contentLocale) =>
    section.contents.find((entry) => entry.locale === wanted)

  const currentContent = contentFor(current, contentLocale)
  const baseContent = contentFor(current, access.project.baseLocale)
  const generator = GENERATED_SECTIONS.get(current.key)
  const generatedBody = generator
    ? await renderGeneratedSection(generator, projectId, contentLocale)
    : null

  const editable =
    access.can('protocol:edit') && (protocol.status === 'DRAFT' || protocol.status === 'IN_REVIEW')

  async function save(state: ActionState, formData: FormData) {
    'use server'
    return saveSectionAction(appLocale, projectId, state, formData)
  }
  async function comment(state: ActionState, formData: FormData) {
    'use server'
    return addCommentAction(appLocale, projectId, state, formData)
  }
  async function changeStatus(target: 'IN_REVIEW' | 'APPROVED' | 'DRAFT') {
    'use server'
    return changeStatusAction(appLocale, projectId, protocol!.id, target)
  }
  async function newVersion() {
    'use server'
    return createVersionAction(appLocale, projectId, protocol!.id)
  }

  const openComments = current.comments.filter((entry) => !entry.resolved)

  return (
    <div className="space-y-5">
      <div className="card flex flex-wrap items-center justify-between gap-4 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <Badge tone={STATUS_TONE[protocol.status]}>{statusLabels(protocol.status)}</Badge>
          <span className="text-sm font-medium">{t('version', { label: protocol.versionLabel })}</span>
          {protocol.approvedBy && protocol.approvedAt ? (
            <span className="muted text-xs">
              {t('approvedBy', {
                name: protocol.approvedBy.name,
                date: new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                  protocol.approvedAt,
                ),
              })}
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/p/${projectId}/protocol/versions`} className="btn-ghost text-xs">
            {t('versions')}
          </Link>
          <a
            href={`/api/projects/${projectId}/export/pdf?locale=${locale}`}
            className="btn-secondary text-xs"
            target="_blank"
            rel="noreferrer"
          >
            {t('exportPdf')}
          </a>
          <a
            href={`/api/projects/${projectId}/export/docx?locale=${locale}`}
            className="btn-secondary text-xs"
          >
            {t('exportDocx')}
          </a>
        </div>
      </div>

      <WorkflowBar
        status={protocol.status}
        canEdit={access.can('protocol:edit')}
        canApprove={access.can('protocol:approve')}
        canCreateVersion={access.can('protocol:createVersion')}
        onChangeStatus={changeStatus}
        onCreateVersion={newVersion}
      />

      <div className="grid gap-5 lg:grid-cols-[19rem_1fr]">
        <nav className="card max-h-[70vh] overflow-auto p-2">
          <ol className="space-y-0.5">
            {sections.map((section) => {
              const content = contentFor(section, contentLocale)
              const base = contentFor(section, access.project.baseLocale)
              const hasContent = (content?.body ?? '').trim() !== ''
              const hasBase = (base?.body ?? '').trim() !== ''
              const unresolved = section.comments.filter((entry) => !entry.resolved).length
              const isGenerated = GENERATED_SECTIONS.has(section.key)

              return (
                <li key={section.id}>
                  <Link
                    href={`/p/${projectId}/protocol?section=${section.key}`}
                    className={`flex items-start gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                      section.key === current.key
                        ? 'bg-brand-50 font-medium text-brand-800 dark:bg-brand-900/30 dark:text-brand-200'
                        : 'hover:bg-[color:var(--surface-sunken)]'
                    }`}
                  >
                    <span className="muted w-6 shrink-0 text-right font-mono text-[11px] leading-5">
                      {section.order}
                    </span>
                    <span className="flex-1 leading-snug">
                      {content?.title ?? base?.title ?? section.key}
                    </span>
                    <span className="mt-0.5 flex shrink-0 items-center gap-1">
                      {unresolved > 0 ? (
                        <span className="rounded-full bg-amber-100 px-1.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                          {unresolved}
                        </span>
                      ) : null}
                      {isGenerated ? (
                        <span
                          className="size-1.5 rounded-full bg-brand-500"
                          title={t('guidance')}
                        />
                      ) : (
                        <span
                          className={`size-1.5 rounded-full ${
                            hasContent
                              ? 'bg-emerald-500'
                              : hasBase
                                ? 'bg-amber-400'
                                : section.isRequired
                                  ? 'bg-red-400'
                                  : 'bg-[color:var(--border)]'
                          }`}
                          title={hasContent ? common('saved') : t('untranslated')}
                        />
                      )}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ol>
        </nav>

        <div className="space-y-5">
          <SectionCard
            title={currentContent?.title ?? baseContent?.title ?? current.key}
            description={localized(current.guidance, appLocale, '')}
            actions={<Mono>{current.key}</Mono>}
          >
            {generator ? (
              <div>
                <p className="muted mb-3 text-xs">{localized(current.guidance, appLocale, '')}</p>
                {generatedBody ? (
                  <Markdown source={generatedBody} />
                ) : (
                  <EmptyState>{common('empty')}</EmptyState>
                )}
              </div>
            ) : (
              <>
                {!currentContent?.body?.trim() && baseContent?.body?.trim() ? (
                  <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                    {t('untranslatedHint', { language: localeNames[appLocale] })}
                  </p>
                ) : null}
                <SectionEditor
                  action={save}
                  sectionId={current.id}
                  initialTitle={currentContent?.title ?? baseContent?.title ?? current.key}
                  initialBody={currentContent?.body ?? ''}
                  readOnly={!editable}
                  readOnlyReason={
                    access.can('protocol:edit') ? t('cannotEditApproved') : undefined
                  }
                  languageName={localeNames[appLocale]}
                />
                {!currentContent?.body?.trim() && baseContent?.body?.trim() ? (
                  <div className="mt-6 rounded-lg border border-dashed border-[color:var(--border)] p-4">
                    <p className="muted mb-2 text-xs font-medium uppercase tracking-wide">
                      {t('fallbackFrom', {
                        language: localeNames[dbLocaleToApp[access.project.baseLocale]],
                      })}
                    </p>
                    <Markdown source={baseContent.body} />
                  </div>
                ) : null}
              </>
            )}
          </SectionCard>

          <SectionCard
            title={t('comments')}
            description={
              openComments.length > 0 ? t('openComments', { count: openComments.length }) : undefined
            }
          >
            <ul className="mb-4 space-y-3">
              {current.comments.map((entry) => (
                <li
                  key={entry.id}
                  className={`rounded-lg border border-[color:var(--border)] p-3 text-sm ${
                    entry.resolved ? 'opacity-60' : ''
                  }`}
                >
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <span className="font-medium">{entry.user.name}</span>
                    <span className="muted text-xs">
                      {new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(
                        entry.createdAt,
                      )}
                    </span>
                    {entry.resolved ? <Badge tone="green">{t('resolved')}</Badge> : null}
                  </div>
                  <p className="whitespace-pre-wrap">{entry.body}</p>
                  {!entry.resolved && access.can('comment:resolve') ? (
                    <form
                      action={async () => {
                        'use server'
                        await resolveCommentAction(appLocale, projectId, entry.id)
                      }}
                      className="mt-2"
                    >
                      <button type="submit" className="btn-ghost text-xs">
                        {t('resolve')}
                      </button>
                    </form>
                  ) : null}
                </li>
              ))}
            </ul>
            {access.can('comment:create') ? (
              <CommentBox action={comment} sectionId={current.id} />
            ) : null}
          </SectionCard>
        </div>
      </div>
    </div>
  )
}

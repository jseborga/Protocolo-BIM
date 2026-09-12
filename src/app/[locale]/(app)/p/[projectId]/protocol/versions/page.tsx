import { getTranslations } from 'next-intl/server'
import { Badge, EmptyState, SectionCard } from '@/components/ui'
import { Link } from '@/i18n/navigation'
import { appLocaleToDb, type AppLocale } from '@/i18n/routing'
import { prisma } from '@/lib/prisma'
import { requireProjectAccess } from '@/server/authz'
import { diffProtocols, type SectionSnapshot } from '@/server/protocol'

const STATUS_TONE = {
  DRAFT: 'slate',
  IN_REVIEW: 'amber',
  APPROVED: 'green',
  SUPERSEDED: 'neutral',
} as const

const LINE_STYLE = {
  ADDED: 'bg-emerald-50 text-emerald-900 dark:bg-emerald-950/60 dark:text-emerald-200',
  REMOVED: 'bg-red-50 text-red-900 line-through dark:bg-red-950/60 dark:text-red-200',
  CONTEXT: 'muted',
} as const

export default async function VersionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; projectId: string }>
  searchParams: Promise<{ a?: string; b?: string }>
}) {
  const { locale, projectId } = await params
  const { a, b } = await searchParams
  const access = await requireProjectAccess(projectId)
  const contentLocale = appLocaleToDb[locale as AppLocale]

  const t = await getTranslations({ locale, namespace: 'protocol' })
  const common = await getTranslations({ locale, namespace: 'common' })
  const statusLabels = await getTranslations({ locale, namespace: 'protocolStatus' })

  const protocols = await prisma.protocol.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      sections: { orderBy: { order: 'asc' }, include: { contents: true } },
    },
  })

  if (protocols.length === 0) return <EmptyState>{common('empty')}</EmptyState>

  const newer = protocols.find((protocol) => protocol.id === b) ?? protocols[0]!
  const older =
    protocols.find((protocol) => protocol.id === a) ??
    protocols.find((protocol) => protocol.id === newer.supersedesId) ??
    protocols[1]

  const snapshot = (protocol: (typeof protocols)[number]): SectionSnapshot[] =>
    protocol.sections.map((section) => {
      const content =
        section.contents.find((entry) => entry.locale === contentLocale) ??
        section.contents.find((entry) => entry.locale === access.project.baseLocale)
      return {
        key: section.key,
        title: content?.title ?? section.key,
        body: content?.body ?? '',
        order: section.order,
      }
    })

  const diff = older ? diffProtocols(snapshot(older), snapshot(newer)) : null
  const format = (value: Date) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value)

  return (
    <div className="space-y-5">
      <SectionCard
        title={t('versions')}
        actions={
          <Link href={`/p/${projectId}/protocol`} className="btn-secondary text-xs">
            {common('back')}
          </Link>
        }
      >
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{common('version')}</th>
                <th>{common('status')}</th>
                <th>{common('createdAt')}</th>
                <th>{t('approve')}</th>
                <th>{t('diff')}</th>
              </tr>
            </thead>
            <tbody>
              {protocols.map((protocol) => (
                <tr key={protocol.id}>
                  <td className="font-mono font-medium">{protocol.versionLabel}</td>
                  <td>
                    <Badge tone={STATUS_TONE[protocol.status]}>{statusLabels(protocol.status)}</Badge>
                  </td>
                  <td className="muted text-xs">
                    {format(protocol.createdAt)} · {protocol.createdBy.name}
                  </td>
                  <td className="muted text-xs">
                    {protocol.approvedBy && protocol.approvedAt
                      ? `${format(protocol.approvedAt)} · ${protocol.approvedBy.name}`
                      : '—'}
                  </td>
                  <td>
                    <Link
                      href={`/p/${projectId}/protocol/versions?b=${protocol.id}${
                        protocol.supersedesId ? `&a=${protocol.supersedesId}` : ''
                      }`}
                      className="text-xs text-brand-600 hover:underline"
                    >
                      {t('diffWith')}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {diff && older ? (
        <SectionCard
          title={`${older.versionLabel} → ${newer.versionLabel}`}
          description={
            diff.hasChanges
              ? `${diff.addedSections} ${t('diffSectionAdded').toLowerCase()} · ${
                  diff.modifiedSections
                } · ${diff.removedSections} ${t('diffSectionRemoved').toLowerCase()}`
              : undefined
          }
        >
          {!diff.hasChanges ? (
            <EmptyState>{t('diffNoChanges')}</EmptyState>
          ) : (
            <ol className="space-y-5">
              {diff.sections
                .filter((section) => section.status !== 'UNCHANGED')
                .map((section) => (
                  <li key={section.key}>
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{section.title}</h3>
                      {section.status === 'ADDED' ? (
                        <Badge tone="green">{t('diffSectionAdded')}</Badge>
                      ) : null}
                      {section.status === 'REMOVED' ? (
                        <Badge tone="red">{t('diffSectionRemoved')}</Badge>
                      ) : null}
                      {section.titleChanged && section.previousTitle ? (
                        <span className="muted text-xs line-through">{section.previousTitle}</span>
                      ) : null}
                      <span className="muted text-xs tabular-nums">
                        +{section.addedCount} −{section.removedCount}
                      </span>
                    </div>
                    <pre className="overflow-x-auto rounded-lg border border-[color:var(--border)] p-3 font-mono text-xs leading-relaxed">
                      {section.lines.map((line, index) => (
                        <div key={index} className={`px-1 ${LINE_STYLE[line.type]}`}>
                          <span className="select-none opacity-60">
                            {line.type === 'ADDED' ? '+ ' : line.type === 'REMOVED' ? '− ' : '  '}
                          </span>
                          {line.text || ' '}
                        </div>
                      ))}
                    </pre>
                  </li>
                ))}
            </ol>
          )}
        </SectionCard>
      ) : null}
    </div>
  )
}

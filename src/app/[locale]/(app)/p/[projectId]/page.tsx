import { getTranslations } from 'next-intl/server'
import { Card, EmptyState, Progress, SectionCard, Stat } from '@/components/ui'
import { Link } from '@/i18n/navigation'
import { type AppLocale, dbLocaleToApp, localeNames } from '@/i18n/routing'
import { localized } from '@/lib/localized'
import { prisma } from '@/lib/prisma'
import { requireProjectAccess } from '@/server/authz'
import { computeCompleteness } from '@/server/protocol'

export default async function ProjectDashboard({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>
}) {
  const { locale, projectId } = await params
  const { project } = await requireProjectAccess(projectId)

  const t = await getTranslations({ locale, namespace: 'dashboard' })
  const nav = await getTranslations({ locale, namespace: 'nav' })
  const protocolLabels = await getTranslations({ locale, namespace: 'protocol' })
  const statusLabels = await getTranslations({ locale, namespace: 'protocolStatus' })

  const [protocol, memberCount, conventions] = await Promise.all([
    prisma.protocol.findFirst({
      where: { projectId, status: { not: 'SUPERSEDED' } },
      orderBy: { createdAt: 'desc' },
      include: {
        sections: { include: { contents: true }, orderBy: { order: 'asc' } },
      },
    }),
    prisma.projectMember.count({ where: { projectId } }),
    prisma.namingConvention.findMany({
      where: { projectId },
      select: { id: true, key: true, labels: true, isActive: true, target: true },
      orderBy: { key: 'asc' },
    }),
  ])

  const sections = (protocol?.sections ?? []).map((section) => ({
    key: section.key,
    isRequired: section.isRequired,
    isGenerated: section.kind === 'GENERATED',
    title:
      section.contents.find((content) => content.locale === project.baseLocale)?.title ?? section.key,
    contents: section.contents.map((content) => ({ locale: content.locale, body: content.body })),
  }))

  const completeness = computeCompleteness(sections, project.baseLocale, project.enabledLocales)
  const activeConventions = conventions.filter((convention) => convention.isActive)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label={t('protocolStatus')}
          value={protocol ? statusLabels(protocol.status) : '—'}
          hint={protocol ? protocolLabels('version', { label: protocol.versionLabel }) : undefined}
        />
        <Stat
          label={t('completeness')}
          value={`${completeness.percent}%`}
          hint={`${completeness.requiredDone}/${completeness.requiredTotal}`}
        />
        <Stat label={t('members')} value={memberCount} />
        <Stat
          label={t('conventions')}
          value={activeConventions.length}
          hint={`${conventions.length} ${nav('naming').toLowerCase()}`}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title={t('completeness')}
          description={t('completenessHint')}
          actions={
            protocol ? (
              <Link href={`/p/${projectId}/protocol`} className="btn-secondary text-xs">
                {t('openProtocol')}
              </Link>
            ) : null
          }
        >
          <Progress value={completeness.percent} tone={completeness.percent === 100 ? 'green' : 'brand'} />
          <p className="muted mt-2 text-xs">
            {completeness.requiredDone} / {completeness.requiredTotal}
          </p>

          <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide">
            {t('pendingSections')}
          </h3>
          {completeness.missing.length === 0 ? (
            <p className="muted mt-2 text-sm">{t('allSectionsDone')}</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {completeness.missing.map((section) => (
                <li key={section.key}>
                  <Link
                    href={`/p/${projectId}/protocol?section=${section.key}`}
                    className="text-brand-600 hover:underline"
                  >
                    {section.title}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t('translation')}>
          {completeness.translation.length === 0 ? (
            <EmptyState>{t('allSectionsDone')}</EmptyState>
          ) : (
            <ul className="space-y-4">
              {completeness.translation.map((entry) => (
                <li key={entry.locale}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span>{localeNames[dbLocaleToApp[entry.locale]]}</span>
                    <span className="muted tabular-nums">
                      {entry.translated}/{entry.total} · {entry.percent}%
                    </span>
                  </div>
                  <Progress value={entry.percent} />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title={t('client')}>
          {project.client ? (
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
              <div>
                <dt className="muted text-xs uppercase tracking-wide">{t('client')}</dt>
                <dd>{project.client.legalName}</dd>
              </div>
              {project.client.taxId ? (
                <div>
                  <dt className="muted text-xs uppercase tracking-wide">NIF / CNPJ</dt>
                  <dd className="font-mono text-xs">{project.client.taxId}</dd>
                </div>
              ) : null}
              {project.client.contactName ? (
                <div>
                  <dt className="muted text-xs uppercase tracking-wide">{project.client.contactName}</dt>
                  <dd className="muted text-xs">{project.client.contactEmail}</dd>
                </div>
              ) : null}
            </dl>
          ) : (
            <EmptyState>{t('noClient')}</EmptyState>
          )}
        </SectionCard>

        <SectionCard title={t('quickLinks')}>
          <ul className="space-y-2 text-sm">
            {activeConventions.slice(0, 6).map((convention) => (
              <li key={convention.id} className="flex items-center justify-between gap-3">
                <Link
                  href={`/p/${projectId}/naming/${convention.id}`}
                  className="text-brand-600 hover:underline"
                >
                  {localized(convention.labels, locale as AppLocale, convention.key)}
                </Link>
                <span className="muted font-mono text-xs">{convention.key}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      </div>

      <Card>
        <p className="muted text-sm">{project.description}</p>
      </Card>
    </div>
  )
}

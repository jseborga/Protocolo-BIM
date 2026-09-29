import type { Prisma } from '@prisma/client'
import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'
import { Badge, Card, EmptyState, PageHeader, SectionCard, Stat } from '@/components/ui'
import { Link } from '@/i18n/navigation'
import type { AppLocale } from '@/i18n/locales'
import { prisma } from '@/lib/prisma'
import { requireProjectAccess } from '@/server/authz'
import type { AuditSummary } from '@/server/revit/audit'
import { createFindingRenderer } from '@/server/revit/messages'
import { loadStandard } from '@/server/revit/standardRepository'

const SEVERITY_TONE = { ERROR: 'red', WARNING: 'amber', INFO: 'slate' } as const
const SEVERITIES = ['ERROR', 'WARNING', 'INFO'] as const

export default async function AuditRunPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string; projectId: string; runId: string }>
  searchParams: Promise<{ severity?: string; target?: string }>
}) {
  const { locale, projectId, runId } = await params
  const { severity, target } = await searchParams
  await requireProjectAccess(projectId)
  const appLocale = locale as AppLocale

  const run = await prisma.auditRun.findFirst({
    where: { id: runId, projectId },
    include: { apiToken: { select: { name: true } } },
  })
  if (!run) notFound()

  const where: Prisma.AuditFindingWhereInput = { runId }
  if (SEVERITIES.includes(severity as (typeof SEVERITIES)[number])) {
    where.severity = severity as (typeof SEVERITIES)[number]
  }
  if (target) where.target = target

  const [findings, targets, loaded] = await Promise.all([
    prisma.auditFinding.findMany({
      where,
      orderBy: [{ severity: 'asc' }, { target: 'asc' }, { elementName: 'asc' }],
      take: 2000,
    }),
    prisma.auditFinding.findMany({ where: { runId }, distinct: ['target'], select: { target: true } }),
    loadStandard(projectId),
  ])

  const t = await getTranslations({ locale, namespace: 'quality' })
  const targetsT = await getTranslations({ locale, namespace: 'auditTarget' })
  const render = await createFindingRenderer(appLocale, loaded?.conventions ?? [])

  const metadata = (run.metadata ?? {}) as {
    summary?: AuditSummary
    revitVersion?: string | null
    truncated?: boolean
    findingsTotal?: number
  }
  const summary = metadata.summary

  const filterHref = (next: { severity?: string; target?: string }) => {
    const query = new URLSearchParams()
    const s = 'severity' in next ? next.severity : severity
    const g = 'target' in next ? next.target : target
    if (s) query.set('severity', s)
    if (g) query.set('target', g)
    const text = query.toString()
    return `/p/${projectId}/quality/${runId}${text ? `?${text}` : ''}`
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={run.modelName}
        subtitle={`${new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeStyle: 'short' }).format(run.startedAt)} · Revit ${metadata.revitVersion ?? '—'} · ${t('ruleSet')} v${run.ruleSetVersion ?? '—'}${run.apiToken ? ` · ${run.apiToken.name}` : ''}`}
        actions={
          <Link href={`/p/${projectId}/quality`} className="btn-secondary text-xs">
            {t('allRuns')}
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label={t('checked')} value={run.totalChecked} />
        <Stat label={t('severity.ERROR')} value={run.errorCount} />
        <Stat label={t('severity.WARNING')} value={run.warningCount} />
        <Stat label={t('severity.INFO')} value={run.infoCount} />
      </div>

      {metadata.truncated ? (
        <Card>
          <p className="text-sm text-amber-700 dark:text-amber-300">
            {t('truncated', { total: metadata.findingsTotal ?? 0 })}
          </p>
        </Card>
      ) : null}

      {summary && summary.uncheckedTargets.length > 0 ? (
        <Card>
          <p className="text-sm">
            {t('uncheckedTargets', {
              targets: summary.uncheckedTargets.map((entry) => targetsT(entry)).join(', '),
            })}
          </p>
        </Card>
      ) : null}

      {summary ? (
        <SectionCard title={t('byTarget')}>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('target')}</th>
                  <th className="text-right">{t('checked')}</th>
                  <th className="text-right">{t('severity.ERROR')}</th>
                  <th className="text-right">{t('severity.WARNING')}</th>
                  <th className="text-right">{t('severity.INFO')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(summary.byTarget)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([key, entry]) => (
                    <tr key={key}>
                      <td>
                        <Link href={filterHref({ target: key })} className="text-brand-600 hover:underline">
                          {targetsT(key)}
                        </Link>
                      </td>
                      <td className="text-right tabular-nums">
                        {entry.checked}
                        {entry.unchecked > 0 ? (
                          <span className="muted"> (+{entry.unchecked} {t('notChecked')})</span>
                        ) : null}
                      </td>
                      <td className="text-right tabular-nums">{entry.errors}</td>
                      <td className="text-right tabular-nums">{entry.warnings}</td>
                      <td className="text-right tabular-nums">{entry.infos}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title={t('findings')}>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <Link href={filterHref({ severity: undefined })} className={severity ? 'btn-ghost text-xs' : 'btn-secondary text-xs'}>
            {t('all')}
          </Link>
          {SEVERITIES.map((entry) => (
            <Link
              key={entry}
              href={filterHref({ severity: entry })}
              className={severity === entry ? 'btn-secondary text-xs' : 'btn-ghost text-xs'}
            >
              {t(`severity.${entry}`)}
            </Link>
          ))}
          <span className="muted mx-2">·</span>
          <Link href={filterHref({ target: undefined })} className={target ? 'btn-ghost text-xs' : 'btn-secondary text-xs'}>
            {t('allTargets')}
          </Link>
          {targets
            .map((entry) => entry.target)
            .filter((entry): entry is string => Boolean(entry))
            .sort()
            .map((entry) => (
              <Link
                key={entry}
                href={filterHref({ target: entry })}
                className={target === entry ? 'btn-secondary text-xs' : 'btn-ghost text-xs'}
              >
                {targetsT(entry)}
              </Link>
            ))}
        </div>

        {findings.length === 0 ? (
          <EmptyState>{t('noFindings')}</EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th className="w-24">{t('severityLabel')}</th>
                  <th>{t('target')}</th>
                  <th>{t('element')}</th>
                  <th>{t('message')}</th>
                </tr>
              </thead>
              <tbody>
                {findings.map((finding) => {
                  const rendered = render({ ...finding, params: finding.params })
                  return (
                    <tr key={finding.id}>
                      <td>
                        <Badge tone={SEVERITY_TONE[finding.severity]}>{t(`severity.${finding.severity}`)}</Badge>
                      </td>
                      <td className="text-xs">{finding.target ? targetsT(finding.target) : '—'}</td>
                      <td>
                        <span className="font-mono text-xs">{finding.elementName ?? '—'}</span>
                        {finding.elementId ? <p className="muted text-[11px]">ID {finding.elementId}</p> : null}
                      </td>
                      <td className="text-sm">
                        {rendered.message}
                        {rendered.details.length > 0 ? (
                          <ul className="muted mt-1 list-disc space-y-0.5 pl-4 text-xs">
                            {rendered.details.map((line, index) => (
                              <li key={index}>{line}</li>
                            ))}
                          </ul>
                        ) : null}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

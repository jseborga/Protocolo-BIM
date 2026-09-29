import { getTranslations } from 'next-intl/server'
import { Badge, Card, PageHeader } from '@/components/ui'
import { Link } from '@/i18n/navigation'
import { prisma } from '@/lib/prisma'
import { requireProjectAccess } from '@/server/authz'

export default async function QualityPage({
  params,
}: {
  params: Promise<{ locale: string; projectId: string }>
}) {
  const { locale, projectId } = await params
  const access = await requireProjectAccess(projectId)

  const t = await getTranslations({ locale, namespace: 'quality' })

  const runs = await prisma.auditRun.findMany({
    where: { projectId },
    orderBy: { startedAt: 'desc' },
    take: 100,
    include: { apiToken: { select: { name: true } } },
  })

  const format = (value: Date) =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(value)

  return (
    <div className="space-y-6">
      <PageHeader title={t('title')} subtitle={t('subtitle')} />

      {runs.length === 0 ? (
        <Card className="max-w-2xl space-y-3">
          <p className="text-sm">{t('empty')}</p>
          <ol className="muted list-decimal space-y-1 pl-5 text-sm">
            <li>{t('emptyStep1')}</li>
            <li>{t('emptyStep2')}</li>
            <li>{t('emptyStep3')}</li>
          </ol>
          {access.can('settings:manage') ? (
            <Link href={`/p/${projectId}/settings`} className="btn-secondary text-xs">
              {t('createToken')}
            </Link>
          ) : null}
        </Card>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>{t('date')}</th>
                <th>{t('model')}</th>
                <th>{t('ruleSet')}</th>
                <th className="text-right">{t('checked')}</th>
                <th>{t('result')}</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => {
                const metadata = (run.metadata ?? {}) as { revitVersion?: string | null }
                return (
                  <tr key={run.id}>
                    <td className="whitespace-nowrap text-xs">
                      <Link
                        href={`/p/${projectId}/quality/${run.id}`}
                        className="text-brand-600 hover:underline"
                      >
                        {format(run.startedAt)}
                      </Link>
                    </td>
                    <td>
                      <span className="font-mono text-xs">{run.modelName}</span>
                      <p className="muted text-xs">
                        Revit {metadata.revitVersion ?? '—'}
                        {run.apiToken ? ` · ${run.apiToken.name}` : ''}
                      </p>
                    </td>
                    <td className="font-mono text-xs">v{run.ruleSetVersion ?? '—'}</td>
                    <td className="text-right tabular-nums text-sm">{run.totalChecked}</td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {run.errorCount > 0 ? (
                          <Badge tone="red">{t('errorsCount', { count: run.errorCount })}</Badge>
                        ) : (
                          <Badge tone="green">{t('noErrors')}</Badge>
                        )}
                        {run.warningCount > 0 ? (
                          <Badge tone="amber">{t('warningsCount', { count: run.warningCount })}</Badge>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

import { getTranslations } from 'next-intl/server'
import { Badge, EmptyState, PageHeader } from '@/components/ui'
import { Link } from '@/i18n/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/server/auth'

export default async function ProjectsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const user = (await getCurrentUser())!
  const t = await getTranslations({ locale, namespace: 'projects' })
  const statusLabels = await getTranslations({ locale, namespace: 'projectStatus' })
  const dashboard = await getTranslations({ locale, namespace: 'dashboard' })

  const orgIds = user.memberships.map((membership) => membership.orgId)
  const projects = await prisma.project.findMany({
    where: {
      OR: [{ orgId: { in: orgIds } }, { members: { some: { userId: user.id } } }],
    },
    include: {
      org: true,
      _count: { select: { members: true } },
      protocols: { orderBy: { createdAt: 'desc' }, take: 1 },
    },
    orderBy: { updatedAt: 'desc' },
  })

  const statusTone = {
    PLANNING: 'amber',
    ACTIVE: 'green',
    ON_HOLD: 'slate',
    CLOSED: 'neutral',
  } as const

  return (
    <>
      <PageHeader
        title={t('title')}
        subtitle={user.memberships[0] ? t('subtitle', { org: user.memberships[0].org.name }) : undefined}
        actions={
          <Link href="/projects/new" className="btn-primary">
            {t('new')}
          </Link>
        }
      />

      {projects.length === 0 ? (
        <EmptyState>{t('empty')}</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <Link
              key={project.id}
              href={`/p/${project.id}`}
              className="card block p-5 transition-colors hover:border-brand-500"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-xs font-semibold text-brand-600">{project.code}</span>
                <Badge tone={statusTone[project.status]}>{statusLabels(project.status)}</Badge>
              </div>
              <h2 className="mt-2 font-semibold leading-snug">{project.name}</h2>
              <p className="muted mt-1 line-clamp-2 text-sm">{project.description}</p>
              <p className="muted mt-4 flex flex-wrap items-center gap-x-2 text-xs">
                <span>{project.org.name}</span>
                <span aria-hidden>·</span>
                <span>
                  {project._count.members} {dashboard('members').toLowerCase()}
                </span>
                {project.protocols[0] ? (
                  <>
                    <span aria-hidden>·</span>
                    <span className="font-mono">v{project.protocols[0].versionLabel}</span>
                  </>
                ) : null}
              </p>
            </Link>
          ))}
        </div>
      )}
    </>
  )
}

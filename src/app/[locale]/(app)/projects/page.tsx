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

  // The same rule `canAccessProject` applies, expressed as a query: projects
  // the user is on, plus those their organisation lets them reach. Listing
  // every project of every organisation they belong to would leak the ones
  // deliberately closed to the rest of the company.
  const administeredOrgIds = user.memberships
    .filter((membership) => membership.role === 'OWNER' || membership.role === 'ADMIN')
    .map((membership) => membership.orgId)
  const memberOrgIds = user.memberships
    .filter((membership) => membership.role === 'MEMBER')
    .map((membership) => membership.orgId)

  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { members: { some: { userId: user.id } } },
        { orgId: { in: administeredOrgIds } },
        { orgId: { in: memberOrgIds }, visibility: 'ORGANISATION' },
      ],
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
        subtitle={
          user.memberships[0] ? t('subtitle', { org: user.memberships[0].org.name }) : undefined
        }
        actions={
          // Creating a project needs an organisation to own it; an account that
          // only ever gets invited to other people's projects has none.
          user.memberships.length > 0 ? (
            <Link href="/projects/new" className="btn-primary">
              {t('new')}
            </Link>
          ) : null
        }
      />

      {user.memberships.length === 0 ? (
        <p className="muted mb-6 rounded-lg border border-dashed border-[color:var(--border)] px-4 py-3 text-sm">
          {t('noOrganisation')}
        </p>
      ) : null}

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

import { getTranslations } from 'next-intl/server'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui'
import { Link } from '@/i18n/navigation'
import { requireProjectAccess } from '@/server/authz'
import { ProjectNav } from './ProjectNav'

export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string; projectId: string }>
}) {
  const { locale, projectId } = await params
  const { project } = await requireProjectAccess(projectId)
  const statusLabels = await getTranslations({ locale, namespace: 'projectStatus' })

  const tone = { PLANNING: 'amber', ACTIVE: 'green', ON_HOLD: 'slate', CLOSED: 'neutral' } as const

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center gap-3">
        <Link href="/projects" className="muted text-xs hover:underline">
          {project.org.name}
        </Link>
        <span className="muted text-xs" aria-hidden>
          /
        </span>
        <span className="font-mono text-xs font-semibold text-brand-600">{project.code}</span>
        <Badge tone={tone[project.status]}>{statusLabels(project.status)}</Badge>
      </div>
      <h1 className="mb-4 text-xl font-semibold tracking-tight">{project.name}</h1>

      <ProjectNav projectId={projectId} />

      <div className="pt-6">{children}</div>
    </div>
  )
}

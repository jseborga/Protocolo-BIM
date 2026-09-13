import 'server-only'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { getCurrentUser, type CurrentUser } from '@/server/auth'
import { type Ability, abilitiesFor, type AccessContext, canAccessProject } from './abilities'

export * from './abilities'

export class ForbiddenError extends Error {
  constructor(readonly ability: Ability) {
    super(`Missing ability: ${ability}`)
    this.name = 'ForbiddenError'
  }
}

async function loadProject(projectId: string) {
  return prisma.project.findUnique({
    where: { id: projectId },
    include: { org: true, client: true },
  })
}

export interface ProjectAccess {
  user: CurrentUser
  project: NonNullable<Awaited<ReturnType<typeof loadProject>>>
  context: AccessContext
  abilities: Set<Ability>
  can: (ability: Ability) => boolean
  /** Throws `ForbiddenError` when the ability is missing. */
  require: (ability: Ability) => void
}

/**
 * Resolve the current user's access to a project, or null when there is none.
 *
 * Route handlers use this to answer with a status code; pages use
 * `requireProjectAccess`, which turns the same "no access" into a 404.
 */
export async function resolveProjectAccess(projectId: string): Promise<ProjectAccess | null> {
  const user = await getCurrentUser()
  if (!user) return null

  const project = await loadProject(projectId)
  if (!project) return null

  const membership = user.memberships.find((entry) => entry.orgId === project.orgId) ?? null
  const projectMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.id } },
  })

  const context: AccessContext = {
    orgRole: membership?.role ?? null,
    projectRole: projectMember?.role ?? null,
    visibility: project.visibility,
  }

  if (!canAccessProject(context)) return null

  const abilities = abilitiesFor(context)
  return {
    user,
    project,
    context,
    abilities,
    can: (ability) => abilities.has(ability),
    require: (ability) => {
      if (!abilities.has(ability)) throw new ForbiddenError(ability)
    },
  }
}

/**
 * Page-level guard. A missing project and a forbidden one both surface as
 * "not found", so the app never confirms the existence of another
 * organisation's project.
 */
export async function requireProjectAccess(projectId: string): Promise<ProjectAccess> {
  const access = await resolveProjectAccess(projectId)
  if (!access) notFound()
  return access
}

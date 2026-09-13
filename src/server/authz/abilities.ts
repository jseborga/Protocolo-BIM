import type { OrgRole, ProjectRole, ProjectVisibility } from '@prisma/client'

/**
 * Everything a user can attempt inside a project. Kept as a closed union so a
 * new permission cannot be introduced without deciding who gets it.
 */
export type Ability =
  | 'project:view'
  | 'project:manage'
  | 'team:manage'
  | 'protocol:edit'
  | 'protocol:review'
  | 'protocol:approve'
  | 'protocol:createVersion'
  | 'naming:edit'
  | 'comment:create'
  | 'comment:resolve'
  | 'settings:manage'

const ALL: Ability[] = [
  'project:view',
  'project:manage',
  'team:manage',
  'protocol:edit',
  'protocol:review',
  'protocol:approve',
  'protocol:createVersion',
  'naming:edit',
  'comment:create',
  'comment:resolve',
  'settings:manage',
]

/**
 * ISO 19650 project responsibilities mapped to app permissions.
 *
 * The information manager and the BIM manager are the only roles that can
 * approve a protocol version; coordinators author it, modellers and clients
 * read and comment.
 */
const PROJECT_ROLE_ABILITIES: Record<ProjectRole, Ability[]> = {
  INFORMATION_MANAGER: ALL,
  BIM_MANAGER: [
    'project:view',
    'project:manage',
    'team:manage',
    'protocol:edit',
    'protocol:review',
    'protocol:approve',
    'protocol:createVersion',
    'naming:edit',
    'comment:create',
    'comment:resolve',
    'settings:manage',
  ],
  BIM_COORDINATOR: [
    'project:view',
    'protocol:edit',
    'protocol:review',
    'protocol:createVersion',
    'naming:edit',
    'comment:create',
    'comment:resolve',
  ],
  BIM_MODELLER: ['project:view', 'comment:create'],
  REVIEWER: ['project:view', 'protocol:review', 'comment:create', 'comment:resolve'],
  CLIENT: ['project:view', 'protocol:review', 'comment:create'],
  VIEWER: ['project:view'],
}

/** Organisation owners and admins get full control over their own projects. */
const ORG_ROLE_ABILITIES: Record<OrgRole, Ability[]> = {
  OWNER: ALL,
  ADMIN: ALL,
  MEMBER: [],
}

export interface AccessContext {
  /** Organisation role, when the user belongs to the project's organisation. */
  orgRole: OrgRole | null
  /** Project role, when the user is a member of the project. */
  projectRole: ProjectRole | null
  /** How open the project is to the rest of its organisation. */
  visibility?: ProjectVisibility
}

export function abilitiesFor(context: AccessContext): Set<Ability> {
  const abilities = new Set<Ability>()
  if (context.orgRole) for (const ability of ORG_ROLE_ABILITIES[context.orgRole]) abilities.add(ability)
  if (context.projectRole)
    for (const ability of PROJECT_ROLE_ABILITIES[context.projectRole]) abilities.add(ability)
  return abilities
}

export function can(context: AccessContext, ability: Ability): boolean {
  return abilitiesFor(context).has(ability)
}

/**
 * Who may open a project at all.
 *
 * Membership of the project is the unit of access, and it stands on its own:
 * an appointed party from another company is added to the project without ever
 * joining the owning organisation, and therefore sees nothing else of it. That
 * is what makes a delivery team able to span companies.
 *
 * On top of that, an organisation's owners and admins reach every project they
 * are responsible for, and ordinary colleagues reach the ones left open to the
 * organisation, so internal staff are not locked out of their own work.
 */
export function canAccessProject(context: AccessContext): boolean {
  if (context.projectRole !== null) return true
  if (context.orgRole === 'OWNER' || context.orgRole === 'ADMIN') return true
  return context.orgRole !== null && (context.visibility ?? 'ORGANISATION') === 'ORGANISATION'
}

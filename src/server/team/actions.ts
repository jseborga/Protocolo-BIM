'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { AppLocale } from '@/i18n/routing'
import { prisma } from '@/lib/prisma'
import { requireProjectAccess } from '@/server/authz'

export interface TeamActionState {
  /** Translation key under the `team` namespace. */
  error?: string
  ok?: boolean
}

const PROJECT_ROLES = [
  'INFORMATION_MANAGER',
  'BIM_MANAGER',
  'BIM_COORDINATOR',
  'BIM_MODELLER',
  'REVIEWER',
  'CLIENT',
  'VIEWER',
] as const

function revalidate(locale: AppLocale, projectId: string) {
  revalidatePath(`/${locale}/p/${projectId}/team`)
  revalidatePath(`/${locale}/p/${projectId}/protocol`)
}

async function guard(projectId: string) {
  const access = await requireProjectAccess(projectId)
  return access.can('team:manage') ? access : null
}

export async function removeMemberAction(
  locale: AppLocale,
  projectId: string,
  memberId: string,
): Promise<void> {
  const access = await guard(projectId)
  if (!access) return

  // Never leave a project without anyone able to approve its protocol.
  const member = await prisma.projectMember.findFirst({ where: { id: memberId, projectId } })
  if (!member) return
  if (member.role === 'INFORMATION_MANAGER') {
    const managers = await prisma.projectMember.count({
      where: { projectId, role: 'INFORMATION_MANAGER' },
    })
    if (managers <= 1) return
  }

  await prisma.projectMember.delete({ where: { id: memberId } })
  revalidate(locale, projectId)
}

export async function addPartyAction(
  locale: AppLocale,
  projectId: string,
  _previous: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const access = await guard(projectId)
  if (!access) return { error: 'memberNotFound' }

  const parsed = z
    .object({
      name: z.string().trim().min(2).max(160),
      type: z.enum(['APPOINTING', 'LEAD_APPOINTED', 'APPOINTED']),
      code: z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z0-9]{2,6}$/u)
        .nullable(),
      disciplineId: z.string().nullable(),
      contactName: z.string().max(120).nullable(),
      contactEmail: z.union([z.string().email(), z.literal('')]).nullable(),
    })
    .safeParse({
      name: String(formData.get('name') ?? ''),
      type: String(formData.get('type') ?? 'APPOINTED'),
      code: String(formData.get('code') ?? '').trim() || null,
      disciplineId: String(formData.get('disciplineId') ?? '') || null,
      contactName: String(formData.get('contactName') ?? '') || null,
      contactEmail: String(formData.get('contactEmail') ?? '') || null,
    })
  if (!parsed.success) return { error: 'memberNotFound' }

  await prisma.party.create({
    data: {
      projectId,
      name: parsed.data.name,
      type: parsed.data.type,
      code: parsed.data.code,
      disciplineId: parsed.data.disciplineId,
      contactName: parsed.data.contactName,
      contactEmail: parsed.data.contactEmail || null,
    },
  })

  // A new originator code belongs in the naming table the file convention uses.
  if (parsed.data.code) {
    const table = await prisma.codeTable.findUnique({
      where: { projectId_key: { projectId, key: 'ORIGINATOR' } },
      include: { _count: { select: { values: true } } },
    })
    if (table) {
      await prisma.codeValue.upsert({
        where: { tableId_code: { tableId: table.id, code: parsed.data.code } },
        update: {},
        create: {
          tableId: table.id,
          code: parsed.data.code,
          order: table._count.values,
          labels: { es: parsed.data.name, en: parsed.data.name, pt: parsed.data.name },
        },
      })
      revalidatePath(`/${locale}/p/${projectId}/naming`)
    }
  }

  revalidate(locale, projectId)
  return { ok: true }
}

export async function addSoftwareAction(
  locale: AppLocale,
  projectId: string,
  _previous: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const access = await guard(projectId)
  if (!access) return { error: 'memberNotFound' }

  const name = String(formData.get('name') ?? '').trim()
  if (name === '' || name.length > 120) return { error: 'memberNotFound' }

  const count = await prisma.softwareTool.count({ where: { projectId } })
  await prisma.softwareTool.create({
    data: {
      projectId,
      name,
      version: String(formData.get('version') ?? '').trim() || null,
      purpose: String(formData.get('purpose') ?? '').trim() || null,
      nativeFormat: String(formData.get('nativeFormat') ?? '').trim() || null,
      exchangeFormat: String(formData.get('exchangeFormat') ?? '').trim() || null,
      disciplineId: String(formData.get('disciplineId') ?? '') || null,
      order: count,
    },
  })

  revalidate(locale, projectId)
  return { ok: true }
}

export async function removeSoftwareAction(
  locale: AppLocale,
  projectId: string,
  toolId: string,
): Promise<void> {
  const access = await guard(projectId)
  if (!access) return
  await prisma.softwareTool.deleteMany({ where: { id: toolId, projectId } })
  revalidate(locale, projectId)
}

/**
 * Save the whole RACI matrix at once.
 *
 * Field names arrive as `raci:<activityId>:<role>` with a letter or an empty
 * value, so one submit replaces the grid rather than needing a request per cell.
 */
export async function saveRaciAction(
  locale: AppLocale,
  projectId: string,
  _previous: TeamActionState,
  formData: FormData,
): Promise<TeamActionState> {
  const access = await guard(projectId)
  if (!access) return { error: 'memberNotFound' }

  const activities = await prisma.raciActivity.findMany({
    where: { projectId },
    select: { id: true },
  })
  const known = new Set(activities.map((activity) => activity.id))

  const entries: Array<{ activityId: string; projectRole: string; letter: string }> = []
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith('raci:')) continue
    const [, activityId, role] = key.split(':')
    const letter = String(value)
    if (!activityId || !role || !known.has(activityId)) continue
    if (!['R', 'A', 'C', 'I'].includes(letter)) continue
    if (!PROJECT_ROLES.includes(role as (typeof PROJECT_ROLES)[number])) continue
    entries.push({ activityId, projectRole: role, letter })
  }

  await prisma.$transaction([
    prisma.raciAssignment.deleteMany({ where: { activity: { projectId } } }),
    prisma.raciAssignment.createMany({
      data: entries.map((entry) => ({
        activityId: entry.activityId,
        projectRole: entry.projectRole as (typeof PROJECT_ROLES)[number],
        letter: entry.letter as 'R' | 'A' | 'C' | 'I',
      })),
    }),
  ])

  revalidate(locale, projectId)
  return { ok: true }
}

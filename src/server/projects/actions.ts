'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { redirect } from '@/i18n/navigation'
import { appLocaleToDb, type AppLocale } from '@/i18n/routing'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/server/auth'
import { provisionProject } from '@/server/protocol'

export interface ProjectFormState {
  /** Translation key under the `projects` namespace. */
  error?: string
}

const createSchema = z.object({
  orgId: z.string().min(1),
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/u),
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).optional(),
  baseLocale: z.enum(['es', 'en', 'pt']),
  enabledLocales: z.array(z.enum(['es', 'en', 'pt'])).min(1),
  country: z.string().trim().max(80).optional(),
  city: z.string().trim().max(80).optional(),
  clientLegalName: z.string().trim().max(160).optional(),
})

export async function createProjectAction(
  locale: AppLocale,
  _previous: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const user = await getCurrentUser()
  if (!user) return { error: 'codeInvalid' }

  const enabled = formData.getAll('enabledLocales').map(String)
  const baseLocale = String(formData.get('baseLocale') ?? locale)

  const parsed = createSchema.safeParse({
    orgId: String(formData.get('orgId') ?? ''),
    code: String(formData.get('code') ?? ''),
    name: String(formData.get('name') ?? ''),
    description: String(formData.get('description') ?? '') || undefined,
    baseLocale,
    // The base language is always part of the project, whatever the checkboxes say.
    enabledLocales: [...new Set([baseLocale, ...enabled])],
    country: String(formData.get('country') ?? '') || undefined,
    city: String(formData.get('city') ?? '') || undefined,
    clientLegalName: String(formData.get('clientLegalName') ?? '') || undefined,
  })

  if (!parsed.success) return { error: 'codeInvalid' }

  // Only members of the organisation may create projects inside it.
  const membership = user.memberships.find((entry) => entry.orgId === parsed.data.orgId)
  if (!membership) return { error: 'codeInvalid' }

  const duplicate = await prisma.project.findUnique({
    where: { orgId_code: { orgId: parsed.data.orgId, code: parsed.data.code } },
  })
  if (duplicate) return { error: 'codeTaken' }

  const dbBase = appLocaleToDb[parsed.data.baseLocale]
  const dbEnabled = parsed.data.enabledLocales.map((entry) => appLocaleToDb[entry])

  const projectId = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        orgId: parsed.data.orgId,
        code: parsed.data.code,
        name: parsed.data.name,
        description: parsed.data.description,
        baseLocale: dbBase,
        enabledLocales: dbEnabled,
        country: parsed.data.country,
        city: parsed.data.city,
        client: parsed.data.clientLegalName
          ? { create: { legalName: parsed.data.clientLegalName } }
          : undefined,
      },
    })

    // The creator runs the project's information management until told otherwise.
    await tx.projectMember.create({
      data: {
        projectId: project.id,
        userId: user.id,
        role: 'INFORMATION_MANAGER',
        jobTitle: user.jobTitle,
      },
    })

    await provisionProject(tx, {
      projectId: project.id,
      projectCode: project.code,
      organisationName: membership.org.name,
      baseLocale: dbBase,
      enabledLocales: dbEnabled,
      createdById: user.id,
    })

    await tx.auditLog.create({
      data: {
        orgId: project.orgId,
        projectId: project.id,
        userId: user.id,
        entity: 'Project',
        entityId: project.id,
        action: 'CREATE',
        diff: { code: project.code, name: project.name },
      },
    })

    return project.id
  })

  revalidatePath(`/${locale}/projects`)
  redirect({ href: `/p/${projectId}`, locale })
  // `redirect` throws; this satisfies the declared return type.
  return {}
}

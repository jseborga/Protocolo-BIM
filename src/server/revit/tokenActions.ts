'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { AppLocale } from '@/i18n/locales'
import { prisma } from '@/lib/prisma'
import { requireProjectAccess } from '@/server/authz'
import { generateToken, TOKEN_SCOPES } from './tokens'

export interface TokenFormState {
  /** Translation key under the `apiTokens` namespace. */
  error?: string
  /** The plain token, returned exactly once. */
  token?: string
}

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  expiresInDays: z.union([z.literal(0), z.literal(30), z.literal(90), z.literal(365)]),
  scopes: z.array(z.enum(TOKEN_SCOPES)).min(1),
})

export async function createApiTokenAction(
  locale: AppLocale,
  projectId: string,
  _previous: TokenFormState,
  formData: FormData,
): Promise<TokenFormState> {
  const access = await requireProjectAccess(projectId)
  if (!access.can('settings:manage')) return { error: 'notAllowed' }

  const parsed = schema.safeParse({
    name: String(formData.get('name') ?? ''),
    expiresInDays: Number(formData.get('expiresInDays') ?? 0),
    scopes: formData.getAll('scopes').map(String),
  })
  if (!parsed.success) return { error: 'invalid' }

  const { token, prefix, hash } = generateToken()
  await prisma.apiToken.create({
    data: {
      projectId,
      name: parsed.data.name,
      prefix,
      tokenHash: hash,
      scopes: parsed.data.scopes,
      createdById: access.user.id,
      expiresAt:
        parsed.data.expiresInDays > 0
          ? new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000)
          : null,
    },
  })

  await prisma.auditLog.create({
    data: {
      orgId: access.project.orgId,
      projectId,
      userId: access.user.id,
      entity: 'ApiToken',
      action: 'CREATE',
      diff: { name: parsed.data.name, prefix, scopes: parsed.data.scopes },
    },
  })

  revalidatePath(`/${locale}/p/${projectId}/settings`)
  // Shown once and never again: only its hash is stored.
  return { token }
}

export async function revokeApiTokenAction(
  locale: AppLocale,
  projectId: string,
  tokenId: string,
): Promise<void> {
  const access = await requireProjectAccess(projectId)
  if (!access.can('settings:manage')) return

  const updated = await prisma.apiToken.updateMany({
    where: { id: tokenId, projectId, revokedAt: null },
    data: { revokedAt: new Date() },
  })

  if (updated.count > 0) {
    await prisma.auditLog.create({
      data: {
        orgId: access.project.orgId,
        projectId,
        userId: access.user.id,
        entity: 'ApiToken',
        entityId: tokenId,
        action: 'REVOKE',
      },
    })
  }
  revalidatePath(`/${locale}/p/${projectId}/settings`)
}

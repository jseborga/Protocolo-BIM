'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { redirect } from '@/i18n/navigation'
import { appLocaleToDb, type AppLocale } from '@/i18n/routing'
import { prisma } from '@/lib/prisma'
import { createSession, destroySession, hashPassword, verifyPassword } from '@/server/auth'

export interface AuthFormState {
  /** Translation key under the `auth` namespace. */
  error?: string
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const registerSchema = z.object({
  name: z.string().trim().min(2),
  orgName: z.string().trim().min(2),
  email: z.string().email(),
  password: z.string().min(8),
})

function slugify(value: string): string {
  return (
    value
      .normalize('NFD')
      .replace(/[̀-ͯ]/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/gu, '-')
      .replace(/^-+|-+$/gu, '')
      .slice(0, 40) || 'org'
  )
}

async function requestMeta() {
  const store = await headers()
  return {
    userAgent: store.get('user-agent')?.slice(0, 250) ?? undefined,
    ip: store.get('x-forwarded-for')?.split(',')[0]?.trim() ?? undefined,
  }
}

export async function loginAction(
  locale: AppLocale,
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = loginSchema.safeParse({
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    password: String(formData.get('password') ?? ''),
  })
  if (!parsed.success) return { error: 'invalidCredentials' }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  // Always run the hash comparison so a missing account and a wrong password
  // take the same amount of time.
  const placeholder = '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv'
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? placeholder)
  if (!user || !ok || !user.isActive) return { error: 'invalidCredentials' }

  await createSession(user.id, await requestMeta())
  redirect({ href: '/projects', locale })
  // `redirect` throws; this satisfies the declared return type.
  return {}
}

export async function registerAction(
  locale: AppLocale,
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const raw = {
    name: String(formData.get('name') ?? ''),
    orgName: String(formData.get('orgName') ?? ''),
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    password: String(formData.get('password') ?? ''),
  }

  const parsed = registerSchema.safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path[0]
    if (field === 'password') return { error: 'passwordTooShort' }
    if (field === 'email') return { error: 'invalidEmail' }
    if (field === 'orgName') return { error: 'orgRequired' }
    return { error: 'nameRequired' }
  }

  const existing = await prisma.user.findUnique({ where: { email: parsed.data.email } })
  if (existing) return { error: 'emailTaken' }

  const passwordHash = await hashPassword(parsed.data.password)

  // A unique slug per organisation; suffix only when the obvious one is taken.
  let slug = slugify(parsed.data.orgName)
  for (let attempt = 1; await prisma.organization.findUnique({ where: { slug } }); attempt += 1) {
    slug = `${slugify(parsed.data.orgName)}-${attempt}`
  }

  const user = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: { slug, name: parsed.data.orgName, defaultLocale: appLocaleToDb[locale] },
    })
    return tx.user.create({
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        passwordHash,
        locale: appLocaleToDb[locale],
        memberships: { create: { orgId: org.id, role: 'OWNER' } },
      },
    })
  })

  await createSession(user.id, await requestMeta())
  redirect({ href: '/projects', locale })
  // `redirect` throws; this satisfies the declared return type.
  return {}
}

export async function logoutAction(locale: AppLocale): Promise<void> {
  await destroySession()
  redirect({ href: '/', locale })
}

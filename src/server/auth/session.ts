import 'server-only'
import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'

export const SESSION_COOKIE = 'pbim_session'
const SESSION_DAYS = 30

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

/**
 * Issue a session. The raw token lives only in the HttpOnly cookie; the
 * database keeps its SHA-256 hash, so a database leak does not hand out
 * usable sessions.
 */
export async function createSession(userId: string, meta?: { userAgent?: string; ip?: string }) {
  const token = crypto.randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000)

  await prisma.session.create({
    data: { userId, tokenHash: hashToken(token), expiresAt, ...meta },
  })

  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })
}

export async function destroySession(): Promise<void> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (token) {
    await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } })
  }
  store.delete(SESSION_COOKIE)
}

/** Current user, or null. Cached per request so layouts and pages share one query. */
export const getCurrentUser = cache(async () => {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        include: {
          memberships: { include: { org: true }, orderBy: { createdAt: 'asc' } },
        },
      },
    },
  })

  if (!session || session.expiresAt < new Date() || !session.user.isActive) return null
  return session.user
})

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>

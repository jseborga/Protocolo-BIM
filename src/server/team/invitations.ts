'use server'

import crypto from 'node:crypto'
import type { ProjectRole } from '@prisma/client'
import { getTranslations } from 'next-intl/server'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { AppLocale } from '@/i18n/locales'
import { appUrl } from '@/lib/app-url'
import { prisma } from '@/lib/prisma'
import { getCurrentUser } from '@/server/auth'
import { requireProjectAccess } from '@/server/authz'
import { sendMail } from '@/server/mail'
import { invitationEmail } from '@/server/mail/templates'

const INVITATION_DAYS = 14

export interface InviteState {
  /** Translation key under the `team` namespace. */
  error?: string
  /** Set when an existing colleague was added straight away. */
  added?: boolean
  /** Set when an invitation was created. */
  invited?: boolean
  /** Shown so the link can be passed on by hand when mail is not configured. */
  inviteUrl?: string
  emailDelivered?: boolean
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex')
}

function inviteUrlFor(locale: AppLocale, token: string): string {
  return `${appUrl()}/${locale}/invite/${token}`
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

const inviteSchema = z.object({
  email: z.string().email().max(200),
  role: z.enum(PROJECT_ROLES),
  disciplineId: z.string().nullable(),
  partyId: z.string().nullable(),
  jobTitle: z.string().max(120).nullable(),
})

function revalidate(locale: AppLocale, projectId: string) {
  revalidatePath(`/${locale}/p/${projectId}/team`)
  revalidatePath(`/${locale}/p/${projectId}`)
}

/**
 * Bring somebody onto a project.
 *
 * A colleague from the owning organisation is added straight away. Anybody
 * else — an appointed party from another company, or somebody with no account
 * at all — gets an invitation to this one project, and joining it never puts
 * them inside the organisation or shows them its other work.
 */
export async function inviteToProjectAction(
  locale: AppLocale,
  projectId: string,
  _previous: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const access = await requireProjectAccess(projectId)
  if (!access.can('team:manage')) return { error: 'notAllowed' }

  const parsed = inviteSchema.safeParse({
    email: String(formData.get('email') ?? '').trim().toLowerCase(),
    role: String(formData.get('role') ?? 'VIEWER'),
    disciplineId: String(formData.get('disciplineId') ?? '') || null,
    partyId: String(formData.get('partyId') ?? '') || null,
    jobTitle: String(formData.get('jobTitle') ?? '') || null,
  })
  if (!parsed.success) return { error: 'invalidEmail' }

  const { email, role, disciplineId, partyId, jobTitle } = parsed.data

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, memberships: { select: { orgId: true } } },
  })

  if (user) {
    const already = await prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId, userId: user.id } },
    })
    if (already) return { error: 'alreadyMember' }

    const inOrganisation = user.memberships.some(
      (membership) => membership.orgId === access.project.orgId,
    )

    if (inOrganisation) {
      await prisma.projectMember.create({
        data: { projectId, userId: user.id, role, disciplineId, partyId, jobTitle },
      })
      revalidate(locale, projectId)
      return { added: true }
    }
  }

  const pending = await prisma.projectInvitation.findFirst({
    where: { projectId, email, acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
  })
  if (pending) return { error: 'alreadyInvited' }

  const token = crypto.randomBytes(32).toString('base64url')

  await prisma.projectInvitation.create({
    data: {
      projectId,
      email,
      role,
      disciplineId,
      partyId,
      jobTitle,
      token: hashToken(token),
      expiresAt: new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000),
      invitedById: access.user.id,
    },
  })

  const url = inviteUrlFor(locale, token)
  const result = await sendInvitationEmail({
    locale,
    to: email,
    role,
    inviterName: access.user.name,
    projectName: access.project.name,
    projectCode: access.project.code,
    url,
  })

  revalidate(locale, projectId)

  // The raw token exists only here: the database keeps its hash, so the link
  // is offered once and a lost one is replaced rather than recovered.
  return { invited: true, inviteUrl: url, emailDelivered: result }
}

async function sendInvitationEmail(input: {
  locale: AppLocale
  to: string
  role: ProjectRole
  inviterName: string
  projectName: string
  projectCode: string
  url: string
}): Promise<boolean> {
  const t = await getTranslations({ locale: input.locale, namespace: 'invite' })
  const roles = await getTranslations({ locale: input.locale, namespace: 'projectRole' })

  const message = invitationEmail({
    to: input.to,
    inviterName: input.inviterName,
    projectName: input.projectName,
    projectCode: input.projectCode,
    roleLabel: roles(input.role),
    acceptUrl: input.url,
    strings: {
      subject: t('emailSubject', { project: input.projectName }),
      heading: t('emailHeading'),
      body: t('emailBody', { inviter: input.inviterName, project: input.projectName }),
      cta: t('accept'),
      ignore: t('emailIgnore'),
      expires: t('emailExpires', { days: INVITATION_DAYS }),
    },
  })

  const result = await sendMail(message)
  return result.delivered
}

/**
 * Issue a fresh link for a pending invitation.
 *
 * The database keeps only the hash of a token, so an existing link cannot be
 * read back. Rather than leave somebody stuck when the link is lost, this
 * replaces the token — which also invalidates whatever was sent before.
 */
export async function regenerateInvitationLinkAction(
  locale: AppLocale,
  projectId: string,
  invitationId: string,
): Promise<{ url?: string; error?: string }> {
  const access = await requireProjectAccess(projectId)
  if (!access.can('team:manage')) return { error: 'notAllowed' }

  const invitation = await prisma.projectInvitation.findFirst({
    where: { id: invitationId, projectId, acceptedAt: null, revokedAt: null },
  })
  if (!invitation) return { error: 'invalid' }

  const token = crypto.randomBytes(32).toString('base64url')
  await prisma.projectInvitation.update({
    where: { id: invitation.id },
    data: {
      token: hashToken(token),
      expiresAt: new Date(Date.now() + INVITATION_DAYS * 24 * 60 * 60 * 1000),
    },
  })

  revalidate(locale, projectId)
  return { url: inviteUrlFor(locale, token) }
}

export async function revokeInvitationAction(
  locale: AppLocale,
  projectId: string,
  invitationId: string,
): Promise<void> {
  const access = await requireProjectAccess(projectId)
  if (!access.can('team:manage')) return

  await prisma.projectInvitation.updateMany({
    where: { id: invitationId, projectId, acceptedAt: null },
    data: { revokedAt: new Date() },
  })
  revalidate(locale, projectId)
}

export interface AcceptState {
  /** Translation key under the `invite` namespace. */
  error?: string
  projectId?: string
}

/**
 * Accept an invitation.
 *
 * The address is checked against the signed-in account: the link is a bearer
 * token, so a forwarded one must not let somebody else onto the project.
 */
export async function acceptInvitationAction(
  locale: AppLocale,
  token: string,
): Promise<AcceptState> {
  const user = await getCurrentUser()
  if (!user) return { error: 'signInFirst' }

  const invitation = await prisma.projectInvitation.findUnique({
    where: { token: hashToken(token) },
    include: { project: { select: { id: true } } },
  })

  if (!invitation || invitation.revokedAt) return { error: 'invalid' }
  if (invitation.acceptedAt) return { error: 'alreadyAccepted' }
  if (invitation.expiresAt < new Date()) return { error: 'expired' }
  if (invitation.email.toLowerCase() !== user.email.toLowerCase()) {
    return { error: 'wrongAccount' }
  }

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: invitation.projectId, userId: user.id } },
  })

  await prisma.$transaction(async (tx) => {
    if (!existing) {
      await tx.projectMember.create({
        data: {
          projectId: invitation.projectId,
          userId: user.id,
          role: invitation.role,
          disciplineId: invitation.disciplineId,
          partyId: invitation.partyId,
          jobTitle: invitation.jobTitle,
        },
      })
    }

    await tx.projectInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date(), acceptedById: user.id },
    })

    // Following a link sent to that inbox proves control of the address.
    if (!user.emailVerified) {
      await tx.user.update({ where: { id: user.id }, data: { emailVerified: new Date() } })
    }

    await tx.auditLog.create({
      data: {
        projectId: invitation.projectId,
        userId: user.id,
        entity: 'ProjectInvitation',
        entityId: invitation.id,
        action: 'ACCEPT',
        diff: { role: invitation.role, email: invitation.email },
      },
    })
  })

  revalidatePath(`/${locale}/projects`)
  revalidate(locale, invitation.projectId)
  return { projectId: invitation.projectId }
}

/** Invitation details for the acceptance page, without exposing the token. */
export async function describeInvitation(token: string) {
  const invitation = await prisma.projectInvitation.findUnique({
    where: { token: hashToken(token) },
    include: {
      project: { select: { id: true, code: true, name: true, org: { select: { name: true } } } },
      invitedBy: { select: { name: true } },
    },
  })
  if (!invitation) return null

  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    projectCode: invitation.project.code,
    projectName: invitation.project.name,
    organisation: invitation.project.org.name,
    inviterName: invitation.invitedBy.name,
    expiresAt: invitation.expiresAt,
    isUsable: !invitation.revokedAt && !invitation.acceptedAt && invitation.expiresAt > new Date(),
    acceptedAt: invitation.acceptedAt,
    revokedAt: invitation.revokedAt,
  }
}

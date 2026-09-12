'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { appLocaleToDb, type AppLocale } from '@/i18n/routing'
import { prisma } from '@/lib/prisma'
import { ForbiddenError, requireProjectAccess } from '@/server/authz'
import { REQUIRED_SECTION_KEYS } from './template'

export interface ActionState {
  /** Translation key under the `protocol` namespace, or `errors.forbidden`. */
  error?: string
  ok?: boolean
  /** Names of the sections still missing when a review submission is refused. */
  sections?: string
}

function fail(error: string, extra: Partial<ActionState> = {}): ActionState {
  return { error, ...extra }
}

function revalidate(locale: AppLocale, projectId: string) {
  revalidatePath(`/${locale}/p/${projectId}/protocol`)
  revalidatePath(`/${locale}/p/${projectId}`)
}

const saveSchema = z.object({
  sectionId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  body: z.string().max(60_000),
})

export async function saveSectionAction(
  locale: AppLocale,
  projectId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await requireProjectAccess(projectId)
  try {
    access.require('protocol:edit')
  } catch (error) {
    if (error instanceof ForbiddenError) return fail('errors.forbidden')
    throw error
  }

  const parsed = saveSchema.safeParse({
    sectionId: String(formData.get('sectionId') ?? ''),
    title: String(formData.get('title') ?? ''),
    body: String(formData.get('body') ?? ''),
  })
  if (!parsed.success) return fail('errors.unexpected')

  const contentLocale = appLocaleToDb[locale]
  const section = await prisma.protocolSection.findFirst({
    where: { id: parsed.data.sectionId, protocol: { projectId } },
    include: { protocol: true },
  })
  if (!section) return fail('errors.notFound')

  // An approved version is a record, not a draft: it is never edited in place.
  if (section.protocol.status === 'APPROVED' || section.protocol.status === 'SUPERSEDED') {
    return fail('cannotEditApproved')
  }

  const previous = await prisma.sectionContent.findUnique({
    where: { sectionId_locale: { sectionId: section.id, locale: contentLocale } },
  })

  await prisma.sectionContent.upsert({
    where: { sectionId_locale: { sectionId: section.id, locale: contentLocale } },
    update: { title: parsed.data.title, body: parsed.data.body, updatedById: access.user.id },
    create: {
      sectionId: section.id,
      locale: contentLocale,
      title: parsed.data.title,
      body: parsed.data.body,
      updatedById: access.user.id,
    },
  })

  if (previous?.body !== parsed.data.body || previous?.title !== parsed.data.title) {
    await prisma.protocolChange.create({
      data: {
        protocolId: section.protocolId,
        userId: access.user.id,
        sectionKey: section.key,
        locale: contentLocale,
        action: 'EDIT_SECTION',
        detail: {
          titleChanged: previous?.title !== parsed.data.title,
          lengthBefore: previous?.body.length ?? 0,
          lengthAfter: parsed.data.body.length,
        },
      },
    })
  }

  revalidate(locale, projectId)
  return { ok: true }
}

export async function addCommentAction(
  locale: AppLocale,
  projectId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const access = await requireProjectAccess(projectId)
  if (!access.can('comment:create')) return fail('errors.forbidden')

  const sectionId = String(formData.get('sectionId') ?? '')
  const body = String(formData.get('body') ?? '').trim()
  if (!sectionId || body === '' || body.length > 4000) return fail('errors.unexpected')

  const section = await prisma.protocolSection.findFirst({
    where: { id: sectionId, protocol: { projectId } },
  })
  if (!section) return fail('errors.notFound')

  await prisma.sectionComment.create({
    data: { sectionId, userId: access.user.id, body },
  })

  revalidate(locale, projectId)
  return { ok: true }
}

export async function resolveCommentAction(
  locale: AppLocale,
  projectId: string,
  commentId: string,
): Promise<void> {
  const access = await requireProjectAccess(projectId)
  if (!access.can('comment:resolve')) return

  await prisma.sectionComment.updateMany({
    where: { id: commentId, section: { protocol: { projectId } } },
    data: { resolved: true, resolvedAt: new Date() },
  })

  revalidate(locale, projectId)
}

/**
 * Move a protocol between states.
 *
 * Submitting for review is refused while required sections are still empty in
 * the base language: an incomplete protocol should never reach a reviewer.
 */
export async function changeStatusAction(
  locale: AppLocale,
  projectId: string,
  protocolId: string,
  target: 'IN_REVIEW' | 'APPROVED' | 'DRAFT',
): Promise<ActionState> {
  const access = await requireProjectAccess(projectId)

  const needed = target === 'APPROVED' ? 'protocol:approve' : 'protocol:edit'
  if (!access.can(needed)) return fail('errors.forbidden')

  const protocol = await prisma.protocol.findFirst({
    where: { id: protocolId, projectId },
    include: { sections: { include: { contents: true } } },
  })
  if (!protocol) return fail('errors.notFound')
  if (protocol.status === 'SUPERSEDED') return fail('cannotEditApproved')

  if (target === 'IN_REVIEW' || target === 'APPROVED') {
    const missing = protocol.sections
      .filter(
        (section) =>
          section.isRequired &&
          // Generated sections render from live project data: there is nothing
          // to write, so they must never hold a version back.
          section.kind !== 'GENERATED' &&
          REQUIRED_SECTION_KEYS.includes(section.key),
      )
      .filter((section) => {
        const content = section.contents.find((entry) => entry.locale === access.project.baseLocale)
        return (content?.body ?? '').trim() === ''
      })
      .map((section) => {
        const content = section.contents.find((entry) => entry.locale === access.project.baseLocale)
        return content?.title ?? section.key
      })

    if (missing.length > 0) {
      return fail('requiredSectionsMissing', { sections: missing.join(', ') })
    }
  }

  await prisma.protocol.update({
    where: { id: protocolId },
    data: {
      status: target,
      approvedById: target === 'APPROVED' ? access.user.id : null,
      approvedAt: target === 'APPROVED' ? new Date() : null,
    },
  })

  await prisma.protocolChange.create({
    data: {
      protocolId,
      userId: access.user.id,
      action: `STATUS_${target}`,
      detail: { from: protocol.status, to: target },
    },
  })

  revalidate(locale, projectId)
  return { ok: true }
}

/**
 * Branch a new draft from the current version.
 *
 * The whole content is copied so the approved version stays readable exactly
 * as it was signed off, and gets marked as superseded.
 */
export async function createVersionAction(
  locale: AppLocale,
  projectId: string,
  protocolId: string,
): Promise<ActionState> {
  const access = await requireProjectAccess(projectId)
  if (!access.can('protocol:createVersion')) return fail('errors.forbidden')

  const source = await prisma.protocol.findFirst({
    where: { id: protocolId, projectId },
    include: { sections: { include: { contents: true }, orderBy: { order: 'asc' } } },
  })
  if (!source) return fail('errors.notFound')

  const existing = await prisma.protocol.findMany({
    where: { projectId },
    select: { versionLabel: true },
  })
  const majors = existing
    .map((entry) => Number.parseFloat(entry.versionLabel))
    .filter((value) => Number.isFinite(value))
  const nextLabel = (Math.max(0, ...majors) + 0.1).toFixed(1)

  await prisma.$transaction(async (tx) => {
    const created = await tx.protocol.create({
      data: {
        projectId,
        versionLabel: nextLabel,
        status: 'DRAFT',
        templateId: source.templateId,
        createdById: access.user.id,
        supersedesId: source.id,
        sections: {
          create: source.sections.map((section) => ({
            key: section.key,
            parentKey: section.parentKey,
            order: section.order,
            kind: section.kind,
            isRequired: section.isRequired,
            guidance: section.guidance ?? undefined,
            contents: {
              create: section.contents.map((content) => ({
                locale: content.locale,
                title: content.title,
                body: content.body,
              })),
            },
          })),
        },
      },
    })

    await tx.protocol.update({ where: { id: source.id }, data: { status: 'SUPERSEDED' } })

    await tx.protocolChange.create({
      data: {
        protocolId: created.id,
        userId: access.user.id,
        action: 'CREATED',
        detail: { from: source.versionLabel, to: nextLabel },
      },
    })
  })

  revalidate(locale, projectId)
  return { ok: true }
}

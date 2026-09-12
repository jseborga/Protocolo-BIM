'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { appLocaleToDb, type AppLocale } from '@/i18n/routing'
import { prisma } from '@/lib/prisma'
import { requireProjectAccess } from '@/server/authz'

export interface SettingsState {
  /** Translation key under the `projects` namespace. */
  error?: string
  ok?: boolean
}

const schema = z.object({
  name: z.string().trim().min(3).max(120),
  description: z.string().trim().max(2000).nullable(),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'CLOSED']),
  country: z.string().trim().max(80).nullable(),
  city: z.string().trim().max(80).nullable(),
  address: z.string().trim().max(200).nullable(),
  baseLocale: z.enum(['es', 'en', 'pt']),
  enabledLocales: z.array(z.enum(['es', 'en', 'pt'])).min(1),
})

export async function updateProjectAction(
  locale: AppLocale,
  projectId: string,
  _previous: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  const access = await requireProjectAccess(projectId)
  if (!access.can('settings:manage')) return { error: 'codeInvalid' }

  const baseLocale = String(formData.get('baseLocale') ?? 'es')
  const parsed = schema.safeParse({
    name: String(formData.get('name') ?? ''),
    description: String(formData.get('description') ?? '') || null,
    status: String(formData.get('status') ?? 'PLANNING'),
    country: String(formData.get('country') ?? '') || null,
    city: String(formData.get('city') ?? '') || null,
    address: String(formData.get('address') ?? '') || null,
    baseLocale,
    enabledLocales: [
      ...new Set([baseLocale, ...formData.getAll('enabledLocales').map(String)]),
    ],
  })
  if (!parsed.success) return { error: 'codeInvalid' }

  const enabled = parsed.data.enabledLocales.map((entry) => appLocaleToDb[entry])

  await prisma.$transaction(async (tx) => {
    await tx.project.update({
      where: { id: projectId },
      data: {
        name: parsed.data.name,
        description: parsed.data.description,
        status: parsed.data.status,
        country: parsed.data.country,
        city: parsed.data.city,
        address: parsed.data.address,
        baseLocale: appLocaleToDb[parsed.data.baseLocale],
        enabledLocales: enabled,
      },
    })

    // Enabling a language must give every existing section a row to write into.
    const sections = await tx.protocolSection.findMany({
      where: { protocol: { projectId } },
      include: { contents: true },
    })
    for (const section of sections) {
      for (const target of enabled) {
        if (section.contents.some((content) => content.locale === target)) continue
        const source =
          section.contents.find((content) => content.locale === appLocaleToDb[parsed.data.baseLocale]) ??
          section.contents[0]
        await tx.sectionContent.create({
          data: {
            sectionId: section.id,
            locale: target,
            title: source?.title ?? section.key,
            body: '',
          },
        })
      }
    }
  })

  revalidatePath(`/${locale}/p/${projectId}`, 'layout')
  return { ok: true }
}

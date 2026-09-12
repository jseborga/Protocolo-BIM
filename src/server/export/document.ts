import 'server-only'
import type { Locale } from '@prisma/client'
import { getTranslations } from 'next-intl/server'
import { dbLocaleToApp } from '@/i18n/routing'
import { prisma } from '@/lib/prisma'
import { GENERATED_SECTIONS, renderGeneratedSection } from '@/server/protocol'

export interface ExportSection {
  key: string
  order: number
  title: string
  body: string
  generated: boolean
  /** True when the body had to fall back to the project's base language. */
  fallback: boolean
}

export interface ExportDocument {
  projectCode: string
  projectName: string
  organisation: string
  clientName: string | null
  standard: string
  versionLabel: string
  status: string
  statusLabel: string
  approvedBy: string | null
  approvedAt: Date | null
  locale: Locale
  date: Date
  sections: ExportSection[]
  labels: {
    title: string
    project: string
    client: string
    standard: string
    status: string
    date: string
    contents: string
    version: string
  }
}

/**
 * Assemble everything an export needs in one place, so the PDF and the DOCX
 * render exactly the same document and can never disagree.
 *
 * Generated sections are resolved to Markdown here, which means live project
 * data reaches both formats through the same path as authored prose.
 */
export async function buildExportDocument(
  projectId: string,
  locale: Locale,
): Promise<ExportDocument | null> {
  const app = dbLocaleToApp[locale]

  const [project, protocol, t, statusLabels] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, include: { org: true, client: true } }),
    prisma.protocol.findFirst({
      where: { projectId, status: { not: 'SUPERSEDED' } },
      orderBy: { createdAt: 'desc' },
      include: {
        approvedBy: { select: { name: true } },
        sections: { orderBy: { order: 'asc' }, include: { contents: true } },
      },
    }),
    getTranslations({ locale: app, namespace: 'protocol' }),
    getTranslations({ locale: app, namespace: 'protocolStatus' }),
  ])

  if (!project || !protocol) return null

  const sections: ExportSection[] = []
  for (const section of protocol.sections) {
    const wanted = section.contents.find((entry) => entry.locale === locale)
    const base = section.contents.find((entry) => entry.locale === project.baseLocale)
    const generator = GENERATED_SECTIONS.get(section.key)

    const body = generator
      ? await renderGeneratedSection(generator, projectId, locale)
      : (wanted?.body?.trim() ? wanted.body : (base?.body ?? ''))

    sections.push({
      key: section.key,
      order: section.order,
      title: wanted?.title ?? base?.title ?? section.key,
      body,
      generated: Boolean(generator),
      fallback: !generator && !wanted?.body?.trim() && Boolean(base?.body?.trim()),
    })
  }

  return {
    projectCode: project.code,
    projectName: project.name,
    organisation: project.org.name,
    clientName: project.client?.legalName ?? null,
    standard: project.standard.replace(/_/gu, ' '),
    versionLabel: protocol.versionLabel,
    status: protocol.status,
    statusLabel: statusLabels(protocol.status),
    approvedBy: protocol.approvedBy?.name ?? null,
    approvedAt: protocol.approvedAt,
    locale,
    date: new Date(),
    sections,
    labels: {
      title: t('title'),
      project: t('coverProject'),
      client: t('coverClient'),
      standard: t('coverStandard'),
      status: t('coverStatus'),
      date: t('coverDate'),
      contents: t('tableOfContents'),
      version: t('version', { label: protocol.versionLabel }),
    },
  }
}

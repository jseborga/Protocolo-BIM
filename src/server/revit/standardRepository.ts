import 'server-only'
import { Prisma } from '@prisma/client'
import { getTranslations } from 'next-intl/server'
import { dbLocaleToApp } from '@/i18n/locales'
import { appUrl } from '@/lib/app-url'
import { localized } from '@/lib/localized'
import { prisma } from '@/lib/prisma'
import type { CompiledConvention } from '@/server/naming'
import { loadProjectConventions } from '@/server/naming/repository'
import type { AuditStandard } from './audit'
import { buildStandard, hashStandard, type StandardDocument } from './standard'

export interface LoadedStandard {
  document: StandardDocument
  /** The active conventions, compiled — what the audit validates against. */
  conventions: CompiledConvention[]
  auditStandard: AuditStandard
}

/**
 * Assemble a project's standard and make sure a rule set version records it.
 *
 * A version is cut only when the content hash differs from the latest one, so
 * reading the standard a thousand times leaves one version, and editing a
 * convention produces exactly one more.
 */
export async function loadStandard(projectId: string): Promise<LoadedStandard | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { org: { select: { name: true } }, client: true },
  })
  if (!project) return null

  const baseLocale = dbLocaleToApp[project.baseLocale]

  const [loaded, parameters, worksets, statusLabels] = await Promise.all([
    loadProjectConventions(projectId),
    prisma.sharedParameterDef.findMany({
      where: { projectId },
      include: { group: { select: { name: true } } },
    }),
    prisma.worksetDef.findMany({
      where: { projectId },
      include: { discipline: { select: { code: true } } },
      orderBy: { order: 'asc' },
    }),
    getTranslations({ locale: baseLocale, namespace: 'projectStatus' }),
  ])

  const conventions = loaded
    .filter((entry) => entry.record.isActive && entry.compiled)
    .map((entry) => entry.compiled!)

  const body = buildStandard({
    project: {
      id: project.id,
      code: project.code,
      name: project.name,
      description: project.description,
      standard: project.standard,
      baseLocale,
      locales: project.enabledLocales.map((locale) => dbLocaleToApp[locale]),
      address: project.address,
      city: project.city,
      country: project.country,
      statusLabel: statusLabels(project.status),
    },
    organisationName: project.org.name,
    client: project.client
      ? {
          legalName: project.client.legalName,
          taxId: project.client.taxId,
          contactName: project.client.contactName,
          contactEmail: project.client.contactEmail,
        }
      : null,
    conventions,
    parameters: parameters.map((parameter) => ({
      guid: parameter.guid,
      name: parameter.name,
      group: parameter.group?.name ?? null,
      dataType: parameter.dataType,
      paletteGroup: parameter.paletteGroup,
      isInstance: parameter.isInstance,
      categories: parameter.categories,
      required: parameter.required,
      description: localized(parameter.description, baseLocale, '') || null,
      ifcPset: parameter.ifcPset,
      ifcProperty: parameter.ifcProperty,
    })),
    worksets: worksets.map((workset) => ({
      name: workset.name,
      discipline: workset.discipline?.code ?? null,
      description: workset.description,
    })),
  })

  const hash = hashStandard(body)
  const ruleSet = await ensureRuleSet(projectId, hash, body)

  return {
    document: {
      ...body,
      ruleSet: { version: ruleSet.version, hash, publishedAt: ruleSet.publishedAt.toISOString() },
      webUrl: `${appUrl()}/${baseLocale}/p/${project.id}`,
    },
    conventions,
    auditStandard: {
      conventions,
      sharedParameters: body.sharedParameters.parameters.map((parameter) => ({
        guid: parameter.guid,
        name: parameter.name,
        isInstance: parameter.isInstance,
        categories: parameter.categories,
        required: parameter.required,
      })),
      worksets: body.worksets.map((workset) => workset.name),
      projectInformation: {
        name: body.revit.projectInformation.name,
        number: body.revit.projectInformation.number,
        clientName: body.revit.projectInformation.clientName,
      },
    },
  }
}

async function ensureRuleSet(
  projectId: string,
  hash: string,
  body: object,
): Promise<{ version: number; publishedAt: Date }> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const latest = await prisma.ruleSet.findFirst({
      where: { projectId },
      orderBy: { version: 'desc' },
      select: { version: true, hash: true, publishedAt: true },
    })
    if (latest && latest.hash === hash) return latest

    try {
      return await prisma.ruleSet.create({
        data: {
          projectId,
          version: (latest?.version ?? 0) + 1,
          hash,
          payload: body as Prisma.InputJsonValue,
        },
        select: { version: true, publishedAt: true },
      })
    } catch (error) {
      // Two requests raced to cut the same version; the loser re-reads and
      // finds the winner's row, which holds the same content.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') continue
      throw error
    }
  }
  throw new Error('Could not record the rule set version')
}

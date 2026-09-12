import { type Locale, type Prisma, type SectionKind } from '@prisma/client'
import { appLocaleToDb, type AppLocale } from '@/i18n/routing'
import type { LocalizedText } from '@/server/naming/types'
import {
  CODE_TABLE_SEEDS,
  NAMING_CONVENTION_SEEDS,
  RACI_ACTIVITY_SEEDS,
} from './baseline'
import { ISO19650_TEMPLATE } from './template'

const DB_TO_APP: Record<Locale, AppLocale> = { ES: 'es', EN: 'en', PT: 'pt' }

function pick(text: LocalizedText | undefined, locale: Locale, fallback: string): string {
  if (!text) return fallback
  return text[DB_TO_APP[locale]] ?? text.es ?? text.en ?? text.pt ?? fallback
}

/** Three uppercase alphanumerics, used as the default originator code. */
export function originatorCode(name: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z0-9]/gu, '')
  return (letters.slice(0, 3) || 'ORG').padEnd(3, 'X')
}

export interface ProvisionOptions {
  projectId: string
  projectCode: string
  organisationName: string
  baseLocale: Locale
  enabledLocales: Locale[]
  createdById: string
  /**
   * Codes allowed in the originator field of the naming convention. These come
   * from the project's appointed parties; when none exist yet the organisation
   * itself is the only originator.
   */
  originators?: Array<{ code: string; label: string }>
}

/**
 * Give a brand new project everything it needs to be useful on day one: the
 * ISO 19650 code tables, seven naming conventions with their test cases, the
 * default RACI activities and version 1.0 of the protocol in draft.
 *
 * Runs inside the caller's transaction so a half-provisioned project cannot
 * exist.
 */
export async function provisionProject(
  tx: Prisma.TransactionClient,
  options: ProvisionOptions,
): Promise<{ protocolId: string }> {
  const { projectId, baseLocale, enabledLocales, createdById } = options

  // --- Code tables -------------------------------------------------------
  const tableIdByKey = new Map<string, string>()
  for (const seed of CODE_TABLE_SEEDS) {
    const originators =
      options.originators && options.originators.length > 0
        ? options.originators
        : [
            {
              code: originatorCode(options.organisationName),
              label: options.organisationName,
            },
          ]

    const values =
      seed.key === 'ORIGINATOR'
        ? originators.map((originator) => ({
            code: originator.code,
            labels: { es: originator.label, en: originator.label, pt: originator.label },
          }))
        : seed.values

    const table = await tx.codeTable.create({
      data: {
        projectId,
        key: seed.key,
        labels: seed.labels as Prisma.InputJsonValue,
        values: {
          create: values.map((value, index) => ({
            code: value.code,
            labels: value.labels as Prisma.InputJsonValue,
            order: index,
          })),
        },
      },
    })
    tableIdByKey.set(seed.key, table.id)
  }

  // --- Naming conventions ------------------------------------------------
  for (const seed of NAMING_CONVENTION_SEEDS) {
    await tx.namingConvention.create({
      data: {
        projectId,
        key: seed.key,
        target: seed.target,
        separator: seed.separator,
        caseRule: seed.caseRule,
        maxLength: seed.maxLength ?? null,
        labels: seed.labels as Prisma.InputJsonValue,
        description: seed.description as Prisma.InputJsonValue,
        fields: {
          create: seed.fields.map((field) => ({
            order: field.order,
            key: field.key,
            labels: field.labels as Prisma.InputJsonValue,
            source: field.source,
            codeTableId: field.codeTableKey ? tableIdByKey.get(field.codeTableKey) : null,
            minLength: field.minLength ?? null,
            maxLength: field.maxLength ?? null,
            pattern: field.pattern ?? null,
            dateFormat: field.dateFormat ?? null,
            required: field.required ?? true,
            example: field.example ?? null,
          })),
        },
        examples: {
          create: seed.examples.map((example) => ({
            sample: example.sample,
            shouldBeValid: example.shouldBeValid,
          })),
        },
      },
    })
  }

  // --- RACI activities ---------------------------------------------------
  for (const activity of RACI_ACTIVITY_SEEDS) {
    await tx.raciActivity.create({
      data: {
        projectId,
        key: activity.key,
        order: activity.order,
        labels: activity.labels as Prisma.InputJsonValue,
      },
    })
  }

  // --- Protocol v1.0 -----------------------------------------------------
  const template = await tx.protocolTemplate.findUnique({ where: { key: 'ISO_19650_BASE' } })

  const protocol = await tx.protocol.create({
    data: {
      projectId,
      versionLabel: '1.0',
      status: 'DRAFT',
      templateId: template?.id ?? null,
      createdById,
      sections: {
        create: ISO19650_TEMPLATE.map((section) => ({
          key: section.key,
          order: section.order,
          kind: section.kind as SectionKind,
          isRequired: section.isRequired,
          guidance: section.guidance as Prisma.InputJsonValue,
          contents: {
            create: enabledLocales.map((locale) => ({
              locale,
              title: pick(section.titles, locale, section.key),
              // Only the base language gets the suggested starting text; other
              // languages stay empty so the translation gauge is honest.
              body:
                locale === baseLocale && section.defaultBody
                  ? pick(section.defaultBody, locale, '')
                  : '',
            })),
          },
        })),
      },
    },
  })

  await tx.protocolChange.create({
    data: {
      protocolId: protocol.id,
      userId: createdById,
      action: 'CREATED',
      detail: { template: 'ISO_19650_BASE', versionLabel: '1.0' },
    },
  })

  return { protocolId: protocol.id }
}

export { appLocaleToDb }

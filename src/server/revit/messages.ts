import 'server-only'
import { getTranslations } from 'next-intl/server'
import { defaultLocale, type AppLocale } from '@/i18n/locales'
import type { CompiledConvention, NamingError } from '@/server/naming'
import type { Finding } from './audit'
import { REVIT_CATEGORIES } from './catalog'
import { localeForRequest } from './locale'

/** `?locale=` first, then Accept-Language, then the project's own language. */
export function pickLocale(request: Request, fallback: AppLocale = defaultLocale): AppLocale {
  return localeForRequest(request, fallback)
}

export interface RenderedFinding {
  severity: Finding['severity']
  target: string
  code: string
  ruleKey: string
  elementId: string | null
  elementName: string | null
  category: string | null
  message: string
  /** One line per naming error, for findings that have several. */
  details: string[]
  params: Record<string, unknown>
}

/**
 * Turn findings into sentences in one language. The stored finding keeps its
 * code and parameters, so the same run reads correctly in Spanish, English or
 * Portuguese depending on who opens it.
 */
export async function createFindingRenderer(
  locale: AppLocale,
  conventions: CompiledConvention[],
) {
  const [t, namingT, targets] = await Promise.all([
    getTranslations({ locale, namespace: 'auditFinding' }),
    getTranslations({ locale, namespace: 'namingError' }),
    getTranslations({ locale, namespace: 'namingTarget' }),
  ])

  const byKey = new Map(conventions.map((convention) => [convention.key, convention]))
  const categoryLabel = (id: string) =>
    REVIT_CATEGORIES.find((category) => category.id === id)?.labels[locale] ?? id

  const namingLine = (error: NamingError, conventionKey: string) => {
    const field = byKey.get(conventionKey)?.fields.find((entry) => entry.key === error.fieldKey)
    const fieldLabel = field ? (field.labels[locale] ?? field.key) : (error.fieldKey ?? '')
    return namingT(error.code, { ...(error.params ?? {}), field: fieldLabel })
  }

  return (finding: {
    severity: Finding['severity']
    target: string | null
    code: string | null
    ruleKey: string
    elementId?: string | null
    elementName?: string | null
    category?: string | null
    params: unknown
  }): RenderedFinding => {
    const params = (finding.params ?? {}) as Record<string, unknown>
    const code = finding.code ?? 'NAMING'
    let message: string
    let details: string[] = []

    switch (code) {
      case 'NAMING': {
        const conventionKey = String(params.conventionKey ?? '')
        const errors = (params.errors as NamingError[] | undefined) ?? []
        details = errors.map((error) => namingLine(error, conventionKey))
        message = t('NAMING', {
          target: finding.target ? targets(finding.target) : '',
          mask: String(params.mask ?? ''),
        })
        break
      }
      case 'PARAMETER_BINDING_INCOMPLETE':
        message = t(code, {
          name: String(params.name ?? ''),
          missing: ((params.missing as string[] | undefined) ?? []).map(categoryLabel).join(', '),
        })
        break
      case 'PARAMETER_BINDING_KIND':
        message = t(code, {
          name: String(params.name ?? ''),
          expected: t(params.expected === 'INSTANCE' ? 'instance' : 'type'),
          actual: t(params.actual === 'INSTANCE' ? 'instance' : 'type'),
        })
        break
      case 'PROJECT_INFO_MISMATCH':
        message = t(code, {
          field: t(`field.${String(params.field)}`),
          expected: String(params.expected ?? ''),
          actual: String(params.actual ?? '') || '—',
        })
        break
      default: {
        const values = Object.fromEntries(
          Object.entries(params).map(([key, value]) => [key, String(value ?? '')]),
        )
        message = t(code, values)
      }
    }

    return {
      severity: finding.severity,
      target: finding.target ?? '',
      code,
      ruleKey: finding.ruleKey,
      elementId: finding.elementId ?? null,
      elementName: finding.elementName ?? null,
      category: finding.category ?? null,
      message,
      details,
      params,
    }
  }
}

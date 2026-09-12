import type { Locale } from '@prisma/client'

export interface SectionCompletenessInput {
  key: string
  isRequired: boolean
  title: string
  contents: Array<{ locale: Locale; body: string }>
}

export interface CompletenessResult {
  /** Percentage of required sections with content in the base locale. */
  percent: number
  requiredTotal: number
  requiredDone: number
  missing: Array<{ key: string; title: string }>
  /** Percentage of sections translated, per locale, against the base locale. */
  translation: Array<{ locale: Locale; percent: number; translated: number; total: number }>
}

function hasBody(contents: SectionCompletenessInput['contents'], locale: Locale): boolean {
  const entry = contents.find((content) => content.locale === locale)
  return (entry?.body ?? '').trim().length > 0
}

/**
 * How finished a protocol is: required sections written in the base language,
 * plus translation coverage for every other enabled language.
 */
export function computeCompleteness(
  sections: SectionCompletenessInput[],
  baseLocale: Locale,
  enabledLocales: Locale[],
): CompletenessResult {
  const required = sections.filter((section) => section.isRequired)
  const done = required.filter((section) => hasBody(section.contents, baseLocale))

  const written = sections.filter((section) => hasBody(section.contents, baseLocale))
  const translation = enabledLocales
    .filter((locale) => locale !== baseLocale)
    .map((locale) => {
      const translated = written.filter((section) => hasBody(section.contents, locale)).length
      return {
        locale,
        translated,
        total: written.length,
        percent: written.length === 0 ? 0 : Math.round((translated / written.length) * 100),
      }
    })

  return {
    percent: required.length === 0 ? 100 : Math.round((done.length / required.length) * 100),
    requiredTotal: required.length,
    requiredDone: done.length,
    missing: required
      .filter((section) => !hasBody(section.contents, baseLocale))
      .map((section) => ({ key: section.key, title: section.title })),
    translation,
  }
}

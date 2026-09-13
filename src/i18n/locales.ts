/**
 * Locale constants, free of any framework import.
 *
 * Domain code, the seed and the standalone scripts need the locale maps but
 * have no business pulling the routing library in, so the values live here and
 * `routing.ts` builds the next-intl configuration on top.
 */

export const locales = ['es', 'en', 'pt'] as const
export type AppLocale = (typeof locales)[number]

export const defaultLocale: AppLocale = 'es'

export const localeNames: Record<AppLocale, string> = {
  es: 'Espa\u00f1ol',
  en: 'English',
  pt: 'Portugu\u00eas',
}

/** Maps the `Locale` enum stored in PostgreSQL to the URL locale segment. */
export const dbLocaleToApp = { ES: 'es', EN: 'en', PT: 'pt' } as const
export const appLocaleToDb = { es: 'ES', en: 'EN', pt: 'PT' } as const

import { defineRouting } from 'next-intl/routing'

export const locales = ['es', 'en', 'pt'] as const
export type AppLocale = (typeof locales)[number]

export const defaultLocale: AppLocale = 'es'

export const localeNames: Record<AppLocale, string> = {
  es: 'Español',
  en: 'English',
  pt: 'Português',
}

/** Maps the `Locale` enum stored in PostgreSQL to the URL locale segment. */
export const dbLocaleToApp = { ES: 'es', EN: 'en', PT: 'pt' } as const
export const appLocaleToDb = { es: 'ES', en: 'EN', pt: 'PT' } as const

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

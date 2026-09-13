import { defineRouting } from 'next-intl/routing'
import { defaultLocale, locales } from './locales'

export {
  appLocaleToDb,
  dbLocaleToApp,
  defaultLocale,
  localeNames,
  locales,
  type AppLocale,
} from './locales'

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
})

import type { AppLocale } from '@/i18n/routing'

/**
 * Read a localized JSON column (`{ es, en, pt }`) for the active locale,
 * falling back through the other languages rather than rendering nothing.
 */
export function localized(
  value: unknown,
  locale: AppLocale,
  fallback = '',
): string {
  if (typeof value === 'string') return value
  if (!value || typeof value !== 'object') return fallback
  const text = value as Record<string, unknown>
  for (const key of [locale, 'es', 'en', 'pt']) {
    const candidate = text[key]
    if (typeof candidate === 'string' && candidate.trim() !== '') return candidate
  }
  return fallback
}

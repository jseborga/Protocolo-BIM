import { locales, type AppLocale } from '@/i18n/locales'

/**
 * The best supported language in an Accept-Language header (RFC 9110):
 * highest q first, header order breaking ties, `q=0` meaning "not this one".
 */
export function localeFromAcceptLanguage(header: string | null, fallback: AppLocale): AppLocale {
  if (!header) return fallback
  const ranked = header
    .split(',')
    .map((part, index) => {
      const [tag = '', ...parameters] = part.split(';').map((piece) => piece.trim())
      const qParameter = parameters.find((parameter) => /^q=/iu.test(parameter))
      const q = qParameter === undefined ? 1 : Number(qParameter.slice(2))
      return { code: tag.slice(0, 2).toLowerCase(), q, index }
    })
    .filter((entry) => Number.isFinite(entry.q) && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index)

  const match = ranked.find((entry) => locales.includes(entry.code as AppLocale))
  return match ? (match.code as AppLocale) : fallback
}

/** `?locale=` first, then Accept-Language, then the project's own language. */
export function localeForRequest(request: Request, fallback: AppLocale): AppLocale {
  const explicit = new URL(request.url).searchParams.get('locale')
  if (locales.includes(explicit as AppLocale)) return explicit as AppLocale
  return localeFromAcceptLanguage(request.headers.get('accept-language'), fallback)
}

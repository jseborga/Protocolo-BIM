import { describe, expect, it } from 'vitest'
import { localeForRequest, localeFromAcceptLanguage } from '@/server/revit/locale'

describe('choosing the language of API messages', () => {
  it('follows the q weights of Accept-Language, not just the order', () => {
    expect(localeFromAcceptLanguage('pt;q=0.2, en;q=0.9', 'es')).toBe('en')
    expect(localeFromAcceptLanguage('fr-FR, pt-BR;q=0.8, en;q=0.5', 'es')).toBe('pt')
    expect(localeFromAcceptLanguage('en-US,en;q=0.9,es;q=0.8', 'pt')).toBe('en')
  })

  it('treats q=0 as a refusal and ignores malformed weights', () => {
    expect(localeFromAcceptLanguage('en;q=0, pt', 'es')).toBe('pt')
    expect(localeFromAcceptLanguage('en;q=abc', 'es')).toBe('es')
  })

  it('falls back to the project language', () => {
    expect(localeFromAcceptLanguage(null, 'pt')).toBe('pt')
    expect(localeFromAcceptLanguage('de, fr', 'en')).toBe('en')
  })

  it('lets ?locale= override the header', () => {
    const request = new Request('https://x.test/api/v1/connection?locale=pt', {
      headers: { 'accept-language': 'en' },
    })
    expect(localeForRequest(request, 'es')).toBe('pt')
    expect(localeForRequest(new Request('https://x.test/?locale=xx', { headers: { 'accept-language': 'en' } }), 'es')).toBe('en')
  })
})

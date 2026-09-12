import { describe, expect, it } from 'vitest'
import en from '../../messages/en.json'
import es from '../../messages/es.json'
import pt from '../../messages/pt.json'

type Messages = Record<string, unknown>

function flatten(value: Messages, prefix = ''): string[] {
  return Object.entries(value).flatMap(([key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return child !== null && typeof child === 'object'
      ? flatten(child as Messages, path)
      : [path]
  })
}

/** ICU placeholders such as `{count}` used by a message. */
function placeholders(value: Messages, path: string): string[] {
  const segments = path.split('.')
  let node: unknown = value
  for (const segment of segments) node = (node as Messages)[segment]
  return [...String(node).matchAll(/\{(\w+)\}/gu)].map((match) => match[1]!).sort()
}

const locales = { es, en, pt } as Record<string, Messages>

describe('translation files', () => {
  const reference = flatten(es).sort()

  it('has the same keys in every locale', () => {
    for (const [locale, messages] of Object.entries(locales)) {
      const keys = flatten(messages).sort()
      expect({ locale, missing: reference.filter((key) => !keys.includes(key)) }).toEqual({
        locale,
        missing: [],
      })
      expect({ locale, extra: keys.filter((key) => !reference.includes(key)) }).toEqual({
        locale,
        extra: [],
      })
    }
  })

  it('uses the same ICU placeholders in every locale', () => {
    for (const key of reference) {
      const expected = placeholders(es, key)
      for (const [locale, messages] of Object.entries(locales)) {
        expect({ key, locale, placeholders: placeholders(messages, key) }).toEqual({
          key,
          locale,
          placeholders: expected,
        })
      }
    }
  })

  it('has no empty translations', () => {
    for (const [locale, messages] of Object.entries(locales)) {
      const empty = reference.filter((key) => {
        const segments = key.split('.')
        let node: unknown = messages
        for (const segment of segments) node = (node as Messages)[segment]
        return typeof node !== 'string' || node.trim() === ''
      })
      expect({ locale, empty }).toEqual({ locale, empty: [] })
    }
  })

  it('covers every naming error code produced by the engine', async () => {
    const codes = [
      'EMPTY_VALUE',
      'TOO_LONG',
      'SEGMENT_COUNT',
      'EMPTY_REQUIRED',
      'NOT_IN_CODE_TABLE',
      'FIELD_TOO_SHORT',
      'FIELD_TOO_LONG',
      'NOT_NUMERIC',
      'BAD_DATE',
      'PATTERN_MISMATCH',
      'WRONG_CASE',
      'ILLEGAL_CHARACTER',
    ]
    for (const [locale, messages] of Object.entries(locales)) {
      const namingError = (messages as { namingError: Record<string, string> }).namingError
      expect({ locale, missing: codes.filter((code) => !namingError[code]) }).toEqual({
        locale,
        missing: [],
      })
    }
  })
})

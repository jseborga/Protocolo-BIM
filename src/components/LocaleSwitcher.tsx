'use client'

import { useParams } from 'next/navigation'
import { useTransition } from 'react'
import { usePathname, useRouter } from '@/i18n/navigation'
import { localeNames, locales } from '@/i18n/routing'

/**
 * Switches the interface language while staying on the same page. The protocol
 * content language follows the same choice, which is why this lives in the top
 * bar rather than in a settings page.
 */
export function LocaleSwitcher({ current }: { current: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useParams()
  const [pending, startTransition] = useTransition()

  return (
    <select
      aria-label="Language"
      className="field w-auto py-1.5 text-xs"
      defaultValue={current}
      disabled={pending}
      onChange={(event) => {
        const locale = event.target.value
        startTransition(() => {
          router.replace(
            // @ts-expect-error dynamic route params are passed straight through
            { pathname, params },
            { locale },
          )
        })
      }}
    >
      {locales.map((locale) => (
        <option key={locale} value={locale}>
          {localeNames[locale]}
        </option>
      ))}
    </select>
  )
}

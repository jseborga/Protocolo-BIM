import type { ReactNode } from 'react'
import './globals.css'

/**
 * The real document shell lives in `[locale]/layout.tsx`, which knows the
 * language to put on <html lang>.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children
}

import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  // Self-contained server bundle, so the deployment image carries only what the
  // app actually imports instead of the whole dependency tree.
  output: 'standalone',
  // `playwright` is only used server-side to render PDFs; keep it out of the bundle.
  serverExternalPackages: ['playwright', '@prisma/client', 'bcryptjs'],
  eslint: { ignoreDuringBuilds: true },
}

export default withNextIntl(nextConfig)

import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts')

const nextConfig: NextConfig = {
  // `playwright` is only used server-side to render PDFs; keep it out of the bundle.
  serverExternalPackages: ['playwright', '@prisma/client', 'bcryptjs'],
  eslint: { ignoreDuringBuilds: true },
}

export default withNextIntl(nextConfig)

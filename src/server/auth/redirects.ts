/**
 * Only same-site paths may be used as a post-sign-in destination. Anything
 * else — an absolute URL, a protocol-relative `//evil.example` — is discarded,
 * so a crafted link cannot bounce someone off the site after authenticating.
 */
export function safeNextPath(candidate: string | null | undefined, fallback: string): string {
  if (!candidate) return fallback
  if (!candidate.startsWith('/')) return fallback
  if (candidate.startsWith('//')) return fallback
  if (candidate.includes('\\')) return fallback
  return candidate
}

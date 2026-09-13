/**
 * Public base URL of this deployment.
 *
 * Read from `APP_URL`, deliberately without the `NEXT_PUBLIC_` prefix: those
 * are substituted into the bundle when the image is built, so a value supplied
 * by the hosting panel at run time would be ignored, and both the OAuth
 * redirect URI and invitation links would silently point at localhost.
 *
 * `NEXT_PUBLIC_APP_URL` is still honoured for deployments that set it, but only
 * takes effect when it was present at build time.
 */
export function appUrl(): string {
  const raw =
    process.env.APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    'http://localhost:3000'
  return raw.replace(/\/+$/u, '')
}

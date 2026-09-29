import 'server-only'

/** 25 MB: a large federated model's inventory fits many times over. */
export const MAX_BODY_BYTES = 25 * 1024 * 1024

export type BodyResult<T> = { ok: true; value: T } | { ok: false; status: number; error: string }

/**
 * Read a JSON body with a hard size cap.
 *
 * Content-Length is checked first so an honest oversized upload is refused
 * without being read; the bytes that actually arrive are counted too, because
 * a chunked request carries no Content-Length at all.
 */
export async function readJsonBody<T = unknown>(request: Request): Promise<BodyResult<T>> {
  const declared = Number(request.headers.get('content-length') ?? '0')
  if (declared > MAX_BODY_BYTES) return { ok: false, status: 413, error: 'payload_too_large' }

  // Read incrementally so a chunked upload is cut off at the cap instead of
  // being buffered whole before anyone looks at its size.
  const chunks: Uint8Array[] = []
  let received = 0
  try {
    const reader = request.body?.getReader()
    while (reader) {
      const { done, value } = await reader.read()
      if (done) break
      received += value.byteLength
      if (received > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => undefined)
        return { ok: false, status: 413, error: 'payload_too_large' }
      }
      chunks.push(value)
    }
  } catch {
    return { ok: false, status: 400, error: 'unreadable_body' }
  }
  // A byte order mark is what some Windows tools put in front of UTF-8.
  const text = Buffer.concat(chunks).toString('utf8').replace(/^\uFEFF/u, '')

  try {
    return { ok: true, value: JSON.parse(text) as T }
  } catch {
    return { ok: false, status: 400, error: 'invalid_json' }
  }
}

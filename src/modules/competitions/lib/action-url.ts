/**
 * Announcement "Action URL" rules — shared by the Zod validators (server + backend forms) and by
 * the portal renderers, which is why this lives in a dependency-free module.
 */

export const ACTION_URL_MAX_LENGTH = 1000

export const ACTION_URL_MESSAGE =
  'Enter an in-app path starting with "/" (e.g. /acme-corp/portal/project) or a full http(s):// URL'

/**
 * Announcement action links are rendered as anchors in the participant portal, so the value has to
 * be either an in-app deep link (the natural case — the portal's own links are relative, e.g.
 * `/acme-corp/portal/project`) or an absolute http(s) URL.
 *
 * Everything else is rejected. In particular:
 *  - `javascript:` / `data:` / `vbscript:` / `file:` and every other scheme (XSS via href) — note
 *    that `z.string().url()`, which this replaces, accepted all of those,
 *  - protocol-relative `//evil.com` (open redirect that looks like a relative path),
 *  - values containing whitespace or control characters, used to smuggle the schemes above past
 *    naive prefix checks (e.g. `java\nscript:alert(1)`).
 */
export function isSafeActionUrl(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (trimmed.length > ACTION_URL_MAX_LENGTH) return false
  // eslint-disable-next-line no-control-regex
  if (/[\s\u0000-\u001f\u007f]/.test(trimmed)) return false
  // Protocol-relative URLs are absolute in disguise — reject before the "starts with /" branch.
  if (trimmed.startsWith('//')) return false
  // In-app deep link.
  if (trimmed.startsWith('/')) return true
  try {
    const parsed = new URL(trimmed)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Blank input means "no action link", not "invalid". `undefined` stays `undefined` so PATCH-style
 * updates that omit the field do not wipe an existing link.
 */
export function normalizeActionUrl(value: unknown): unknown {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  return trimmed === '' ? null : trimmed
}

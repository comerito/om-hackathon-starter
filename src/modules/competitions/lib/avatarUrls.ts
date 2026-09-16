/**
 * Where a portal avatar image is actually fetched from.
 *
 * Avatars are stored as core `Attachment` rows, and the upload route records the canonical
 * `/api/attachments/file/<id>` in `competitions_participant_profile.avatar_url`. That URL is not
 * usable from the portal: the core attachments routes authenticate with `getAuthFromRequest` — the
 * *backoffice* session — while a portal participant carries a `customer_auth_token`. With no
 * backoffice session, `checkAttachmentAccess` sees a tenant-scoped attachment and answers `401`,
 * so the `<img>` never loads.
 *
 * So the database keeps the canonical URL (it stays correct for the backoffice, and it is the one
 * thing that knows which attachment an avatar is) and every portal API response rewrites it to
 * `/api/competitions/portal/avatars/<id>`, which is customer-authenticated. Doing the rewrite at
 * the API boundary rather than in the column means avatars uploaded before this existed are fixed
 * too, with no data migration.
 */

/** Path prefix of the portal-authenticated avatar route. */
export const PORTAL_AVATAR_ROUTE = '/api/competitions/portal/avatars'

/** `Attachment.entityId` used for participant profile avatars; the route serves nothing else. */
export const AVATAR_ENTITY_ID = 'competitions:participant_profile'

export type AvatarThumbnailOptions = {
  width?: number
  height?: number
  /** `cover` crops to fill the box (the default), `contain` fits inside it. */
  cropType?: 'cover' | 'contain'
}

/**
 * Attachment ids appear in both core URL shapes:
 *   /api/attachments/file/<id>
 *   /api/attachments/image/<id>            (optionally followed by /<slug> and a query)
 * and in our own portal shape. Anything else — a Gravatar link, a GitHub avatar, an operator-typed
 * URL — has no attachment id and is left alone.
 */
const ATTACHMENT_ID_PATTERNS = [
  /\/api\/attachments\/(?:file|image)\/([^/?#]+)/,
  new RegExp(`${PORTAL_AVATAR_ROUTE}/([^/?#]+)`),
]

function extractAttachmentId(url: string): string | null {
  for (const pattern of ATTACHMENT_ID_PATTERNS) {
    const match = url.match(pattern)
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1])
      } catch {
        return match[1]
      }
    }
  }
  return null
}

/** Build the portal-servable URL for an avatar attachment, optionally asking for a thumbnail. */
export function buildPortalAvatarUrl(
  attachmentId: string,
  options?: AvatarThumbnailOptions,
): string {
  if (!attachmentId) return ''
  const params = new URLSearchParams()
  if (options?.width && Number.isFinite(options.width)) {
    params.set('width', String(Math.max(1, Math.floor(options.width))))
  }
  if (options?.height && Number.isFinite(options.height)) {
    params.set('height', String(Math.max(1, Math.floor(options.height))))
  }
  if (options?.cropType === 'cover' || options?.cropType === 'contain') {
    params.set('cropType', options.cropType)
  }
  const query = params.toString()
  return `${PORTAL_AVATAR_ROUTE}/${encodeURIComponent(attachmentId)}${query ? `?${query}` : ''}`
}

/**
 * Rewrite a stored avatar URL into one the portal can actually fetch. Returns `null` for a missing
 * avatar and passes any non-attachment URL through unchanged.
 */
export function toPortalAvatarUrl(
  storedUrl: string | null | undefined,
  options?: AvatarThumbnailOptions,
): string | null {
  if (!storedUrl) return null
  const attachmentId = extractAttachmentId(storedUrl)
  if (!attachmentId) return storedUrl
  return buildPortalAvatarUrl(attachmentId, options)
}

/**
 * The inverse, for writes: a client that round-trips an avatar URL back to us would otherwise
 * persist the portal URL into the column. Normalise it back to the canonical attachment URL so the
 * database keeps exactly one shape.
 */
export function toCanonicalAvatarUrl(url: string | null | undefined): string | null {
  if (!url) return null
  const attachmentId = extractAttachmentId(url)
  if (!attachmentId) return url
  return `/api/attachments/file/${encodeURIComponent(attachmentId)}`
}

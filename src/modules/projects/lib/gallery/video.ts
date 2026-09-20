/**
 * The Open Mercato Project Gallery embeds exactly one video per project, and only
 * from YouTube or Loom — other hosts either block iframe embeds or need setup the
 * gallery does not have. The gallery frontmatter wants the bare ID, not the URL.
 */

export type GalleryVideo = { provider: 'youtube' | 'loom'; id: string }

const YOUTUBE_ID = /^[A-Za-z0-9_-]{6,20}$/
const LOOM_ID = /^[A-Za-z0-9]{8,64}$/

function hostOf(url: URL): string {
  return url.hostname.toLowerCase().replace(/^(www|m)\./, '')
}

/** Resolve a participant-supplied video URL to a gallery video, or `null` when it is not embeddable. */
export function parseGalleryVideoUrl(value: string | null | undefined): GalleryVideo | null {
  if (!value || !value.trim()) return null

  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null

  const host = hostOf(url)
  const segments = url.pathname.split('/').filter(Boolean)

  if (host === 'youtu.be') {
    const id = segments[0] ?? ''
    return YOUTUBE_ID.test(id) ? { provider: 'youtube', id } : null
  }

  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id =
      segments[0] === 'watch'
        ? url.searchParams.get('v') ?? ''
        : ['embed', 'shorts', 'live'].includes(segments[0] ?? '')
          ? segments[1] ?? ''
          : ''
    return YOUTUBE_ID.test(id) ? { provider: 'youtube', id } : null
  }

  if (host === 'loom.com') {
    const id = ['share', 'embed'].includes(segments[0] ?? '') ? segments[1] ?? '' : ''
    return LOOM_ID.test(id) ? { provider: 'loom', id } : null
  }

  return null
}

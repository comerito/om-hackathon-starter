import {
  PORTAL_AVATAR_ROUTE,
  buildPortalAvatarUrl,
  toCanonicalAvatarUrl,
  toPortalAvatarUrl,
} from '../avatarUrls'

const ATTACHMENT_ID = '5f0c2e1a-9c3b-4a1d-8f77-1f2b3c4d5e6f'

describe('buildPortalAvatarUrl', () => {
  it('builds a bare portal URL when no thumbnail is asked for', () => {
    expect(buildPortalAvatarUrl(ATTACHMENT_ID)).toBe(`${PORTAL_AVATAR_ROUTE}/${ATTACHMENT_ID}`)
  })

  it('appends the thumbnail parameters', () => {
    expect(buildPortalAvatarUrl(ATTACHMENT_ID, { width: 128, height: 128, cropType: 'cover' })).toBe(
      `${PORTAL_AVATAR_ROUTE}/${ATTACHMENT_ID}?width=128&height=128&cropType=cover`,
    )
  })

  it('floors fractional sizes and drops non-finite ones', () => {
    expect(buildPortalAvatarUrl(ATTACHMENT_ID, { width: 64.9 })).toBe(
      `${PORTAL_AVATAR_ROUTE}/${ATTACHMENT_ID}?width=64`,
    )
    expect(buildPortalAvatarUrl(ATTACHMENT_ID, { width: Number.NaN })).toBe(
      `${PORTAL_AVATAR_ROUTE}/${ATTACHMENT_ID}`,
    )
  })

  it('ignores an unrecognised crop type', () => {
    expect(
      buildPortalAvatarUrl(ATTACHMENT_ID, { cropType: 'squish' as unknown as 'cover' }),
    ).toBe(`${PORTAL_AVATAR_ROUTE}/${ATTACHMENT_ID}`)
  })

  it('returns an empty string for a missing id', () => {
    expect(buildPortalAvatarUrl('')).toBe('')
  })
})

describe('toPortalAvatarUrl', () => {
  it('rewrites the canonical attachment file URL the upload route stores', () => {
    expect(toPortalAvatarUrl(`/api/attachments/file/${ATTACHMENT_ID}`)).toBe(
      `${PORTAL_AVATAR_ROUTE}/${ATTACHMENT_ID}`,
    )
  })

  it('rewrites the core image URL, slug and query included', () => {
    expect(
      toPortalAvatarUrl(`/api/attachments/image/${ATTACHMENT_ID}/me.png?width=128`, {
        width: 128,
        height: 128,
        cropType: 'cover',
      }),
    ).toBe(`${PORTAL_AVATAR_ROUTE}/${ATTACHMENT_ID}?width=128&height=128&cropType=cover`)
  })

  it('is idempotent on a URL that is already a portal URL', () => {
    const portalUrl = buildPortalAvatarUrl(ATTACHMENT_ID, { width: 128 })
    expect(toPortalAvatarUrl(portalUrl, { width: 128 })).toBe(portalUrl)
  })

  it('passes an external avatar URL through untouched', () => {
    const external = 'https://avatars.githubusercontent.com/u/1?v=4'
    expect(toPortalAvatarUrl(external)).toBe(external)
  })

  it('returns null when there is no avatar', () => {
    expect(toPortalAvatarUrl(null)).toBeNull()
    expect(toPortalAvatarUrl(undefined)).toBeNull()
    expect(toPortalAvatarUrl('')).toBeNull()
  })
})

describe('toCanonicalAvatarUrl', () => {
  it('normalises a portal URL back to the stored shape', () => {
    expect(toCanonicalAvatarUrl(buildPortalAvatarUrl(ATTACHMENT_ID, { width: 128 }))).toBe(
      `/api/attachments/file/${ATTACHMENT_ID}`,
    )
  })

  it('leaves an already-canonical URL alone', () => {
    expect(toCanonicalAvatarUrl(`/api/attachments/file/${ATTACHMENT_ID}`)).toBe(
      `/api/attachments/file/${ATTACHMENT_ID}`,
    )
  })

  it('passes an external URL through and maps a missing value to null', () => {
    expect(toCanonicalAvatarUrl('https://example.com/a.png')).toBe('https://example.com/a.png')
    expect(toCanonicalAvatarUrl(null)).toBeNull()
  })
})

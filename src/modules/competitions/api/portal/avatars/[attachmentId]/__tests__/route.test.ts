/**
 * Route-handler tests for `GET /api/competitions/portal/avatars/[attachmentId]`.
 *
 * The bug this route exists for is a `401`: the portal was pointed at
 * `/api/attachments/file/<id>`, which only a backoffice session can read, so an uploaded avatar
 * never rendered. The first thing worth proving is therefore that a *portal* session gets `200`
 * with the bytes.
 *
 * The second is that opening this door did not open a wider one. The route reads attachments, so
 * every refusal is asserted on status *and* body — a `403` that still carries the file is not a
 * closed hole — and the stub returns a recognisable marker so "no bytes leaked" is a claim about
 * real content rather than a length.
 */

const mockGetCustomerAuthFromRequest = jest.fn()
const mockCreateRequestContainer = jest.fn()
const mockReadThumbnailCache = jest.fn()
const mockWriteThumbnailCache = jest.fn()
const mockDriverRead = jest.fn()
const mockSharpResize = jest.fn()

jest.mock(
  '@open-mercato/core/modules/customer_accounts/lib/customerAuth',
  () => ({
    getCustomerAuthFromRequest: (...args: unknown[]) => mockGetCustomerAuthFromRequest(...args),
  }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/shared/lib/di/container',
  () => ({ createRequestContainer: (...args: unknown[]) => mockCreateRequestContainer(...args) }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/core/modules/attachments/data/entities',
  () => ({ Attachment: class Attachment {} }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/core/modules/attachments/lib/security',
  () => ({
    canRenderInlineAttachment: (mimeType: string) =>
      ['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(mimeType),
  }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/core/modules/attachments/lib/imageSafety',
  () => ({
    MAX_IMAGE_SOURCE_PIXELS: 40_000_000,
    validateImageMagicBytes: () => ({ ok: true, mimeType: 'image/png' }),
    validateImageDimensions: async () => ({ ok: true, mimeType: 'image/png' }),
  }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/core/modules/attachments/lib/thumbnailCache',
  () => ({
    buildThumbnailCacheKey: (width?: number, height?: number, cropType?: string) =>
      !width && !height ? null : `w${width ?? 'auto'}-h${height ?? 'auto'}-c${cropType ?? 'cover'}`,
    readThumbnailCache: (...args: unknown[]) => mockReadThumbnailCache(...args),
    writeThumbnailCache: (...args: unknown[]) => mockWriteThumbnailCache(...args),
  }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/core/modules/attachments/lib/drivers',
  () => ({
    StorageDriverFactory: class StorageDriverFactory {
      async resolveForPartition() {
        return { read: (...args: unknown[]) => mockDriverRead(...args) }
      }
    },
  }),
  { virtual: true },
)
jest.mock('sharp', () => {
  const factory = () => ({ resize: (...args: unknown[]) => mockSharpResize(...args) })
  return { __esModule: true, default: factory }
})

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require('../route') as typeof import('../route')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Attachment } = require('@open-mercato/core/modules/attachments/data/entities') as {
  Attachment: unknown
}

const TENANT = '11111111-1111-4111-8111-111111111111'
const OTHER_TENANT = '99999999-9999-4999-8999-999999999999'
const ORG = 'org-1'
const CALLER = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const ATTACHMENT = '55555555-5555-4555-8555-555555555555'

/** What a leaked read would put in the body. Only the allowed cases may contain it. */
const ORIGINAL_BYTES = 'SECRET-AVATAR-ORIGINAL-BYTES'
const RESIZED_BYTES = 'RESIZED-AVATAR-BYTES'
const CACHED_BYTES = 'CACHED-AVATAR-BYTES'

let attachmentTenantId: string | null
let attachmentEntityId: string
let attachmentMimeType: string
let findOneFilter: Record<string, unknown> | null

async function fetchAvatar(
  query = '',
  { authenticated = true }: { authenticated?: boolean } = {},
): Promise<{ status: number; body: string; headers: Headers }> {
  mockGetCustomerAuthFromRequest.mockResolvedValue(
    authenticated ? { sub: CALLER, tenantId: TENANT, orgId: ORG } : null,
  )
  const res = await GET(
    new Request(
      `http://localhost/api/competitions/portal/avatars/${ATTACHMENT}${query}`,
    ) as never,
    { params: Promise.resolve({ attachmentId: ATTACHMENT }) },
  )
  return { status: res.status, body: await res.text(), headers: res.headers }
}

beforeEach(() => {
  jest.clearAllMocks()
  attachmentTenantId = TENANT
  attachmentEntityId = 'competitions:participant_profile'
  attachmentMimeType = 'image/png'
  findOneFilter = null

  mockReadThumbnailCache.mockResolvedValue(null)
  mockWriteThumbnailCache.mockResolvedValue(undefined)
  mockDriverRead.mockResolvedValue({ buffer: Buffer.from(ORIGINAL_BYTES) })
  mockSharpResize.mockReturnValue({ toBuffer: async () => Buffer.from(RESIZED_BYTES) })

  const em = {
    findOne: jest.fn(async (entity: unknown, where: Record<string, unknown>) => {
      if (entity !== Attachment) throw new Error('unexpected entity in em.findOne')
      findOneFilter = where
      // Mirror the tenant scoping the route puts in the query itself.
      if (where.tenantId !== attachmentTenantId) return null
      return {
        id: ATTACHMENT,
        tenantId: attachmentTenantId,
        organizationId: ORG,
        entityId: attachmentEntityId,
        partitionCode: 'productsMedia',
        storagePath: 'me.png',
        storageDriver: 'local',
        mimeType: attachmentMimeType,
        fileName: 'me.png',
        fileSize: ORIGINAL_BYTES.length,
      }
    }),
  }
  mockCreateRequestContainer.mockResolvedValue({
    resolve: (name: string) => {
      if (name === 'em') return em
      if (name === 'storageDriverFactory') return undefined
      throw new Error(`unexpected container token: ${name}`)
    },
  })
})

describe('GET portal avatar — the reported 401', () => {
  it('serves the avatar to an authenticated portal user', async () => {
    const res = await fetchAvatar()

    expect(res.status).toBe(200)
    expect(res.body).toBe(ORIGINAL_BYTES)
    expect(res.headers.get('Content-Type')).toBe('image/png')
  })

  it('keeps the bytes off shared caches', async () => {
    const res = await fetchAvatar()
    expect(res.headers.get('Cache-Control')).toBe('private, max-age=3600')
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff')
  })

  it('answers 401 without a customer session, before resolving the container', async () => {
    const res = await fetchAvatar('', { authenticated: false })

    expect(res.status).toBe(401)
    expect(res.body).not.toContain(ORIGINAL_BYTES)
    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
  })
})

describe('GET portal avatar — scope checks', () => {
  it('scopes the attachment lookup to the caller tenant', async () => {
    await fetchAvatar()
    expect(findOneFilter).toEqual({ id: ATTACHMENT, tenantId: TENANT })
  })

  it('answers 404 for an attachment in another tenant, with no bytes', async () => {
    attachmentTenantId = OTHER_TENANT
    const res = await fetchAvatar()

    expect(res.status).toBe(404)
    expect(res.body).not.toContain(ORIGINAL_BYTES)
    expect(mockDriverRead).not.toHaveBeenCalled()
  })

  it('refuses an attachment that is not a participant avatar, with no bytes', async () => {
    attachmentEntityId = 'projects:project'
    const res = await fetchAvatar()

    expect(res.status).toBe(403)
    expect(res.body).toBe('{"error":"Forbidden"}')
    expect(mockDriverRead).not.toHaveBeenCalled()
  })

  it('refuses a non-renderable mime type, with no bytes', async () => {
    attachmentMimeType = 'application/pdf'
    const res = await fetchAvatar()

    expect(res.status).toBe(400)
    expect(res.body).not.toContain(ORIGINAL_BYTES)
    expect(mockDriverRead).not.toHaveBeenCalled()
  })

  it('answers 404 when the stored file is gone', async () => {
    mockDriverRead.mockRejectedValue(new Error('ENOENT'))
    const res = await fetchAvatar()

    expect(res.status).toBe(404)
    expect(res.body).toBe('{"error":"File not available"}')
  })
})

describe('GET portal avatar — thumbnails', () => {
  it('resizes to the requested box and caches the result', async () => {
    const res = await fetchAvatar('?width=128&height=128&cropType=cover')

    expect(res.status).toBe(200)
    expect(res.body).toBe(RESIZED_BYTES)
    expect(mockSharpResize).toHaveBeenCalledWith(
      expect.objectContaining({ width: 128, height: 128, fit: 'cover' }),
    )
    expect(mockWriteThumbnailCache).toHaveBeenCalledWith(
      'productsMedia',
      ATTACHMENT,
      'w128-h128-ccover',
      Buffer.from(RESIZED_BYTES),
    )
  })

  it('uses "contain" fit when asked, so the avatar is not cropped', async () => {
    await fetchAvatar('?width=128&cropType=contain')
    expect(mockSharpResize).toHaveBeenCalledWith(expect.objectContaining({ fit: 'contain' }))
  })

  it('serves a cached thumbnail without touching storage', async () => {
    mockReadThumbnailCache.mockResolvedValue(Buffer.from(CACHED_BYTES))
    const res = await fetchAvatar('?width=128&height=128')

    expect(res.status).toBe(200)
    expect(res.body).toBe(CACHED_BYTES)
    expect(mockDriverRead).not.toHaveBeenCalled()
    expect(mockSharpResize).not.toHaveBeenCalled()
  })

  it('serves the original untouched when no size is requested', async () => {
    const res = await fetchAvatar()

    expect(res.body).toBe(ORIGINAL_BYTES)
    expect(mockSharpResize).not.toHaveBeenCalled()
    expect(mockReadThumbnailCache).not.toHaveBeenCalled()
  })

  it('rejects out-of-range size parameters before any lookup', async () => {
    const res = await fetchAvatar('?width=9001')

    expect(res.status).toBe(400)
    expect(res.body).toBe('{"error":"Invalid size parameters"}')
    expect(mockDriverRead).not.toHaveBeenCalled()
  })
})

export {}

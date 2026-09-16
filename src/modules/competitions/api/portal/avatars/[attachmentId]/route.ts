/**
 * Serve a participant-profile avatar to the portal.
 *
 * The core attachment routes (`/api/attachments/file/<id>`, `/api/attachments/image/<id>`)
 * authenticate with `getAuthFromRequest` — the backoffice session. A portal participant carries a
 * `customer_auth_token` instead, so those routes see no session, find the avatar tenant-scoped and
 * answer `401`; the uploaded avatar never renders. This route is the portal's own door to the same
 * bytes: customer-authenticated, tenant-scoped, and restricted to avatar attachments.
 *
 * It mirrors `src/modules/projects/api/portal/asset-file/[id]/route.ts`, adding the on-the-fly
 * resizing the participants directory asks for (`?width=&height=&cropType=`) so a grid of avatars
 * does not pull full-size originals. Thumbnails share core's on-disk thumbnail cache, keyed by
 * attachment id and size, and the attachment is resolved inside the caller's tenant before any
 * cache read.
 */
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { z } from 'zod'
import sharp from 'sharp'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { Attachment } from '@open-mercato/core/modules/attachments/data/entities'
import { canRenderInlineAttachment } from '@open-mercato/core/modules/attachments/lib/security'
import {
  MAX_IMAGE_SOURCE_PIXELS,
  validateImageDimensions,
  validateImageMagicBytes,
} from '@open-mercato/core/modules/attachments/lib/imageSafety'
import {
  buildThumbnailCacheKey,
  readThumbnailCache,
  writeThumbnailCache,
} from '@open-mercato/core/modules/attachments/lib/thumbnailCache'
import { StorageDriverFactory } from '@open-mercato/core/modules/attachments/lib/drivers'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { CompetitionParticipation, ParticipantProfile } from '../../../../data/entities'
import { AVATAR_ENTITY_ID } from '../../../../lib/avatarUrls'

export const metadata = {
  GET: { requireCustomerAuth: true },
}

const querySchema = z.object({
  width: z.coerce.number().int().min(1).max(4000).optional(),
  height: z.coerce.number().int().min(1).max(4000).optional(),
  cropType: z.enum(['cover', 'contain']).optional(),
})

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ attachmentId: string }> },
) {
  const { attachmentId } = await context.params
  if (!attachmentId) {
    return NextResponse.json({ error: 'Attachment id is required' }, { status: 400 })
  }

  const auth = await getCustomerAuthFromRequest(req)
  if (!auth?.sub) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const parsedQuery = querySchema.safeParse(
    Object.fromEntries(new URL(req.url).searchParams.entries()),
  )
  if (!parsedQuery.success) {
    return NextResponse.json({ error: 'Invalid size parameters' }, { status: 400 })
  }
  const { width, height, cropType } = parsedQuery.data

  try {
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // Tenant scoping lives in the query, so an attachment belonging to another tenant is simply
    // not found rather than confirming its existence with a 403. Organisation is deliberately not
    // part of it: every portal query in this module — participations, profiles, team members —
    // scopes by tenant alone, and the participants directory is competition-wide.
    const attachment = await em.findOne(Attachment, {
      id: attachmentId,
      tenantId: auth.tenantId,
    } as FilterQuery<Attachment>)
    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // This route serves participant avatars and nothing else. Without the guard it would be a
    // generic reader for every attachment in the tenant — backoffice documents included.
    if (attachment.entityId !== AVATAR_ENTITY_ID) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!canRenderInlineAttachment(attachment.mimeType)) {
      return NextResponse.json({ error: 'Unsupported media type' }, { status: 400 })
    }

    // Entitlement, not "is logged in" — the lesson of issue #117 on the projects asset route.
    // Avatars are shown in the participants directory and in chat, so a participant of any
    // competition in the tenant (judges and mentors included) may read them. Someone holding a
    // portal session with no participation at all may still read their own avatar, so the profile
    // page keeps working before they join anything.
    const participation = await em.findOne(CompetitionParticipation, {
      customerUserId: auth.sub,
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<CompetitionParticipation>)
    if (!participation) {
      const ownProfile = await em.findOne(ParticipantProfile, {
        customerUserId: auth.sub,
        tenantId: auth.tenantId,
      } as FilterQuery<ParticipantProfile>)
      if (!ownProfile || !attachment.recordId || ownProfile.id !== attachment.recordId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const storageDriverFactory =
      (container.resolve('storageDriverFactory') as StorageDriverFactory | undefined) ??
      new StorageDriverFactory(em)

    const cacheKey = buildThumbnailCacheKey(width, height, cropType)
    let buffer: Buffer | null = cacheKey
      ? await readThumbnailCache(attachment.partitionCode, attachment.id, cacheKey)
      : null

    if (!buffer) {
      const driver = await storageDriverFactory.resolveForPartition(attachment.partitionCode, {
        tenantId: attachment.tenantId ?? '',
        organizationId: attachment.organizationId ?? '',
      })

      let input: Buffer
      try {
        const result = await driver.read(attachment.partitionCode, attachment.storagePath)
        input = result.buffer
      } catch {
        return NextResponse.json({ error: 'File not available' }, { status: 404 })
      }

      if (!width && !height) {
        buffer = input
      } else {
        const magicBytes = validateImageMagicBytes(input, attachment.mimeType)
        if (!magicBytes.ok) {
          return NextResponse.json({ error: magicBytes.error }, { status: magicBytes.status })
        }
        const dimensions = await validateImageDimensions(input)
        if (!dimensions.ok) {
          return NextResponse.json({ error: dimensions.error }, { status: dimensions.status })
        }

        buffer = await sharp(input, { failOn: 'error', limitInputPixels: MAX_IMAGE_SOURCE_PIXELS })
          .resize({
            width: width || undefined,
            height: height || undefined,
            fit: cropType === 'contain' ? 'contain' : 'cover',
            ...(cropType === 'contain'
              ? { background: { r: 0, g: 0, b: 0, alpha: 0 } }
              : {}),
          })
          .toBuffer()

        if (cacheKey) {
          // Best effort: a cache miss next time is cheaper than failing the request.
          void writeThumbnailCache(
            attachment.partitionCode,
            attachment.id,
            cacheKey,
            buffer,
          ).catch((cacheError) => {
            console.error('[portal/avatars] thumbnail cache write failed:', cacheError)
          })
        }
      }
    }

    const headers: Record<string, string> = {
      'Content-Type': attachment.mimeType || 'image/jpeg',
      // Private: the bytes are only for authenticated participants of this tenant.
      'Cache-Control': 'private, max-age=3600',
      'Content-Security-Policy': "default-src 'none'; sandbox",
      'X-Content-Type-Options': 'nosniff',
    }

    return new NextResponse(new Uint8Array(buffer), { status: 200, headers })
  } catch (error) {
    console.error('[portal/avatars] GET error:', error)
    return NextResponse.json({ error: 'Failed to render image' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Serve a participant profile avatar (portal)',
  methods: {
    GET: {
      summary:
        'Serve a participant profile avatar to a participant of any competition in the caller tenant (or to the owner of the avatar), with optional width/height/cropType resizing',
    },
  },
}

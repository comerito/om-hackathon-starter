import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { Attachment, AttachmentPartition } from '@open-mercato/core/modules/attachments/data/entities'
import { buildAttachmentFileUrl } from '@open-mercato/core/modules/attachments/lib/imageUrls'
import { ensureDefaultPartitions } from '@open-mercato/core/modules/attachments/lib/partitions'
import { storePartitionFile } from '@open-mercato/core/modules/attachments/lib/storage'
import { ParticipantProfile } from '../../../data/entities'

export const metadata = {
  POST: { requireCustomerAuth: true },
}

const AVATAR_ENTITY_ID = 'competitions:participant_profile'
const AVATAR_FIELD_KEY = 'avatar'
const AVATAR_PARTITION_CODE = 'productsMedia'
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024

export async function POST(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const contentType = req.headers.get('content-type') || ''
    if (!contentType.toLowerCase().includes('multipart/form-data')) {
      return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
    }

    const form = await req.formData()
    const file = form.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 })
    }
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image uploads are supported' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.length === 0) {
      return NextResponse.json({ error: 'Uploaded file is empty' }, { status: 400 })
    }
    if (buffer.length > MAX_AVATAR_SIZE_BYTES) {
      return NextResponse.json({ error: 'Image exceeds 5 MB limit' }, { status: 400 })
    }

    const { resolve } = await createRequestContainer()
    const em = resolve('em') as EntityManager
    await ensureDefaultPartitions(em)

    const partition = await em.findOne(AttachmentPartition, { code: AVATAR_PARTITION_CODE })
    if (!partition) {
      return NextResponse.json({ error: 'Avatar storage is not configured' }, { status: 500 })
    }

    let profile = await em.findOne(ParticipantProfile, {
      customerUserId: auth.sub,
      tenantId: auth.tenantId,
    })

    if (!profile) {
      profile = new ParticipantProfile()
      profile.customerUserId = auth.sub
      profile.tenantId = auth.tenantId
      profile.organizationId = auth.orgId
      em.persist(profile)
      await em.flush()
    }

    const safeName = String(file.name || 'avatar').replace(/[^a-zA-Z0-9._-]/g, '_')
    const stored = await storePartitionFile({
      partitionCode: AVATAR_PARTITION_CODE,
      orgId: auth.orgId,
      tenantId: auth.tenantId,
      fileName: safeName,
      buffer,
    })

    const attachmentId = randomUUID()
    const attachment = em.create(Attachment, {
      id: attachmentId,
      entityId: AVATAR_ENTITY_ID,
      recordId: profile.id,
      organizationId: auth.orgId,
      tenantId: auth.tenantId,
      fileName: safeName,
      mimeType: file.type || 'application/octet-stream',
      fileSize: buffer.length,
      partitionCode: AVATAR_PARTITION_CODE,
      storageDriver: partition.storageDriver || 'local',
      storagePath: stored.storagePath,
      storageMetadata: {
        assignments: [{ type: AVATAR_ENTITY_ID, id: profile.id }],
        tags: [AVATAR_FIELD_KEY],
      },
      url: buildAttachmentFileUrl(attachmentId),
      content: null,
    })

    em.persist(attachment)
    profile.avatarUrl = attachment.url
    await em.flush()

    return NextResponse.json({
      ok: true,
      avatar_url: attachment.url,
      profile_id: profile.id,
      attachment_id: attachment.id,
    })
  } catch (error) {
    console.error('[portal/profile-avatar] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Upload portal profile avatar',
  methods: {
    POST: { summary: 'Upload an avatar for the current portal user profile' },
  },
}

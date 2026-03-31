import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { Attachment, AttachmentPartition } from '@open-mercato/core/modules/attachments/data/entities'
// Use portal-accessible URL instead of admin-only buildAttachmentFileUrl
function buildPortalAssetUrl(attachmentId: string): string {
  return `/api/projects/portal/asset-file/${encodeURIComponent(attachmentId)}`
}
import { ensureDefaultPartitions } from '@open-mercato/core/modules/attachments/lib/partitions'
import { storePartitionFile } from '@open-mercato/core/modules/attachments/lib/storage'
import { Project, ProjectStatus } from '../../../data/entities'
import { TeamMember } from '../../../../teams/data/entities'

export const metadata = {
  POST: { requireCustomerAuth: true },
}

const PROJECT_ENTITY_ID = 'projects:project'
const PROJECT_PARTITION_CODE = 'productsMedia'
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024

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
    const projectId = String(form.get('project_id') || '')
    const kind = String(form.get('kind') || '')
    const file = form.get('file')

    if (!projectId) {
      return NextResponse.json({ error: 'project_id is required' }, { status: 400 })
    }
    if (kind !== 'screenshot' && kind !== 'readme') {
      return NextResponse.json({ error: 'kind must be screenshot or readme' }, { status: 400 })
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'File is required' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    if (buffer.length === 0) {
      return NextResponse.json({ error: 'Uploaded file is empty' }, { status: 400 })
    }
    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'File exceeds 10 MB limit' }, { status: 400 })
    }

    if (kind === 'screenshot' && !file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image uploads are supported for screenshots' }, { status: 400 })
    }
    if (kind === 'readme' && file.name.trim().toLowerCase() !== 'readme.md') {
      return NextResponse.json({ error: 'README upload must be named README.md' }, { status: 400 })
    }

    const { resolve } = await createRequestContainer()
    const em = resolve('em') as EntityManager
    await ensureDefaultPartitions(em)

    const project = await em.findOne(Project, {
      id: projectId,
      deletedAt: null,
    } as FilterQuery<Project>)

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    if (project.status !== ProjectStatus.DRAFT) {
      return NextResponse.json({ error: 'Project can no longer be edited' }, { status: 409 })
    }

    const membership = await em.findOne(TeamMember, {
      customerUserId: auth.sub,
      teamId: project.teamId,
      deletedAt: null,
    } as FilterQuery<TeamMember>)

    if (!membership) {
      return NextResponse.json({ error: 'You are not a member of this team' }, { status: 403 })
    }

    const partition = await em.findOne(AttachmentPartition, { code: PROJECT_PARTITION_CODE })
    if (!partition) {
      return NextResponse.json({ error: 'Project storage is not configured' }, { status: 500 })
    }

    const safeName = String(file.name || 'asset').replace(/[^a-zA-Z0-9._/-]/g, '_')
    const stored = await storePartitionFile({
      partitionCode: PROJECT_PARTITION_CODE,
      orgId: auth.orgId,
      tenantId: auth.tenantId,
      fileName: safeName,
      buffer,
    })

    const attachmentId = randomUUID()
    const attachment = em.create(Attachment, {
      id: attachmentId,
      entityId: PROJECT_ENTITY_ID,
      recordId: project.id,
      organizationId: auth.orgId,
      tenantId: auth.tenantId,
      fileName: safeName,
      mimeType: file.type || 'application/octet-stream',
      fileSize: buffer.length,
      partitionCode: PROJECT_PARTITION_CODE,
      storageDriver: partition.storageDriver || 'local',
      storagePath: stored.storagePath,
      storageMetadata: {
        assignments: [{ type: PROJECT_ENTITY_ID, id: project.id }],
        tags: [kind],
      },
      url: buildPortalAssetUrl(attachmentId),
      content: null,
    })

    em.persist(attachment)
    await em.flush()

    return NextResponse.json({
      ok: true,
      item: {
        id: attachment.id,
        file_name: attachment.fileName,
        mime_type: attachment.mimeType,
        file_size: attachment.fileSize,
        url: attachment.url,
        created_at: attachment.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('[portal/upload-project-asset] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Upload project asset',
  methods: {
    POST: { summary: 'Upload a screenshot or README.md file for the current user project' },
  },
}

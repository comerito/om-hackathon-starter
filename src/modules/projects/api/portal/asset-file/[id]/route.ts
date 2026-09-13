import { NextRequest, NextResponse } from 'next/server'
import { promises as fs } from 'fs'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { Attachment } from '@open-mercato/core/modules/attachments/data/entities'
import { resolveAttachmentAbsolutePath } from '@open-mercato/core/modules/attachments/lib/storage'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { Project } from '../../../../data/entities'
import { TeamMember } from '../../../../../teams/data/entities'
import { CompetitionParticipation } from '../../../../../competitions/data/entities'
import {
  PROJECT_ATTACHMENT_ENTITY_ID,
  canReadProjectAsset,
} from '../../../../lib/projectAssetAccess'

export const metadata = {
  GET: { requireCustomerAuth: true },
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params
  if (!id) {
    return NextResponse.json({ error: 'Attachment id is required' }, { status: 400 })
  }

  const auth = await getCustomerAuthFromRequest(req)
  if (!auth?.sub) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
  }

  const { resolve } = await createRequestContainer()
  const em = resolve('em') as EntityManager

  const attachment = await em.findOne(Attachment, { id })
  if (!attachment) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
  }

  // Scope check: attachment must belong to the same tenant and org.
  if (attachment.tenantId && attachment.tenantId !== auth.tenantId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (attachment.organizationId && attachment.organizationId !== auth.orgId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Scope check: this route serves project attachments and nothing else. Without it, any
  // attachment in the org — a backoffice document, a customer file — was reachable through it.
  if (attachment.entityId !== PROJECT_ATTACHMENT_ENTITY_ID || !attachment.recordId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const project = await em.findOne(Project, {
    id: attachment.recordId,
    deletedAt: null,
  } as FilterQuery<Project>)
  if (!project) {
    return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
  }

  // Entitlement: an active member of the owning team, or a judge/mentor of the project's
  // competition once the project has left draft. See `lib/projectAssetAccess.ts`.
  const membership = await em.findOne(TeamMember, {
    teamId: project.teamId,
    customerUserId: auth.sub,
    tenantId: auth.tenantId,
    deletedAt: null,
    leftAt: null,
  } as FilterQuery<TeamMember>)

  const participation = membership
    ? null
    : await em.findOne(CompetitionParticipation, {
        competitionId: project.competitionId,
        customerUserId: auth.sub,
        tenantId: auth.tenantId,
        deletedAt: null,
      } as FilterQuery<CompetitionParticipation>)

  const allowed = canReadProjectAsset(
    { isTeamMember: !!membership, competitionRole: participation?.role ?? null },
    { status: project.status },
  )
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const filePath = resolveAttachmentAbsolutePath(
    attachment.partitionCode,
    attachment.storagePath,
    attachment.storageDriver,
  )

  let buffer: Buffer
  try {
    buffer = await fs.readFile(filePath)
  } catch {
    return NextResponse.json({ error: 'File not available' }, { status: 404 })
  }

  const url = new URL(req.url)
  const forceDownload = url.searchParams.get('download') === '1'
  const headers: Record<string, string> = {
    'Content-Type': attachment.mimeType || 'application/octet-stream',
    'Cache-Control': 'private, max-age=3600',
  }
  if (attachment.fileSize > 0) {
    headers['Content-Length'] = String(attachment.fileSize)
  }
  if (forceDownload) {
    headers['Content-Disposition'] = `attachment; filename="${encodeURIComponent(attachment.fileName)}"`
  }

  return new NextResponse(new Uint8Array(buffer), { status: 200, headers })
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Serve project asset file (portal)',
  methods: {
    GET: {
      summary:
        'Download or serve a project attachment for a member of the owning team, or a judge/mentor of the competition once the project is submitted',
    },
  },
}

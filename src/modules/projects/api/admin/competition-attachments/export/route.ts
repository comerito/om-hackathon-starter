import { promises as fs } from 'fs'
import { Readable, PassThrough } from 'stream'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import archiver from 'archiver'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import { Attachment } from '@open-mercato/core/modules/attachments/data/entities'
import { resolveAttachmentAbsolutePath } from '@open-mercato/core/modules/attachments/lib/storage'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { Project } from '../../../../data/entities'
import { Competition } from '../../../../../competitions/data/entities'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['projects.export_attachments'] },
}

const exportSchema = z.object({
  competition_id: z.string().uuid(),
})

type ManifestEntry = {
  project_id: string
  project_title: string
  competition_id: string
  attachment_id: string
  original_file_name: string | null
  archive_file_name: string | null
  mime_type: string | null
  file_size: number | null
  status: 'exported' | 'missing' | 'inaccessible' | 'duplicate_skipped'
  skip_reason: string | null
}

function sanitizeSegment(value: string | null | undefined, fallback: string): string {
  const normalized = (value ?? '')
    .normalize('NFKD')
    .replace(/[^\x00-\x7F]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/^_+|_+$/g, '')

  if (!normalized) return fallback
  return normalized.slice(0, 80)
}

function buildArchiveFileName(project: Project, attachment: Attachment): string {
  const projectSegment = sanitizeSegment(project.title, project.id)
  const originalFileName = sanitizeSegment(attachment.fileName, 'file')
  return `${projectSegment}__${attachment.id}__${originalFileName}`
}

function buildDownloadName(slug: string): string {
  const safeSlug = sanitizeSegment(slug, 'competition')
  const dateStamp = new Date().toISOString().slice(0, 10)
  return `${safeSlug}-project-attachments-${dateStamp}.zip`
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId || !auth?.sub) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationId = scope.selectedId ?? auth.orgId

    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
    }

    const body = await req.json()
    const parsed = exportSchema.parse(body)

    const competition = await em.findOne(Competition, {
      id: parsed.competition_id,
      tenantId: auth.tenantId,
      organizationId,
      deletedAt: null,
    } as FilterQuery<Competition>)
    if (!competition) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
    }

    const projects = await em.find(Project, {
      competitionId: parsed.competition_id,
      tenantId: auth.tenantId,
      organizationId,
      deletedAt: null,
    } as FilterQuery<Project>, {
      orderBy: { createdAt: 'asc' },
    })

    const attachmentIds = [...new Set(projects.flatMap((project) => project.attachmentIds ?? []))]
    if (attachmentIds.length === 0) {
      return NextResponse.json({ error: 'No project attachments found for this competition' }, { status: 409 })
    }

    const attachments = await em.find(Attachment, {
      id: { $in: attachmentIds },
      tenantId: auth.tenantId,
      organizationId,
    } as FilterQuery<Attachment>)
    const attachmentsById = new Map(attachments.map((attachment) => [attachment.id, attachment]))

    const manifestEntries: ManifestEntry[] = []
    const exportedAttachmentIds = new Set<string>()
    const filesToArchive: Array<{ absolutePath: string; archiveName: string }> = []

    for (const project of projects) {
      for (const attachmentId of project.attachmentIds ?? []) {
        if (exportedAttachmentIds.has(attachmentId)) {
          const duplicate = attachmentsById.get(attachmentId)
          manifestEntries.push({
            project_id: project.id,
            project_title: project.title,
            competition_id: parsed.competition_id,
            attachment_id: attachmentId,
            original_file_name: duplicate?.fileName ?? null,
            archive_file_name: null,
            mime_type: duplicate?.mimeType ?? null,
            file_size: duplicate?.fileSize ?? null,
            status: 'duplicate_skipped',
            skip_reason: 'Attachment already exported earlier in this archive',
          })
          continue
        }

        const attachment = attachmentsById.get(attachmentId)
        if (!attachment) {
          manifestEntries.push({
            project_id: project.id,
            project_title: project.title,
            competition_id: parsed.competition_id,
            attachment_id: attachmentId,
            original_file_name: null,
            archive_file_name: null,
            mime_type: null,
            file_size: null,
            status: 'missing',
            skip_reason: 'Attachment record not found',
          })
          continue
        }

        const absolutePath = resolveAttachmentAbsolutePath(
          attachment.partitionCode,
          attachment.storagePath,
          attachment.storageDriver,
        )

        try {
          await fs.access(absolutePath)
        } catch {
          manifestEntries.push({
            project_id: project.id,
            project_title: project.title,
            competition_id: parsed.competition_id,
            attachment_id: attachment.id,
            original_file_name: attachment.fileName,
            archive_file_name: null,
            mime_type: attachment.mimeType ?? null,
            file_size: attachment.fileSize,
            status: 'inaccessible',
            skip_reason: 'Attachment file is not available in storage',
          })
          continue
        }

        const archiveName = buildArchiveFileName(project, attachment)
        exportedAttachmentIds.add(attachment.id)
        filesToArchive.push({ absolutePath, archiveName })
        manifestEntries.push({
          project_id: project.id,
          project_title: project.title,
          competition_id: parsed.competition_id,
          attachment_id: attachment.id,
          original_file_name: attachment.fileName,
          archive_file_name: archiveName,
          mime_type: attachment.mimeType ?? null,
          file_size: attachment.fileSize,
          status: 'exported',
          skip_reason: null,
        })
      }
    }

    const exportedCount = manifestEntries.filter((entry) => entry.status === 'exported').length
    if (exportedCount === 0) {
      return NextResponse.json({ error: 'No exportable project attachments found for this competition' }, { status: 409 })
    }

    const archive = archiver('zip', { zlib: { level: 9 } })
    const output = new PassThrough()
    const responseStream = Readable.toWeb(output) as ReadableStream<Uint8Array>

    archive.on('warning', (error: Error) => {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        output.destroy(error)
      }
    })
    archive.on('error', (error: Error) => {
      output.destroy(error)
    })
    archive.pipe(output)

    for (const file of filesToArchive) {
      archive.file(file.absolutePath, { name: file.archiveName })
    }

    archive.append(
      JSON.stringify({
        competition: {
          id: competition.id,
          name: competition.name,
          slug: competition.slug,
        },
        generated_at: new Date().toISOString(),
        exported_count: exportedCount,
        entries: manifestEntries,
      }, null, 2),
      { name: 'manifest.json' },
    )

    void archive.finalize()

    return new NextResponse(responseStream, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(buildDownloadName(competition.slug))}`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[projects/admin/competition-attachments/export] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Projects',
  summary: 'Export all project attachments for one competition',
  methods: {
    POST: {
      summary: 'Download a ZIP archive containing all project attachments for a competition',
    },
  },
}

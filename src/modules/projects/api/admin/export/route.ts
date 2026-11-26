import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { resolveTranslations } from '@open-mercato/shared/lib/i18n/server'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { buildXlsx } from '../../../lib/xlsx'
import { MAX_EXPORT_PROJECTS, buildProjectExportSheet, loadProjectExportRecords } from '../../../lib/projectExport'

// Read-only export: POST only because the id list can exceed a sensible URL length.
export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['projects.view'] },
}

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

const exportSchema = z.object({
  project_ids: z.array(z.string().uuid()).min(1).max(MAX_EXPORT_PROJECTS),
  // IANA zone of the browser, so dates in the sheet match what the table shows.
  time_zone: z.string().max(64).optional(),
})

function isValidTimeZone(zone: string | undefined): zone is string {
  if (!zone) return false
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
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

    const parsed = exportSchema.parse(await req.json())
    const projectIds = [...new Set(parsed.project_ids)]

    const records = await loadProjectExportRecords(em, { tenantId: auth.tenantId, organizationId }, projectIds)
    if (records.length === 0) {
      return NextResponse.json({ error: 'None of the selected projects were found' }, { status: 404 })
    }

    const { translate } = await resolveTranslations()
    const timeZone = isValidTimeZone(parsed.time_zone) ? parsed.time_zone : null
    const sheet = buildProjectExportSheet(records, { translate, timeZone })
    const workbook = await buildXlsx([sheet])

    const fileName = `projects-${new Date().toISOString().slice(0, 10)}.xlsx`
    return new NextResponse(new Uint8Array(workbook), {
      status: 200,
      headers: {
        'Content-Type': XLSX_MIME,
        'Content-Disposition': `attachment; filename="${fileName}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        'Content-Length': String(workbook.length),
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }
    console.error('[projects/admin/export] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Projects',
  summary: 'Export selected projects to Excel',
  methods: {
    POST: {
      summary: 'Download an .xlsx workbook with every field of the selected projects',
    },
  },
}

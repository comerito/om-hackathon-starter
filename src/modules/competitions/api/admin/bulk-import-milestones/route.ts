import { NextResponse } from 'next/server'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { Competition, Milestone } from '../../../data/entities'
import { bulkMilestoneImportSchema } from '../../../data/validators'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['competitions.agenda.manage'] },
}

type ImportResult = {
  label: string
  status: 'created' | 'error'
  reason?: string
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId || !auth?.sub) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const tenantId = auth.tenantId
    const organizationId = auth.orgId
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context required' }, { status: 400 })
    }

    const body = await req.json()
    const parsed = bulkMilestoneImportSchema.parse(body)

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const de = container.resolve('dataEngine') as DataEngine

    // Verify competition exists
    const competition = await em.findOne(Competition, {
      id: parsed.competition_id,
      tenantId,
      deletedAt: null,
    } as FilterQuery<Competition>)
    if (!competition) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
    }

    const results: ImportResult[] = []

    for (const item of parsed.items) {
      try {
        await de.createOrmEntity({
          entity: Milestone,
          data: {
            competitionId: parsed.competition_id,
            name: item.name,
            description: item.description ?? null,
            dueDate: new Date(item.due_date),
            status: item.status,
            sortOrder: item.sort_order,
            tenantId,
            organizationId,
          },
        })

        results.push({ label: item.name, status: 'created' })
      } catch (err) {
        results.push({
          label: item.name,
          status: 'error',
          reason: err instanceof Error ? err.message : 'Failed to create milestone',
        })
      }
    }

    // Flush all created entities to the database
    await em.flush()

    const created = results.filter(r => r.status === 'created').length
    const errors = results.filter(r => r.status === 'error')

    return NextResponse.json({
      total: parsed.items.length,
      created,
      errors: errors.map(e => ({ label: e.label, reason: e.reason })),
      results,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[admin/bulk-import-milestones] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Competitions',
  summary: 'Bulk import milestones',
  methods: { POST: { summary: 'Create multiple milestones from CSV import data' } },
}

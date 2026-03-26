import { NextResponse } from 'next/server'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { emitCrudSideEffects } from '@open-mercato/shared/lib/commands/helpers'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { AgendaItem, Competition } from '../../../data/entities'
import { bulkAgendaImportSchema } from '../../../data/validators'
import { agendaCrudEvents, agendaCrudIndexer } from '../../../commands/agenda'
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
    const parsed = bulkAgendaImportSchema.parse(body)

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
        const agendaItem = await de.createOrmEntity({
          entity: AgendaItem,
          data: {
            competitionId: parsed.competition_id,
            title: item.title,
            description: item.description ?? null,
            type: item.type,
            startsAt: new Date(item.starts_at),
            endsAt: new Date(item.ends_at),
            location: item.location ?? null,
            speakerName: item.speaker_name ?? null,
            speakerBio: item.speaker_bio ?? null,
            speakerPhotoUrl: null,
            trackId: null,
            isMandatory: item.is_mandatory,
            order: item.order,
            tenantId,
            organizationId,
          },
        })

        await emitCrudSideEffects({
          dataEngine: de,
          action: 'created',
          entity: agendaItem,
          identifiers: { id: String(agendaItem.id), tenantId, organizationId },
          events: agendaCrudEvents,
          indexer: agendaCrudIndexer,
        })

        results.push({ label: item.title, status: 'created' })
      } catch (err) {
        results.push({
          label: item.title,
          status: 'error',
          reason: err instanceof Error ? err.message : 'Failed to create agenda item',
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
    console.error('[admin/bulk-import-agenda] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Competitions',
  summary: 'Bulk import agenda items',
  methods: { POST: { summary: 'Create multiple agenda items from CSV import data' } },
}

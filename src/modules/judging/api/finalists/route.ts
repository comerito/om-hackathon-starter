import { NextResponse } from 'next/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { selectFinalistsSchema } from '../../data/validators'
import { Team } from '../../../teams/data/entities'
import { z } from 'zod'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['judging.finalists.manage'] },
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = selectFinalistsSchema.parse(body)
    const auth = await getAuthFromCookies()
    if (!auth?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // Reset all finalists for this track first
    const allTeams = await em.find(Team, {
      competitionId: parsed.competition_id,
      trackId: parsed.track_id,
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<Team>)

    for (const team of allTeams) {
      team.isFinalist = false
    }

    // Set selected teams as finalists
    const finalistTeams = allTeams.filter(t => parsed.project_ids.includes(t.id))
    for (const team of finalistTeams) {
      team.isFinalist = true
    }

    await em.persistAndFlush(allTeams)

    // Emit event
    try {
      const eventBus = container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
      await eventBus.emit('judging.finalists.selected', {
        competitionId: parsed.competition_id,
        trackId: parsed.track_id,
        finalistCount: finalistTeams.length,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
      })
    } catch (e) {
      console.error('[judging/finalists] Event emit error:', e)
    }

    return NextResponse.json({ ok: true, count: finalistTeams.length })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[judging/finalists] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Judging', summary: 'Finalist selection',
  methods: { POST: { summary: 'Select finalists for a track' } },
}

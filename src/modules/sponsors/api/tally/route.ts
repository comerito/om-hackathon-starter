import { NextResponse } from 'next/server'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { Prize } from '../../data/entities'
import { assignPrizeSchema, unassignPrizeSchema } from '../../data/validators'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['sponsors.prizes.assign'] },
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthFromCookies()
    if (!auth?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await req.json()
    const actionSchema = z.object({ action: z.enum(['assign', 'unassign']) })
    const { action } = actionSchema.parse(body)
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    if (action === 'assign') {
      const parsed = assignPrizeSchema.parse(body)
      const prize = await em.findOne(Prize, {
        id: parsed.id, tenantId: auth.tenantId, organizationId: auth.orgId, deletedAt: null,
      } as FilterQuery<Prize>)
      if (!prize) return NextResponse.json({ error: 'Prize not found' }, { status: 404 })

      prize.winningProjectId = parsed.winning_project_id
      prize.winningTeamId = parsed.winning_team_id
      prize.awardedAt = new Date()
      prize.awardedBy = auth.userId ?? auth.sub ?? null
      await em.persistAndFlush(prize)

      try {
        const eventBus = container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
        await eventBus.emit('sponsors.prize.awarded', {
          prizeId: prize.id, prizeName: prize.name, projectId: parsed.winning_project_id,
          teamId: parsed.winning_team_id, competitionId: prize.competitionId,
          tenantId: auth.tenantId, organizationId: auth.orgId,
        })
      } catch (e) { console.error('[sponsors/tally] Event emit error:', e) }

      return NextResponse.json({ ok: true })
    }

    if (action === 'unassign') {
      const parsed = unassignPrizeSchema.parse(body)
      const prize = await em.findOne(Prize, {
        id: parsed.id, tenantId: auth.tenantId, organizationId: auth.orgId, deletedAt: null,
      } as FilterQuery<Prize>)
      if (!prize) return NextResponse.json({ error: 'Prize not found' }, { status: 404 })

      prize.winningProjectId = null
      prize.winningTeamId = null
      prize.awardedAt = null
      prize.awardedBy = null
      await em.persistAndFlush(prize)

      return NextResponse.json({ ok: true })
    }

    // Unreachable — Zod validates action is 'assign' | 'unassign'
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    console.error('[sponsors/tally] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Sponsors', summary: 'Prize assignment',
  methods: { POST: { summary: 'Assign or unassign a prize to a project/team' } },
}

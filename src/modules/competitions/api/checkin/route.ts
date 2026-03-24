import { NextResponse } from 'next/server'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { CompetitionParticipation } from '../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const checkinSchema = z.object({
  participation_id: z.string().uuid(),
})

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['competitions.checkin.manage'] },
  GET: { requireAuth: true, requireFeatures: ['competitions.checkin.manage'] },
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    const body = await req.json()
    const parsed = checkinSchema.parse(body)
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    const participation = await em.findOne(CompetitionParticipation, {
      id: parsed.participation_id, tenantId: auth.tenantId, deletedAt: null,
    } as FilterQuery<CompetitionParticipation>)
    if (!participation) return NextResponse.json({ error: 'Participation not found' }, { status: 404 })
    if (participation.checkedIn) return NextResponse.json({ ok: true, already: true })

    participation.checkedIn = true
    participation.checkedInAt = new Date()
    await em.persistAndFlush(participation)

    // Resolve display name for response
    const knex = (em as any).getConnection().getKnex()
    const userRow = await knex('customer_users').select('display_name', 'email').where('id', participation.customerUserId).first()

    return NextResponse.json({
      ok: true,
      displayName: userRow?.display_name ?? null,
      email: userRow?.email ?? null,
      checkedInAt: participation.checkedInAt,
    })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed' }, { status: 422 })
    console.error('[checkin] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET: Check-in stats for a competition
export async function GET(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    const url = new URL(req.url)
    const competitionId = url.searchParams.get('competition_id')
    if (!competitionId) return NextResponse.json({ error: 'competition_id required' }, { status: 400 })

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    const total = await em.count(CompetitionParticipation, {
      competitionId, tenantId: auth.tenantId, deletedAt: null,
    } as FilterQuery<CompetitionParticipation>)
    const checkedIn = await em.count(CompetitionParticipation, {
      competitionId, tenantId: auth.tenantId, deletedAt: null, checkedIn: true,
    } as FilterQuery<CompetitionParticipation>)

    return NextResponse.json({ total, checkedIn })
  } catch (error) {
    console.error('[checkin] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Competitions',
  summary: 'Check-in management',
  methods: {
    POST: { summary: 'Check in a participant by participation ID' },
    GET: { summary: 'Get check-in stats for a competition' },
  },
}

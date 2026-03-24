import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { CompetitionParticipation } from '../../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const updateSchema = z.object({
  competition_id: z.string().uuid(),
  looking_for_team: z.boolean().optional(),
  looking_for_team_description: z.string().max(1000).nullable().optional(),
})

export const metadata = {
  PUT: { requireCustomerAuth: true },
}

export async function PUT(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = updateSchema.parse(body)
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    const participation = await em.findOne(CompetitionParticipation, {
      customerUserId: auth.sub,
      competitionId: parsed.competition_id,
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<CompetitionParticipation>)
    if (!participation) {
      return NextResponse.json({ error: 'Not a participant in this competition' }, { status: 403 })
    }

    if (parsed.looking_for_team !== undefined) {
      participation.lookingForTeam = parsed.looking_for_team
    }
    if (parsed.looking_for_team_description !== undefined) {
      participation.lookingForTeamDescription = parsed.looking_for_team_description
    }

    await em.persistAndFlush(participation)

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[portal/update-participation] PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Update my participation',
  methods: { PUT: { summary: 'Update looking-for-team status' } },
}

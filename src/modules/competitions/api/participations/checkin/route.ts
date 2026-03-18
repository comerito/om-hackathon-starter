import { z } from 'zod'
import { NextResponse } from 'next/server'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { CompetitionParticipation } from '../../../data/entities'
import { emitCompetitionsEvent } from '../../../events'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { competitionsTag, okSchema, errorSchema } from '../../openapi'

const checkinBodySchema = z.object({
  participationId: z.string().uuid(),
})

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['competitions.checkin.manage'] },
}

export async function POST(request: Request) {
  const auth = await getAuthFromRequest(request)
  const tenantId = auth?.tenantId
  if (!tenantId) {
    return NextResponse.json({ error: 'Tenant context is required' }, { status: 400 })
  }
  const organizationId = auth?.orgId
  if (!organizationId) {
    return NextResponse.json({ error: 'Organization context is required' }, { status: 400 })
  }

  const rawBody = await request.json().catch(() => ({}))
  const parsed = checkinBodySchema.safeParse(rawBody)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const de = container.resolve('dataEngine') as DataEngine

  const participation = await em.findOne(CompetitionParticipation, {
    id: parsed.data.participationId,
    tenantId,
    organizationId,
  } as FilterQuery<CompetitionParticipation>)

  if (!participation) {
    return NextResponse.json({ error: 'Participation not found' }, { status: 404 })
  }

  if (participation.checkedIn) {
    return NextResponse.json({ error: 'Participant is already checked in' }, { status: 409 })
  }

  participation.checkedIn = true
  participation.checkedInAt = new Date()
  await em.persistAndFlush(participation)

  await emitCompetitionsEvent(de, 'competitions.participation.checked_in', {
    id: participation.id,
    competitionId: participation.competitionId,
    customerUserId: participation.customerUserId,
    tenantId,
    organizationId,
  })

  return NextResponse.json({ ok: true })
}

export const openApi: OpenApiRouteDoc = {
  POST: {
    tags: [competitionsTag],
    summary: 'Check in a participant',
    description: 'Marks a participant as checked in for a competition. Sets checkedIn=true and checkedInAt to the current timestamp.',
    requestBody: {
      content: {
        'application/json': {
          schema: checkinBodySchema,
        },
      },
    },
    responses: {
      200: {
        description: 'Participant checked in successfully',
        content: { 'application/json': { schema: okSchema } },
      },
      404: {
        description: 'Participation not found',
        content: { 'application/json': { schema: errorSchema } },
      },
      409: {
        description: 'Participant is already checked in',
        content: { 'application/json': { schema: errorSchema } },
      },
    },
  },
}

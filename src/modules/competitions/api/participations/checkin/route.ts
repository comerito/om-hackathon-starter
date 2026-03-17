import { z } from 'zod'
import type { NextRequest } from 'next/server'
import { makeApiHandler } from '@open-mercato/shared/lib/api/handler'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
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

export const POST = makeApiHandler({
  schema: checkinBodySchema,
  async handler({ parsed, container, auth }) {
    const tenantId = auth?.tenantId
    if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
    const organizationId = auth?.orgId
    if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })

    const em = container.resolve('em') as EntityManager
    const de = container.resolve('dataEngine') as DataEngine

    const participation = await em.findOne(CompetitionParticipation, {
      id: parsed.participationId,
      tenantId,
      organizationId,
    } as FilterQuery<CompetitionParticipation>)

    if (!participation) {
      throw new CrudHttpError(404, { error: 'Participation not found' })
    }

    if (participation.checkedIn) {
      throw new CrudHttpError(409, { error: 'Participant is already checked in' })
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

    return { ok: true }
  },
})

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

import { z } from 'zod'
import type { NextRequest } from 'next/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const castVoteSchema = z.object({
  competitionId: z.string().uuid(),
  projectId: z.string().uuid(),
})

export const metadata = {
  GET: { requireCustomerAuth: true },
  POST: { requireCustomerAuth: true },
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const competitionId = searchParams.get('competitionId')
    if (!competitionId) {
      return Response.json({ error: 'competitionId is required' }, { status: 400 })
    }

    const { createRequestContainer } = await import('@open-mercato/shared/lib/di/container')
    const container = await createRequestContainer()
    const em = container.resolve('em') as import('@mikro-orm/postgresql').EntityManager
    const customerAuth = container.resolve('customerAuth') as { userId: string }

    const { VotingService } = await import('../../lib/VotingService')
    const votingService = new VotingService(em)
    const votes = await votingService.getMyVotes(competitionId, customerAuth.userId)

    // Get max votes config
    const knex = em.getKnex()
    const competition = await knex('competitions_competition')
      .where('id', competitionId)
      .select('peer_voting_config', 'stage')
      .first()

    const config = (typeof competition?.peer_voting_config === 'string'
      ? JSON.parse(competition.peer_voting_config)
      : competition?.peer_voting_config ?? {}) as Record<string, unknown>

    const maxVotes = Number(config?.maxVotesPerParticipant ?? 3)

    return Response.json({
      votes,
      votesUsed: votes.length,
      maxVotes,
      votingOpen: ['DEMOS', 'DELIBERATION'].includes(competition?.stage ?? ''),
    })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = castVoteSchema.parse(body)

    const { createRequestContainer } = await import('@open-mercato/shared/lib/di/container')
    const container = await createRequestContainer()
    const em = container.resolve('em') as import('@mikro-orm/postgresql').EntityManager
    const customerAuth = container.resolve('customerAuth') as { userId: string; tenantId: string; orgId: string }

    const { VotingService } = await import('../../lib/VotingService')
    const votingService = new VotingService(em)

    // Check if vote is allowed
    const check = await votingService.canCastVote(parsed.competitionId, customerAuth.userId, parsed.projectId)
    if (!check.allowed) {
      return Response.json({ error: check.reason }, { status: 400 })
    }

    // Cast the vote
    const result = await votingService.castVote(
      parsed.competitionId,
      customerAuth.userId,
      parsed.projectId,
      customerAuth.tenantId,
      customerAuth.orgId,
    )

    // Emit vote cast event
    try {
      const eventBus = container.resolve('eventBus') as {
        emit?: (event: string, payload: unknown) => Promise<void>
        emitEvent?: (event: string, payload: unknown) => Promise<void>
      }
      const eventPayload = {
        voteId: result.id,
        competitionId: parsed.competitionId,
        voterId: customerAuth.userId,
        projectId: parsed.projectId,
        tenantId: customerAuth.tenantId,
        organizationId: customerAuth.orgId,
      }
      if (typeof eventBus.emit === 'function') {
        await eventBus.emit('sponsors.vote.cast', eventPayload)
      } else if (typeof eventBus.emitEvent === 'function') {
        await eventBus.emitEvent('sponsors.vote.cast', eventPayload)
      }
    } catch {
      // non-critical
    }

    return Response.json({ ok: true, voteId: result.id }, { status: 201 })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return Response.json({ error: 'Validation failed', details: err.errors }, { status: 400 })
    }
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

export const openApi: OpenApiRouteDoc = {
  GET: {
    tags: ['Sponsors'],
    summary: 'Get my votes',
    description: 'Returns the current user\'s votes for a competition.',
    parameters: [
      { name: 'competitionId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
    ],
    responses: {
      '200': { description: 'Vote list' },
    },
  },
  POST: {
    tags: ['Sponsors'],
    summary: 'Cast a vote',
    description: 'Casts a peer vote for a project. Enforces vote limit, no self-vote, and voting window.',
    requestBody: {
      content: {
        'application/json': {
          schema: castVoteSchema,
        },
      },
    },
    responses: {
      '201': { description: 'Vote cast successfully' },
      '400': { description: 'Voting not allowed' },
    },
  },
}

import type { NextRequest } from 'next/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  GET: { requireAuth: true },
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
    const knex = em.getKnex()

    // Check if the request comes from an admin (requireAuth) or a portal user
    // Admin users can always see tally; portal users only after FINISHED+
    let isAdmin = false
    try {
      const auth = container.resolve('auth') as { userId?: string; role?: string } | null
      isAdmin = !!auth?.userId
    } catch {
      isAdmin = false
    }

    if (!isAdmin) {
      // Portal user — check stage
      const competition = await knex('competitions_competition')
        .where('id', competitionId)
        .select('stage')
        .first()

      if (!competition) {
        return Response.json({ error: 'Competition not found' }, { status: 404 })
      }

      const publicStages = ['FINISHED', 'ARCHIVED']
      if (!publicStages.includes(competition.stage)) {
        return Response.json({ error: 'Vote tally is not yet available' }, { status: 403 })
      }
    }

    const { VotingService } = await import('../../../lib/VotingService')
    const votingService = new VotingService(em)
    const tally = await votingService.getVoteTally(competitionId)

    // Get total unique voters
    const voterCount = await knex('sponsors_peer_vote')
      .where('competition_id', competitionId)
      .countDistinct('voter_id as count')
      .first()

    return Response.json({
      tally,
      totalVoters: Number(voterCount?.count ?? 0),
      totalVotes: tally.reduce((sum, entry) => sum + entry.voteCount, 0),
    })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

export const openApi: OpenApiRouteDoc = {
  GET: {
    tags: ['Sponsors'],
    summary: 'Get vote tally',
    description: 'Returns the vote tally for a competition. Admins can access anytime; portal users only after FINISHED stage.',
    parameters: [
      { name: 'competitionId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
    ],
    responses: {
      '200': { description: 'Vote tally' },
      '403': { description: 'Tally not yet available' },
    },
  },
}

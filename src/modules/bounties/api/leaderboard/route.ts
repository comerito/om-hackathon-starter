import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { LeaderboardService } from '../../services/LeaderboardService'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const querySchema = z.object({
  competition_id: z.string().uuid(),
  organization_id: z.string().uuid(),
})

export const metadata = {
  GET: { requireAuth: false },
}

export async function GET(request: Request) {
  try {
    const container = await createRequestContainer()
    const url = new URL(request.url)
    const parsed = querySchema.parse({
      competition_id: url.searchParams.get('competition_id'),
      organization_id: url.searchParams.get('organization_id'),
    })

    const em = container.resolve('em') as EntityManager
    const leaderboardService = new LeaderboardService()
    const data = await leaderboardService.getLeaderboard(em, parsed.competition_id, parsed.organization_id)

    return new Response(JSON.stringify(data), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: 'Validation failed', details: error.issues }), { status: 422, headers: { 'content-type': 'application/json' } })
    }
    console.error('[bounties/leaderboard] GET error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties',
  summary: 'Bounty leaderboard',
  methods: { GET: { summary: 'Get bounty hunting leaderboard' } },
}

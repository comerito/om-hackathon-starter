import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { PeerVote } from '../../../data/entities'
import { Competition } from '../../../../competitions/data/entities'
import { TeamMember } from '../../../../teams/data/entities'
import { Project } from '../../../../projects/data/entities'
import {
  evaluateVotingWindow,
  resolveVotesPerPerson,
  type PeerVotingConfig,
} from '../../../lib/voting-eligibility'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = { GET: { requireCustomerAuth: true } }

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    const url = new URL(req.url)
    const competitionId = url.searchParams.get('competition_id')
    if (!competitionId) return NextResponse.json({ error: 'competition_id required' }, { status: 400 })

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    const votes = await em.find(PeerVote, {
      voterId: auth.sub, competitionId, tenantId: auth.tenantId, organizationId: auth.orgId,
    } as FilterQuery<PeerVote>)

    // Voting context: the same verdict `cast-vote` enforces, so the portal can
    // disable a button it knows the server would reject instead of offering a
    // vote that silently fails.
    const competition = await em.findOne(Competition, {
      id: competitionId, tenantId: auth.tenantId,
    } as FilterQuery<Competition>)
    const votingConfig = (competition as unknown as Record<string, unknown> | null)
      ?.peerVotingConfig as PeerVotingConfig | undefined
    const window = evaluateVotingWindow({ stage: competition?.stage ?? null, config: votingConfig })

    // The voter's own team's projects — the ones they may never vote for.
    const membership = await em.findOne(TeamMember, {
      customerUserId: auth.sub, competitionId, tenantId: auth.tenantId, deletedAt: null,
    } as FilterQuery<TeamMember>)
    const ownProjects = membership
      ? await em.find(Project, {
          teamId: membership.teamId, competitionId, tenantId: auth.tenantId, deletedAt: null,
        } as FilterQuery<Project>)
      : []

    return NextResponse.json({
      votes: votes.map(v => ({ id: v.id, project_id: v.projectId, created_at: v.createdAt })),
      count: votes.length,
      voting: {
        open: window.open,
        reason: window.open ? null : window.reason,
        message: window.open ? null : window.message,
        votes_used: votes.length,
        votes_max: resolveVotesPerPerson(votingConfig),
        allow_vote_change: votingConfig?.allowVoteChange === true,
        my_team_id: membership?.teamId ?? null,
        my_team_project_ids: ownProjects.map(p => p.id),
      },
    })
  } catch (error) {
    console.error('[portal/my-votes] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal', summary: 'My votes',
  methods: { GET: { summary: 'Get current user\'s votes and their peer-voting eligibility' } },
}

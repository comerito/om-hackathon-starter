import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { PeerVote } from '../../../data/entities'
import { Competition } from '../../../../competitions/data/entities'
import { CompetitionParticipation } from '../../../../competitions/data/entities'
import { TeamMember } from '../../../../teams/data/entities'
import { Project } from '../../../../projects/data/entities'
import { castVoteSchema } from '../../../data/validators'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  POST: { requireCustomerAuth: true },
  DELETE: { requireCustomerAuth: true },
}

export async function POST(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const body = await req.json()
    const parsed = castVoteSchema.parse(body)
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // Verify participation and check-in
    const participation = await em.findOne(CompetitionParticipation, {
      customerUserId: auth.sub, competitionId: parsed.competition_id,
      tenantId: auth.tenantId, deletedAt: null,
    } as FilterQuery<CompetitionParticipation>)
    if (!participation) return NextResponse.json({ error: 'Not a participant in this competition' }, { status: 403 })
    if (participation.role !== 'participant') return NextResponse.json({ error: 'Only participants can vote' }, { status: 403 })

    // Get competition config for vote limits and window
    const competition = await em.findOne(Competition, {
      id: parsed.competition_id, tenantId: auth.tenantId,
    } as FilterQuery<Competition>)
    if (!competition) return NextResponse.json({ error: 'Competition not found' }, { status: 404 })

    const votingConfig = (competition as unknown as Record<string, unknown>).peerVotingConfig as { enabled?: boolean; votesPerPerson?: number; votingEndsAt?: string | null } | undefined
    if (votingConfig?.enabled === false) return NextResponse.json({ error: 'Voting is not enabled' }, { status: 409 })

    // Check voting window
    if (votingConfig?.votingEndsAt) {
      const endsAt = new Date(votingConfig.votingEndsAt)
      if (new Date() > endsAt) return NextResponse.json({ error: 'Voting window has closed' }, { status: 409 })
    }

    // No self-voting: check if project belongs to voter's team
    const voterMembership = await em.findOne(TeamMember, {
      customerUserId: auth.sub, competitionId: parsed.competition_id, deletedAt: null,
    } as FilterQuery<TeamMember>)
    if (voterMembership) {
      const project = await em.findOne(Project, { id: parsed.project_id, deletedAt: null } as FilterQuery<Project>)
      if (project && project.teamId === voterMembership.teamId) {
        return NextResponse.json({ error: 'You cannot vote for your own team\'s project' }, { status: 409 })
      }
    }

    // Check vote limit
    const existingVotes = await em.find(PeerVote, {
      voterId: auth.sub, competitionId: parsed.competition_id, tenantId: auth.tenantId,
    } as FilterQuery<PeerVote>)
    const maxVotes = votingConfig?.votesPerPerson ?? 3
    if (existingVotes.length >= maxVotes) {
      return NextResponse.json({ error: `You have already used all ${maxVotes} votes` }, { status: 409 })
    }

    // Check duplicate vote
    const duplicate = existingVotes.find(v => v.projectId === parsed.project_id)
    if (duplicate) return NextResponse.json({ error: 'You have already voted for this project' }, { status: 409 })

    // Cast vote
    const vote = em.create(PeerVote, {
      competitionId: parsed.competition_id, voterId: auth.sub,
      projectId: parsed.project_id, tenantId: auth.tenantId!, organizationId: auth.orgId!,
      createdAt: new Date(),
    })
    await em.persistAndFlush(vote)

    // Emit event
    try {
      const eventBus = container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
      await eventBus.emit('sponsors.vote.cast', {
        voteId: vote.id, voterId: auth.sub, projectId: parsed.project_id,
        competitionId: parsed.competition_id, tenantId: auth.tenantId, organizationId: auth.orgId,
      })
    } catch (e) { console.error('[portal/cast-vote] Event emit error:', e) }

    return NextResponse.json({ ok: true, vote_id: vote.id, votes_used: existingVotes.length + 1, votes_max: maxVotes })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    console.error('[portal/cast-vote] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    const url = new URL(req.url)
    const voteId = url.searchParams.get('vote_id')
    if (!voteId) return NextResponse.json({ error: 'vote_id required' }, { status: 400 })

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    const vote = await em.findOne(PeerVote, {
      id: voteId, voterId: auth.sub, tenantId: auth.tenantId,
    } as FilterQuery<PeerVote>)
    if (!vote) return NextResponse.json({ error: 'Vote not found' }, { status: 404 })

    // Check if vote change is allowed
    const competition = await em.findOne(Competition, {
      id: vote.competitionId, tenantId: auth.tenantId,
    } as FilterQuery<Competition>)
    const votingConfig = (competition as unknown as Record<string, unknown> | null)?.peerVotingConfig as { allowVoteChange?: boolean } | undefined
    if (!votingConfig?.allowVoteChange) {
      return NextResponse.json({ error: 'Vote changes are not allowed' }, { status: 409 })
    }

    await em.removeAndFlush(vote)

    try {
      const eventBus = container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
      await eventBus.emit('sponsors.vote.retracted', {
        voteId, voterId: auth.sub, projectId: vote.projectId,
        competitionId: vote.competitionId, tenantId: auth.tenantId, organizationId: auth.orgId,
      })
    } catch (e) { console.error('[portal/cast-vote] Event emit error:', e) }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[portal/cast-vote] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal', summary: 'Cast/retract vote',
  methods: { POST: { summary: 'Cast a People\'s Choice vote' }, DELETE: { summary: 'Retract a vote' } },
}

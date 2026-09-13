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
import { evaluateVotingWindow, DEFAULT_VOTES_PER_PERSON, type PeerVotingConfig } from '../../../lib/voting-eligibility'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

/** Registry resource kind for peer votes — matches the `sponsors.vote.*` events. */
const VOTE_RESOURCE_KIND = 'sponsors.vote'

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

    // Mutation-guard registry — this is a custom (non-`makeCrudRoute`) write
    // route, so it has to run the same guard set a CRUD write would. Run before
    // the eligibility checks so a guard that rewrites the payload cannot slip a
    // different project past them.
    const guard = await runRouteMutationGuards({
      container,
      req,
      auth: {
        userId: auth.sub,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
        userFeatures: auth.resolvedFeatures ?? [],
      },
      input: {
        resourceKind: VOTE_RESOURCE_KIND,
        operation: 'create',
        mutationPayload: { ...parsed },
      },
    })
    if (!guard.ok) return guard.response
    const input = guard.modifiedPayload
      ? castVoteSchema.parse({ ...parsed, ...guard.modifiedPayload })
      : parsed

    // Verify participation and check-in
    const participation = await em.findOne(CompetitionParticipation, {
      customerUserId: auth.sub, competitionId: input.competition_id,
      tenantId: auth.tenantId, deletedAt: null,
    } as FilterQuery<CompetitionParticipation>)
    if (!participation) return NextResponse.json({ error: 'Not a participant in this competition' }, { status: 403 })
    if (participation.role !== 'participant') return NextResponse.json({ error: 'Only participants can vote' }, { status: 403 })

    // Get competition config for vote limits and window
    const competition = await em.findOne(Competition, {
      id: input.competition_id, tenantId: auth.tenantId,
    } as FilterQuery<Competition>)
    if (!competition) return NextResponse.json({ error: 'Competition not found' }, { status: 404 })

    const votingConfig = (competition as unknown as Record<string, unknown>).peerVotingConfig as PeerVotingConfig | undefined

    // Is voting open at all? Stage first, then the (optional) explicit window —
    // `votingEndsAt` alone never closes voting because it is null by default.
    const votingWindow = evaluateVotingWindow({ stage: competition.stage, config: votingConfig })
    if (!votingWindow.open) {
      return NextResponse.json({ error: votingWindow.message, reason: votingWindow.reason }, { status: 409 })
    }

    // No self-voting: check if project belongs to voter's team
    const voterMembership = await em.findOne(TeamMember, {
      customerUserId: auth.sub, competitionId: input.competition_id, deletedAt: null,
    } as FilterQuery<TeamMember>)
    if (voterMembership) {
      const project = await em.findOne(Project, { id: input.project_id, deletedAt: null } as FilterQuery<Project>)
      if (project && project.teamId === voterMembership.teamId) {
        return NextResponse.json({ error: 'You cannot vote for your own team\'s project' }, { status: 409 })
      }
    }

    // Check vote limit
    const existingVotes = await em.find(PeerVote, {
      voterId: auth.sub, competitionId: input.competition_id, tenantId: auth.tenantId,
    } as FilterQuery<PeerVote>)
    const maxVotes = votingConfig?.votesPerPerson ?? DEFAULT_VOTES_PER_PERSON
    if (existingVotes.length >= maxVotes) {
      return NextResponse.json({ error: `You have already used all ${maxVotes} votes` }, { status: 409 })
    }

    // Check duplicate vote
    const duplicate = existingVotes.find(v => v.projectId === input.project_id)
    if (duplicate) return NextResponse.json({ error: 'You have already voted for this project' }, { status: 409 })

    // Cast vote
    const vote = em.create(PeerVote, {
      competitionId: input.competition_id, voterId: auth.sub,
      projectId: input.project_id, tenantId: auth.tenantId!, organizationId: auth.orgId!,
      createdAt: new Date(),
    })
    em.persist(vote)
    await em.flush()

    // Guard after-success callbacks run only once the write has committed.
    await guard.runAfterSuccess()

    // Emit event
    try {
      const eventBus = container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
      await eventBus.emit('sponsors.vote.cast', {
        voteId: vote.id, voterId: auth.sub, projectId: input.project_id,
        competitionId: input.competition_id, tenantId: auth.tenantId, organizationId: auth.orgId,
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

    const competition = await em.findOne(Competition, {
      id: vote.competitionId, tenantId: auth.tenantId,
    } as FilterQuery<Competition>)
    if (!competition) return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
    const votingConfig = (competition as unknown as Record<string, unknown>).peerVotingConfig as PeerVotingConfig | undefined

    // Retracting a vote changes the tally just as casting one does, so it is
    // gated by the same window — otherwise a participant could still edit the
    // People's Choice result during deliberation.
    const votingWindow = evaluateVotingWindow({ stage: competition.stage, config: votingConfig })
    if (!votingWindow.open) {
      return NextResponse.json({ error: votingWindow.message, reason: votingWindow.reason }, { status: 409 })
    }

    // Check if vote change is allowed
    if (!votingConfig?.allowVoteChange) {
      return NextResponse.json({ error: 'Vote changes are not allowed' }, { status: 409 })
    }

    const guard = await runRouteMutationGuards({
      container,
      req,
      auth: {
        userId: auth.sub,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
        userFeatures: auth.resolvedFeatures ?? [],
      },
      input: {
        resourceKind: VOTE_RESOURCE_KIND,
        resourceId: vote.id,
        operation: 'delete',
        mutationPayload: { vote_id: vote.id, competition_id: vote.competitionId, project_id: vote.projectId },
      },
    })
    if (!guard.ok) return guard.response

    em.remove(vote)
    await em.flush()

    await guard.runAfterSuccess()

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

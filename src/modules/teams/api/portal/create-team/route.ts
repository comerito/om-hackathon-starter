import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { Team, TeamMember, TeamRole, TeamStatus } from '../../../data/entities'
import { CompetitionParticipation, ParticipationRole } from '../../../../competitions/data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const createTeamSchema = z.object({
  competition_id: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().optional(),
})

export const metadata = {
  POST: { requireCustomerAuth: true },
}

export async function POST(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = createTeamSchema.parse(body)
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // Verify participation in competition
    const participation = await em.findOne(CompetitionParticipation, {
      customerUserId: auth.sub,
      competitionId: parsed.competition_id,
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<CompetitionParticipation>)
    if (!participation) {
      return NextResponse.json({ error: 'Not a participant in this competition' }, { status: 403 })
    }

    if (participation.role !== ParticipationRole.PARTICIPANT) {
      return NextResponse.json({ error: 'Only participants can create teams' }, { status: 403 })
    }

    // Check user doesn't already have a team in this competition
    const existingMember = await em.findOne(TeamMember, {
      customerUserId: auth.sub,
      competitionId: parsed.competition_id,
      deletedAt: null,
    } as FilterQuery<TeamMember>)
    if (existingMember) {
      return NextResponse.json({ error: 'You are already on a team in this competition' }, { status: 409 })
    }

    // Create team
    const now = new Date()
    const team = em.create(Team, {
      competitionId: parsed.competition_id,
      name: parsed.name,
      description: parsed.description ?? null,
      status: TeamStatus.ACTIVE,
      isFinalist: false,
      isActive: true,
      createdAt: now,
      updatedAt: now,
      tenantId: auth.tenantId!,
      organizationId: auth.orgId!,
    })
    await em.persistAndFlush(team)

    // Auto-add creator as OWNER
    const member = em.create(TeamMember, {
      teamId: team.id,
      customerUserId: auth.sub,
      competitionId: parsed.competition_id,
      role: TeamRole.OWNER,
      joinedAt: now,
      tenantId: auth.tenantId!,
      organizationId: auth.orgId!,
    })
    await em.persistAndFlush(member)

    // Clear looking-for-team flag
    participation.lookingForTeam = false
    participation.lookingForTeamDescription = null
    await em.persistAndFlush(participation)

    return NextResponse.json({ ok: true, team_id: team.id })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[portal/create-team] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Create team',
  methods: { POST: { summary: 'Create a team and join as owner' } },
}

import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { Team, TeamMember, TeamRole } from '../../../data/entities'
import { Competition, CompetitionStage, STAGE_ORDER } from '../../../../competitions/data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const leaveTeamSchema = z.object({
  team_id: z.string().uuid(),
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
    const parsed = leaveTeamSchema.parse(body)
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // Find the member record
    const membership = await em.findOne(TeamMember, {
      teamId: parsed.team_id,
      customerUserId: auth.sub,
      deletedAt: null,
      tenantId: auth.tenantId,
    } as FilterQuery<TeamMember>)
    if (!membership) {
      return NextResponse.json({ error: 'You are not a member of this team' }, { status: 404 })
    }

    // Load team to get competition
    const team = await em.findOne(Team, {
      id: parsed.team_id,
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<Team>)
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    // Check competition stage — only allow leaving during early stages
    const competition = await em.findOne(Competition, {
      id: team.competitionId,
      tenantId: auth.tenantId,
    } as FilterQuery<Competition>)
    if (!competition) {
      return NextResponse.json({ error: 'Competition not found' }, { status: 404 })
    }

    const stageIdx = STAGE_ORDER.indexOf(competition.stage)
    const hackingIdx = STAGE_ORDER.indexOf(CompetitionStage.HACKING)
    if (stageIdx >= hackingIdx) {
      return NextResponse.json(
        { error: 'You cannot leave your team after hacking has started.' },
        { status: 403 },
      )
    }

    // Owners cannot leave — they must transfer ownership or disband
    if (membership.role === TeamRole.OWNER) {
      // Count remaining members
      const memberCount = await em.count(TeamMember, {
        teamId: parsed.team_id,
        deletedAt: null,
        tenantId: auth.tenantId,
      } as FilterQuery<TeamMember>)

      if (memberCount > 1) {
        return NextResponse.json(
          { error: 'As the team owner, you must transfer ownership before leaving, or remove all other members first.' },
          { status: 403 },
        )
      }

      // Solo owner — soft-delete the team entirely
      team.deletedAt = new Date()
      em.persist(team)
    }

    // Soft-delete the membership
    membership.deletedAt = new Date()
    membership.leftAt = new Date()
    em.persist(membership)

    await em.flush()

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[portal/leave-team] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Leave team (portal)',
  methods: { POST: { summary: 'Current user leaves their team' } },
}

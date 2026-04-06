import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { Team, TeamMember, TeamRole } from '../../../data/entities'
import { Competition, CompetitionStage, STAGE_ORDER } from '../../../../competitions/data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const removeSchema = z.object({
  team_id: z.string().uuid(),
  member_id: z.string().uuid(),
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
    const parsed = removeSchema.parse(body)
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // Verify caller is team owner
    const ownership = await em.findOne(TeamMember, {
      teamId: parsed.team_id,
      customerUserId: auth.sub,
      role: TeamRole.OWNER,
      deletedAt: null,
      tenantId: auth.tenantId,
    } as FilterQuery<TeamMember>)
    if (!ownership) {
      return NextResponse.json({ error: 'Only the team owner can remove members' }, { status: 403 })
    }

    // Find the member to remove
    const member = await em.findOne(TeamMember, {
      id: parsed.member_id,
      teamId: parsed.team_id,
      deletedAt: null,
      tenantId: auth.tenantId,
    } as FilterQuery<TeamMember>)
    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Cannot remove yourself (use leave-team instead)
    if (member.customerUserId === auth.sub) {
      return NextResponse.json({ error: 'Cannot remove yourself. Use leave team instead.' }, { status: 400 })
    }

    // Check competition stage
    const team = await em.findOne(Team, {
      id: parsed.team_id,
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<Team>)
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

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
        { error: 'Cannot remove members after hacking has started.' },
        { status: 403 },
      )
    }

    // Hard-delete the membership
    await em.nativeDelete(TeamMember, { id: member.id } as FilterQuery<TeamMember>)

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[portal/remove-member] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Remove team member (portal)',
  methods: { POST: { summary: 'Team owner removes a member from the team' } },
}

import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { Team, TeamMember, TeamRole } from '../../../data/entities'
import { Competition, CompetitionStage, STAGE_ORDER } from '../../../../competitions/data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const transferSchema = z.object({
  team_id: z.string().uuid(),
  new_owner_id: z.string().uuid(),
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
    const parsed = transferSchema.parse(body)
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
      return NextResponse.json({ error: 'Only the team owner can transfer ownership' }, { status: 403 })
    }

    // Find the new owner member record
    const newOwner = await em.findOne(TeamMember, {
      id: parsed.new_owner_id,
      teamId: parsed.team_id,
      deletedAt: null,
      tenantId: auth.tenantId,
    } as FilterQuery<TeamMember>)
    if (!newOwner) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Cannot transfer to yourself
    if (newOwner.customerUserId === auth.sub) {
      return NextResponse.json({ error: 'You are already the owner' }, { status: 400 })
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
        { error: 'Cannot transfer ownership after hacking has started.' },
        { status: 403 },
      )
    }

    // Transfer: demote current owner to member, promote new owner
    ownership.role = TeamRole.MEMBER
    newOwner.role = TeamRole.OWNER
    em.persist(ownership)
    em.persist(newOwner)
    await em.flush()

    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[portal/transfer-ownership] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Transfer team ownership (portal)',
  methods: { POST: { summary: 'Team owner transfers ownership to another member' } },
}

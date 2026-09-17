import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { Team, TeamMember, TeamRole } from '../../../data/entities'
import { normalizeNeededSkills } from '../../../lib/recruitment'
import { updateTeamRecruitmentSchema } from '../../../data/validators'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

/** Registry resource kind for the team row this route writes to. */
const TEAM_RESOURCE_KIND = 'teams.team'

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
    const parsed = updateTeamRecruitmentSchema.parse(body)
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // Mutation-guard registry — this is a custom (non-`makeCrudRoute`) write route, so it has
    // to run the same guard set a CRUD write to the team row would.
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
        resourceKind: TEAM_RESOURCE_KIND,
        operation: 'update',
        resourceId: parsed.team_id,
        mutationPayload: { ...parsed },
      },
    })
    if (!guard.ok) return guard.response
    const input = guard.modifiedPayload
      ? updateTeamRecruitmentSchema.parse({ ...parsed, ...guard.modifiedPayload })
      : parsed

    // Only the owner speaks for the team. Same rule as inviting and managing tracks.
    const ownership = await em.findOne(TeamMember, {
      teamId: input.team_id,
      customerUserId: auth.sub,
      role: TeamRole.OWNER,
      deletedAt: null,
      tenantId: auth.tenantId,
    } as FilterQuery<TeamMember>)
    if (!ownership) {
      return NextResponse.json({ error: 'Only the team owner can update the recruitment posting' }, { status: 403 })
    }

    const team = await em.findOne(Team, {
      id: input.team_id,
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<Team>)
    if (!team) {
      return NextResponse.json({ error: 'Team not found' }, { status: 404 })
    }

    const lookingForMembers = input.looking_for_members

    // `looking_for_members` is a visibility flag, not a delete button. Closing the posting keeps
    // the skills and the note, so a team that fills a seat and reopens a week later does not have
    // to retype the list — `browse-teams` is what withholds a closed posting from readers.
    //
    // Omitting a field means "leave it as it is"; sending `[]` / `null` clears it explicitly.
    const neededSkills = normalizeNeededSkills(input.needed_skills ?? team.neededSkills)

    const trimmedNote = input.recruitment_note?.trim()
    const recruitmentNote = input.recruitment_note === undefined
      ? (team.recruitmentNote ?? null)
      : (trimmedNote || null)

    team.lookingForMembers = lookingForMembers
    team.neededSkills = neededSkills
    team.recruitmentNote = recruitmentNote
    em.persist(team)

    await em.flush()

    try {
      const eventBus = container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
      await eventBus.emit('teams.team.updated', {
        teamId: team.id,
        competitionId: team.competitionId,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
      })
    } catch (e) {
      console.error('[portal/update-recruitment] Event emit error:', e)
    }

    // After the write has committed, never before.
    await guard.runAfterSuccess()

    return NextResponse.json({
      ok: true,
      looking_for_members: lookingForMembers,
      needed_skills: neededSkills,
      recruitment_note: recruitmentNote,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[portal/update-recruitment] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Update team recruitment posting',
  methods: {
    POST: { summary: 'Publish or withdraw the skills a team is recruiting for' },
  },
}

import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { Team, TeamMember, TeamRole } from '../../../data/entities'
import { MAX_RECRUITMENT_NOTE_LENGTH, MAX_NEEDED_SKILLS, MAX_SKILL_LENGTH, normalizeNeededSkills } from '../../../lib/recruitment'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

/** Registry resource kind for the team row this route writes to. */
const TEAM_RESOURCE_KIND = 'teams.team'

/**
 * The team owner publishes or withdraws the team's recruitment posting: *"we are looking for
 * someone with these skills"*.
 *
 * The schema is deliberately looser than the stored shape — `normalizeNeededSkills` is what
 * trims, de-duplicates and caps the list. The bounds here only stop an absurd payload from
 * reaching it.
 */
const updateRecruitmentSchema = z.object({
  team_id: z.string().uuid(),
  looking_for_members: z.boolean(),
  needed_skills: z.array(z.string().max(MAX_SKILL_LENGTH * 2)).max(MAX_NEEDED_SKILLS * 4).optional(),
  recruitment_note: z.string().max(MAX_RECRUITMENT_NOTE_LENGTH).nullable().optional(),
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
    const parsed = updateRecruitmentSchema.parse(body)
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
      ? updateRecruitmentSchema.parse({ ...parsed, ...guard.modifiedPayload })
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

    // Closing the posting clears it rather than parking stale wants on a team that is done
    // recruiting — a closed posting that still lists "React" reads as an open one the moment
    // anything surfaces the fields without checking the flag.
    const neededSkills = lookingForMembers
      ? normalizeNeededSkills(input.needed_skills ?? team.neededSkills)
      : []

    const trimmedNote = input.recruitment_note?.trim()
    const recruitmentNote = lookingForMembers
      ? (input.recruitment_note === undefined ? (team.recruitmentNote ?? null) : (trimmedNote || null))
      : null

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

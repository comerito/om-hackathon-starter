import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'

import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { AuthContext } from '@open-mercato/shared/lib/auth/server'
import { TeamInvitation, InvitationType, InvitationStatus } from '../../data/entities'
import { createTeamInvitationSchema, listTeamInvitationSchema, teamInvitationListItemSchema } from '../../data/validators'
import { teamsTag, errorSchema, createdSchema, createTeamsPagedListResponseSchema } from '../openapi'

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata = {
  GET: { requireAuth: true },
  POST: { requireAuth: true },
}

// ---------------------------------------------------------------------------
// GET — list invitations
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  _ctx: { params: Record<string, string | string[]>; auth: AuthContext },
) {
  const url = new URL(req.url)
  const rawQuery: Record<string, string> = {}
  url.searchParams.forEach((value, key) => { rawQuery[key] = value })

  const parsed = listTeamInvitationSchema.safeParse(rawQuery)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query parameters', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { page, pageSize, sortField, sortDir, teamId, inviteeId, status, competitionId, type } = parsed.data
  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager

  const where: Record<string, unknown> = {}
  if (teamId) where.team_id = teamId
  if (inviteeId) where.invitee_id = inviteeId
  if (status) where.status = status
  if (competitionId) where.competition_id = competitionId
  if (type) where.type = type

  const knex = em.getKnex()
  const baseQuery = knex('teams_invitation').where(where)

  // Count total
  const [{ count: totalStr }] = await baseQuery.clone().count('* as count')
  const total = Number(totalStr) || 0
  const totalPages = Math.ceil(total / pageSize)

  // Fetch page
  const offset = (page - 1) * pageSize
  const dbSortField = sortField === 'created_at' ? 'created_at' : sortField
  const items = await baseQuery
    .clone()
    .select('*')
    .orderBy(dbSortField, sortDir)
    .limit(pageSize)
    .offset(offset)

  const data = items.map((row: Record<string, unknown>) => ({
    id: String(row.id),
    teamId: String(row.team_id),
    inviterId: String(row.inviter_id),
    inviteeId: String(row.invitee_id),
    type: String(row.type),
    status: String(row.status),
    message: row.message ? String(row.message) : null,
    createdAt: row.created_at ? new Date(row.created_at as string).toISOString() : null,
    respondedAt: row.responded_at ? new Date(row.responded_at as string).toISOString() : null,
    expiresAt: row.expires_at ? new Date(row.expires_at as string).toISOString() : null,
    competitionId: String(row.competition_id),
  }))

  return NextResponse.json({ data, total, page, pageSize, totalPages })
}

// ---------------------------------------------------------------------------
// POST — create invitation or join request
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  ctx: { params: Record<string, string | string[]>; auth: AuthContext },
) {
  const body = await req.json().catch(() => ({}))
  const parsed = createTeamInvitationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { teamId, inviteeId, type, message, competitionId, expiresInHours } = parsed.data
  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const inviterId = ctx.auth?.sub ?? ''

  // Check for existing pending invitation
  const existingPending = await em.findOne(TeamInvitation, {
    teamId,
    inviteeId,
    status: InvitationStatus.PENDING,
  } as FilterQuery<TeamInvitation>)

  if (existingPending) {
    return NextResponse.json(
      { error: 'A pending invitation already exists for this user and team' },
      { status: 422 },
    )
  }

  const expiresAt = new Date(Date.now() + (expiresInHours ?? 48) * 60 * 60 * 1000)

  let invitation: TeamInvitation | null = null
  await em.transactional(async () => {
    invitation = new TeamInvitation()
    invitation.teamId = teamId
    invitation.inviterId = inviterId
    invitation.inviteeId = inviteeId
    invitation.type = type as InvitationType
    invitation.status = InvitationStatus.PENDING
    invitation.message = message ?? null
    invitation.expiresAt = expiresAt
    invitation.competitionId = competitionId
    invitation.tenantId = ctx.auth?.tenantId ?? ''
    invitation.organizationId = ((ctx.auth as Record<string, unknown>)?.orgId as string) ?? ''
    em.persist(invitation)
    await em.flush()
  })

  // Emit event
  try {
    const eventBus = container.resolve('eventBus') as {
      emit?: (event: string, payload: unknown) => Promise<void>
      emitEvent?: (event: string, payload: unknown) => Promise<void>
    }

    const eventPayload = {
      invitationId: invitation ? (invitation as TeamInvitation).id : null,
      teamId,
      inviterId,
      inviteeId,
      type,
      competitionId,
    }

    if (typeof eventBus.emit === 'function') {
      await eventBus.emit('teams.invitation.created', eventPayload)
    } else if (typeof eventBus.emitEvent === 'function') {
      await eventBus.emitEvent('teams.invitation.created', eventPayload)
    }
  } catch (err) {
    console.warn('[teams] Failed to emit invitation.created event', {
      teamId,
      inviteeId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return NextResponse.json(
    { id: invitation ? (invitation as TeamInvitation).id : null },
    { status: 201 },
  )
}

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

export const openApi: OpenApiRouteDoc = {
  GET: {
    summary: 'List team invitations',
    description: 'Returns a paginated list of team invitations, filtered by team, invitee, status, competition, or type.',
    tags: [teamsTag],
    responses: {
      200: {
        description: 'Paginated invitation list',
        content: {
          'application/json': {
            schema: createTeamsPagedListResponseSchema(teamInvitationListItemSchema),
          },
        },
      },
    },
  },
  POST: {
    summary: 'Create an invitation or join request',
    description: 'Creates a new team invitation (from team to user) or join request (from user to team).',
    tags: [teamsTag],
    requestBody: {
      required: true,
      content: {
        'application/json': { schema: createTeamInvitationSchema },
      },
    },
    responses: {
      201: {
        description: 'Invitation created',
        content: { 'application/json': { schema: createdSchema } },
      },
      400: {
        description: 'Invalid request body',
        content: { 'application/json': { schema: errorSchema } },
      },
      422: {
        description: 'Pending invitation already exists',
        content: { 'application/json': { schema: errorSchema } },
      },
    },
  },
}

import { NextResponse, type NextRequest } from 'next/server'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'

import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { AuthContext } from '@open-mercato/shared/lib/auth/server'
import { TeamInvitation, InvitationStatus } from '../../../data/entities'
import { declineInvitationSchema } from '../../../data/validators'
import { teamsTag, okSchema, errorSchema } from '../../openapi'

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata = {
  POST: { requireAuth: true },
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(
  req: NextRequest,
  _ctx: { params: Record<string, string | string[]>; auth: AuthContext },
) {
  const body = await req.json().catch(() => ({}))
  const parsed = declineInvitationSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { invitationId } = parsed.data
  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager

  const invitation = await em.findOne(TeamInvitation, {
    id: invitationId,
    status: InvitationStatus.PENDING,
  } as FilterQuery<TeamInvitation>)

  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found or no longer pending' }, { status: 404 })
  }

  await em.transactional(async () => {
    invitation.status = InvitationStatus.DECLINED
    invitation.respondedAt = new Date()
    await em.flush()
  })

  // Emit event
  try {
    const eventBus = container.resolve('eventBus') as {
      emit?: (event: string, payload: unknown) => Promise<void>
      emitEvent?: (event: string, payload: unknown) => Promise<void>
    }

    const eventPayload = {
      invitationId: invitation.id,
      teamId: invitation.teamId,
      inviteeId: invitation.inviteeId,
      type: invitation.type,
      competitionId: invitation.competitionId,
      tenantId: invitation.tenantId,
      organizationId: invitation.organizationId,
    }

    if (typeof eventBus.emit === 'function') {
      await eventBus.emit('teams.invitation.declined', eventPayload)
    } else if (typeof eventBus.emitEvent === 'function') {
      await eventBus.emitEvent('teams.invitation.declined', eventPayload)
    }
  } catch (err) {
    console.warn('[teams] Failed to emit invitation.declined event', {
      invitationId,
      error: err instanceof Error ? err.message : String(err),
    })
  }

  return NextResponse.json({ ok: true })
}

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

export const openApi: OpenApiRouteDoc = {
  POST: {
    summary: 'Decline an invitation or join request',
    description: 'Declines a pending invitation and marks it with a responded timestamp.',
    tags: [teamsTag],
    requestBody: {
      required: true,
      content: {
        'application/json': { schema: declineInvitationSchema },
      },
    },
    responses: {
      200: {
        description: 'Invitation declined',
        content: { 'application/json': { schema: okSchema } },
      },
      400: {
        description: 'Invalid request body',
        content: { 'application/json': { schema: errorSchema } },
      },
      404: {
        description: 'Invitation not found or not pending',
        content: { 'application/json': { schema: errorSchema } },
      },
    },
  },
}

import { NextResponse } from 'next/server'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['competitions.participants.manage'] },
}

type ParticipantInvitationRow = {
  id: string
  customer_invitation_id: string
  competition_id: string
  participation_role: string | null
  created_at: string | Date | null
  email: string | null
  display_name: string | null
  accepted_at: string | Date | null
  cancelled_at: string | Date | null
  expires_at: string | Date | null
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    const url = new URL(req.url)
    const customerUserId = url.searchParams.get('customer_user_id')
    const competitionId = url.searchParams.get('competition_id')

    if (!customerUserId || !competitionId) {
      return NextResponse.json({ error: 'customer_user_id and competition_id required' }, { status: 400 })
    }

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // Find competition invitations for this user+competition, joined with framework invitation data
    // The second OR branch also matches by direct email lookup from customer_user_invitations
    // joined to competitions_invitation.
    const rows = await em.getConnection().execute<ParticipantInvitationRow[]>(
      `SELECT
         ci.id,
         ci.customer_invitation_id,
         ci.competition_id,
         ci.participation_role,
         ci.created_at,
         cui.email,
         cui.display_name,
         cui.accepted_at,
         cui.cancelled_at,
         cui.expires_at
       FROM competitions_invitation AS ci
       INNER JOIN customer_user_invitations AS cui ON cui.id = ci.customer_invitation_id
       WHERE (
           ci.competition_id = ?
           AND ci.tenant_id = ?
           AND cui.email_hash = (SELECT email_hash FROM customer_users WHERE id = ? AND tenant_id = ? LIMIT 1)
         )
         OR (
           ci.competition_id = ?
           AND ci.tenant_id = ?
         )
       ORDER BY ci.created_at DESC
       LIMIT 20`,
      [competitionId, auth.tenantId, customerUserId, auth.tenantId, competitionId, auth.tenantId],
    )

    // Filter to only invitations whose email matches the customer user's email
    // First get the user's email
    const userRows = await em.getConnection().execute<Array<{ email: string | null }>>(
      `SELECT email FROM customer_users WHERE id = ? AND tenant_id = ? LIMIT 1`,
      [customerUserId, auth.tenantId],
    )
    const userRow = userRows[0]

    const userEmail = userRow?.email?.toLowerCase()

    const filtered = userEmail
      ? rows.filter((r) => r.email?.toLowerCase() === userEmail)
      : rows

    return NextResponse.json({
      items: filtered.map((r) => ({
        id: r.id,
        customer_invitation_id: r.customer_invitation_id,
        competition_id: r.competition_id,
        participation_role: r.participation_role,
        created_at: r.created_at,
        _invitation: {
          email: r.email,
          display_name: r.display_name,
          accepted_at: r.accepted_at,
          cancelled_at: r.cancelled_at,
          expires_at: r.expires_at,
        },
      })),
    })
  } catch (error) {
    console.error('[admin/participant-invitations] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Competitions',
  summary: 'Participant invitations',
  methods: { GET: { summary: 'List invitations for a participant in a competition' } },
}

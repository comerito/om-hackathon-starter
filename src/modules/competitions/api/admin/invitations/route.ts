import { NextResponse } from 'next/server'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { resolveOrganizationScopeForRequest } from '@open-mercato/core/modules/directory/utils/organizationScope'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['competitions.participants.manage'] },
}

type InvitationRow = {
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
    const competitionId = url.searchParams.get('competition_id')
    const status = url.searchParams.get('status') // pending | accepted | expired | all

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // Resolve organization scope from the request (cookie-selected org)
    const scope = await resolveOrganizationScopeForRequest({ container, auth, request: req })
    const organizationIds = scope.filterIds

    const conds: string[] = ['ci.tenant_id = ?']
    const values: unknown[] = [auth.tenantId]

    if (competitionId) {
      conds.push('ci.competition_id = ?')
      values.push(competitionId)
    }
    if (organizationIds && organizationIds.length > 0) {
      conds.push(`ci.organization_id IN (${organizationIds.map(() => '?').join(', ')})`)
      values.push(...organizationIds)
    }

    const rows = await em.getConnection().execute<InvitationRow[]>(
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
       WHERE ${conds.join(' AND ')}
       ORDER BY ci.created_at DESC
       LIMIT 200`,
      values,
    )

    // Also fetch competition names
    const compIds = [...new Set(rows.map((r) => r.competition_id))]
    const compRows = compIds.length > 0
      ? await em.getConnection().execute<Array<{ id: string; name: string }>>(
          `SELECT id, name FROM competitions_competition WHERE id IN (${compIds.map(() => '?').join(', ')})`,
          compIds,
        )
      : []
    const compMap = new Map<string, string>(compRows.map((r) => [r.id, r.name]))

    const now = Date.now()
    const items = rows.map((r) => {
      const isAccepted = !!r.accepted_at
      const isCancelled = !!r.cancelled_at
      const isExpired = r.expires_at ? new Date(r.expires_at).getTime() < now : false
      let invStatus = 'pending'
      if (isAccepted) invStatus = 'accepted'
      else if (isCancelled) invStatus = 'cancelled'
      else if (isExpired) invStatus = 'expired'

      return {
        id: r.id,
        competition_id: r.competition_id,
        competition_name: compMap.get(r.competition_id) ?? null,
        participation_role: r.participation_role,
        email: r.email,
        display_name: r.display_name,
        status: invStatus,
        accepted_at: r.accepted_at,
        cancelled_at: r.cancelled_at,
        expires_at: r.expires_at,
        created_at: r.created_at,
      }
    })

    // Filter by status if requested
    const filtered = status && status !== 'all'
      ? items.filter((i: any) => i.status === status)
      : items

    return NextResponse.json({ items: filtered, total: filtered.length })
  } catch (error) {
    console.error('[admin/invitations] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Competitions',
  summary: 'Competition invitations list',
  methods: { GET: { summary: 'List all competition invitations with status' } },
}

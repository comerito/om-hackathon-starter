/**
 * Portal-facing API: GET /api/competitions/portal/data?type=<type>&competitionId=<id>
 *
 * Unified portal data endpoint. Returns data for portal pages using customer auth.
 * Supports: tracks, teams, projects, sponsors, prizes, agenda, announcements, participations
 */
import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'

export const metadata = {
  GET: { requireAuth: false },
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const type = url.searchParams.get('type')
  const competitionId = url.searchParams.get('competitionId')

  if (!type) {
    return NextResponse.json({ error: 'Missing type parameter' }, { status: 400 })
  }

  const customerAuth = await getCustomerAuthFromRequest(req)
  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const knex = (em.getConnection() as any).getKnex()

  // Build base tenant filter
  const tenantFilter: Record<string, string> = {}
  if (customerAuth?.tenantId) tenantFilter.tenant_id = customerAuth.tenantId
  if (customerAuth?.orgId) tenantFilter.organization_id = customerAuth.orgId

  try {
    let query: any
    switch (type) {
      case 'tracks':
        if (!competitionId) return NextResponse.json({ error: 'competitionId required' }, { status: 400 })
        query = knex('tracks_track').where({ competition_id: competitionId, ...tenantFilter }).orderBy('order', 'asc')
        break

      case 'teams':
        if (!competitionId) return NextResponse.json({ error: 'competitionId required' }, { status: 400 })
        query = knex('teams_team').where({ competition_id: competitionId, is_active: true, ...tenantFilter }).orderBy('name', 'asc')
        break

      case 'projects':
        if (!competitionId) return NextResponse.json({ error: 'competitionId required' }, { status: 400 })
        query = knex('projects_project').where({ competition_id: competitionId, is_active: true, ...tenantFilter }).orderBy('title', 'asc')
        break

      case 'sponsors':
        if (!competitionId) return NextResponse.json({ error: 'competitionId required' }, { status: 400 })
        query = knex('sponsors_sponsor').where({ competition_id: competitionId, is_visible: true, is_active: true, ...tenantFilter }).orderBy('order', 'asc')
        break

      case 'prizes':
        if (!competitionId) return NextResponse.json({ error: 'competitionId required' }, { status: 400 })
        query = knex('sponsors_prize').where({ competition_id: competitionId, ...tenantFilter }).orderBy('order', 'asc')
        break

      case 'agenda':
        if (!competitionId) return NextResponse.json({ error: 'competitionId required' }, { status: 400 })
        query = knex('competitions_agenda_item').where({ competition_id: competitionId, ...tenantFilter }).orderBy('order', 'asc')
        break

      case 'announcements':
        if (!competitionId) return NextResponse.json({ error: 'competitionId required' }, { status: 400 })
        query = knex('competitions_announcement').where({ competition_id: competitionId, ...tenantFilter }).orderBy('published_at', 'desc')
        break

      case 'participations':
        if (!competitionId) return NextResponse.json({ error: 'competitionId required' }, { status: 400 })
        query = knex('competitions_participation').where({ competition_id: competitionId, ...tenantFilter }).orderBy('created_at', 'desc')
        break

      case 'criteria':
        if (!competitionId) return NextResponse.json({ error: 'competitionId required' }, { status: 400 })
        query = knex('judging_criterion').where({ competition_id: competitionId, deleted_at: null, ...tenantFilter }).orderBy('order', 'asc')
        break

      case 'panels':
        if (!competitionId) return NextResponse.json({ error: 'competitionId required' }, { status: 400 })
        query = knex('judging_panel').where({ competition_id: competitionId, deleted_at: null, ...tenantFilter }).orderBy('created_at', 'asc')
        break

      case 'demos':
        if (!competitionId) return NextResponse.json({ error: 'competitionId required' }, { status: 400 })
        query = knex('judging_demo_session').where({ competition_id: competitionId, ...tenantFilter }).orderBy('presentation_order', 'asc')
        break

      case 'incidents':
        if (!competitionId) return NextResponse.json({ error: 'competitionId required' }, { status: 400 })
        query = knex('incidents_report').where({ competition_id: competitionId, ...tenantFilter }).orderBy('created_at', 'desc')
        break

      default:
        return NextResponse.json({ error: `Unknown type: ${type}` }, { status: 400 })
    }

    const items = await query
    return NextResponse.json({ items, total: items.length })
  } catch (err) {
    console.error(`[portal/data] Error fetching ${type}:`, err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

export const openApi = {
  GET: {
    summary: 'Fetch portal data by type',
    tags: ['Portal - Data'],
    responses: { 200: { description: 'Portal data' } },
  },
}

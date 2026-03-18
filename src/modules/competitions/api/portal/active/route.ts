/**
 * Portal-facing API: GET /api/competitions/portal/active
 *
 * Returns the active competition with related data for portal pages.
 * Uses customer auth (not staff auth) for tenant scoping.
 */
import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import { Competition } from '../../../data/entities'

export const metadata = {
  GET: { requireAuth: false },
}

export async function GET(req: Request) {
  const customerAuth = await getCustomerAuthFromRequest(req)
  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager

  const where: Record<string, unknown> = { isActive: true, deletedAt: null }
  if (customerAuth?.tenantId) where.tenantId = customerAuth.tenantId
  if (customerAuth?.orgId) where.organizationId = customerAuth.orgId

  const competition = await em.findOne(Competition, where as any, {
    orderBy: { createdAt: 'DESC' },
  })

  if (!competition) {
    return NextResponse.json({ items: [], total: 0 })
  }

  return NextResponse.json({
    items: [{
      id: competition.id,
      name: competition.name,
      slug: competition.slug,
      description: competition.description,
      location: competition.location,
      stage: competition.stage,
      starts_at: competition.startsAt,
      ends_at: competition.endsAt,
      timezone: competition.timezone,
      min_team_size: competition.minTeamSize,
      max_team_size: competition.maxTeamSize,
      code_of_conduct_url: competition.codeOfConductUrl,
      is_active: competition.isActive,
    }],
    total: 1,
  })
}

export const openApi = {
  GET: {
    summary: 'Get active competition for portal',
    tags: ['Portal - Competitions'],
    responses: { 200: { description: 'Active competition' } },
  },
}

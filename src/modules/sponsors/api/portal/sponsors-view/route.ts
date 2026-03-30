import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { Sponsor, Prize } from '../../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { applyPortalTranslationOverlays, resolvePortalLocale } from '@/lib/portal-translations'

export const metadata = { GET: { requireCustomerAuth: true } }

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    const url = new URL(req.url)
    const competitionId = url.searchParams.get('competition_id')
    if (!competitionId) return NextResponse.json({ error: 'competition_id required' }, { status: 400 })

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const locale = resolvePortalLocale(req)

    const sponsors = await em.find(Sponsor, {
      competitionId, isVisible: true, deletedAt: null, tenantId: auth.tenantId, organizationId: auth.orgId,
    } as FilterQuery<Sponsor>, { orderBy: { order: 'ASC' } })

    const prizes = await em.find(Prize, {
      competitionId, deletedAt: null, tenantId: auth.tenantId, organizationId: auth.orgId,
    } as FilterQuery<Prize>, { orderBy: { order: 'ASC' } })

    const translatedSponsors = await applyPortalTranslationOverlays(
      sponsors.map(s => ({
        id: s.id, name: s.name, tier: s.tier, logo_url: s.logoUrl,
        website_url: s.websiteUrl, description: s.description,
        challenge_title: s.challengeTitle, challenge_description: s.challengeDescription,
        challenge_resources_url: s.challengeResourcesUrl,
      })),
      {
        entityType: 'sponsors:sponsor',
        locale,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
        container,
      },
    )

    const translatedPrizes = await applyPortalTranslationOverlays(
      prizes.map(p => ({
        id: p.id, name: p.name, description: p.description, category: p.category,
        value: p.value, rank: p.rank, sponsor_id: p.sponsorId, track_id: p.trackId,
        winning_project_id: p.winningProjectId, winning_team_id: p.winningTeamId,
        awarded_at: p.awardedAt?.toISOString() ?? null,
      })),
      {
        entityType: 'sponsors:prize',
        locale,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
        container,
      },
    )

    return NextResponse.json({
      sponsors: translatedSponsors,
      prizes: translatedPrizes,
    })
  } catch (error) {
    console.error('[portal/sponsors-view] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal', summary: 'Sponsors & prizes',
  methods: { GET: { summary: 'Get sponsors and prizes for a competition' } },
}

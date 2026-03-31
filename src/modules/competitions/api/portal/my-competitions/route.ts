import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import { Competition, CompetitionInfoCard, CompetitionParticipation } from '../../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { applyPortalTranslationOverlays, resolvePortalLocale } from '@/lib/portal-translations'

export const metadata = {
  GET: { requireCustomerAuth: true },
}

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const locale = await resolvePortalLocale(req, { auth, container })

    // Find all participations for this customer user
    const participations = await em.find(CompetitionParticipation, {
      customerUserId: auth.sub,
      tenantId: auth.tenantId,
      deletedAt: null,
    })

    if (participations.length === 0) {
      return NextResponse.json({ items: [] })
    }

    // Fetch the corresponding competitions
    const competitionIds = participations.map(p => p.competitionId)
    const competitions = await em.find(Competition, {
      id: { $in: competitionIds },
      tenantId: auth.tenantId,
      deletedAt: null,
      isActive: true,
    })

    const infoCardRows = competitionIds.length > 0 ? await em.find(CompetitionInfoCard, {
      competitionId: { $in: competitionIds },
      tenantId: auth.tenantId,
      deletedAt: null,
    }, { orderBy: { sortOrder: 'asc' } }) : []

    const translatedInfoCards = await applyPortalTranslationOverlays(
      infoCardRows.map((card) => ({
        id: card.id,
        competition_id: card.competitionId,
        key: card.key,
        icon: card.icon ?? null,
        label: card.label,
        value: card.value,
        sort_order: card.sortOrder,
      })),
      {
        entityType: 'competitions:competition_info_card',
        locale,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
        container,
      },
    )
    const infoCardsByCompetition = new Map<string, Array<(typeof translatedInfoCards)[number]>>()
    for (const card of translatedInfoCards) {
      const bucket = infoCardsByCompetition.get(card.competition_id) ?? []
      bucket.push(card)
      infoCardsByCompetition.set(card.competition_id, bucket)
    }

    // Merge participation data with competition data
    const participationMap = new Map(participations.map(p => [p.competitionId, p]))
    const items = competitions.map(c => {
      const p = participationMap.get(c.id)
      return {
        id: c.id,
        name: c.name,
        slug: c.slug,
        description: c.description,
        stage: c.stage,
        starts_at: c.startsAt,
        ends_at: c.endsAt,
        location: c.location,
        timezone: c.timezone,
        max_tracks_per_team: c.maxTracksPerTeam ?? 1,
        allow_track_change: c.allowTrackChange ?? false,
        info_cards: infoCardsByCompetition.get(c.id) ?? [],
        role: p?.role ?? 'participant',
        checked_in: p?.checkedIn ?? false,
        coc_accepted: p?.cocAccepted ?? false,
      }
    })

    const translatedItems = await applyPortalTranslationOverlays(items, {
      entityType: 'competitions:competition',
      locale,
      tenantId: auth.tenantId,
      organizationId: auth.orgId,
      container,
    })

    return NextResponse.json({ items: translatedItems })
  } catch (error) {
    console.error('[portal/my-competitions] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'My competitions',
  methods: {
    GET: { summary: 'List competitions the current user participates in' },
  },
}

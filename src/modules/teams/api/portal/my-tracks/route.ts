import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { TeamMember, TeamTrack } from '../../../data/entities'
import { Track } from '../../../../tracks/data/entities'
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

    const url = new URL(req.url)
    const competitionId = url.searchParams.get('competition_id')
    if (!competitionId) {
      return NextResponse.json({ error: 'competition_id is required' }, { status: 400 })
    }

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const locale = resolvePortalLocale(req)

    // Find user's team membership
    const membership = await em.findOne(TeamMember, {
      customerUserId: auth.sub,
      competitionId,
      deletedAt: null,
    } as FilterQuery<TeamMember>)

    if (!membership) {
      return NextResponse.json({ track_ids: [], tracks: [] })
    }

    // Get team's track assignments from junction table
    const teamTracks = await em.find(TeamTrack, {
      teamId: membership.teamId,
      competitionId,
    } as FilterQuery<TeamTrack>)

    const trackIds = teamTracks.map(tt => tt.trackId)

    // Fetch track details
    let tracks: Array<{ id: string; name: string; color: string; description: string | null }> = []
    if (trackIds.length > 0) {
      const trackEntities = await em.find(Track, {
        id: { $in: trackIds },
      } as FilterQuery<Track>)
      tracks = await applyPortalTranslationOverlays(
        trackEntities.map(t => ({
          id: t.id,
          name: t.name,
          color: t.color,
          description: t.description ?? null,
        })),
        {
          entityType: 'tracks:track',
          locale,
          tenantId: auth.tenantId,
          organizationId: auth.orgId,
          container,
        },
      )
    }

    return NextResponse.json({ track_ids: trackIds, tracks })
  } catch (error) {
    console.error('[portal/my-tracks] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'My team tracks',
  methods: { GET: { summary: 'Get the tracks assigned to the current user\'s team' } },
}

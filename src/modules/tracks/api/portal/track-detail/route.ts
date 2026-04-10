import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { Track } from '../../../data/entities'
import { JudgingCriterion } from '../../../../judging/data/entities'
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
    const trackId = url.searchParams.get('track_id')
    if (!trackId) {
      return NextResponse.json({ error: 'track_id required' }, { status: 400 })
    }

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const locale = await resolvePortalLocale(req, { auth, container })

    // Load track
    const track = await em.findOne(Track, {
      id: trackId,
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<Track>)
    if (!track) {
      return NextResponse.json({ error: 'Track not found' }, { status: 404 })
    }

    // Load criteria (track-specific + global) for this track's competition
    const criteria = await em.find(JudgingCriterion, {
      competitionId: track.competitionId,
      deletedAt: null,
      $or: [{ trackId: null }, { trackId: track.id }],
    } as FilterQuery<JudgingCriterion>, { orderBy: { order: 'ASC' } })

    // Load attachments from the attachments module
    let attachments: Array<{ id: string; file_name: string; file_size: number; url: string; mime_type: string }> = []
    try {
      const attachmentRepo = container.resolve('em') as EntityManager
      const rawAttachments = await attachmentRepo.getConnection().execute(
        `SELECT id, file_name, file_size, url, mime_type FROM attachments WHERE entity_id = 'tracks:track' AND record_id = ? ORDER BY created_at`,
        [trackId],
      )
      // Rewrite URLs to use the portal endpoint (core endpoint requires backend auth)
      attachments = (rawAttachments as typeof attachments).map(att => ({
        ...att,
        url: `/api/tracks/portal/attachment-file/${att.id}`,
      }))
    } catch {
      // Attachments module may not be available — continue without
    }

    const [translatedTrack] = await applyPortalTranslationOverlays([{
        id: track.id,
        name: track.name,
        short_description: track.shortDescription ?? null,
        description: track.description ?? null,
        color: track.color,
        icon_url: track.iconUrl ?? null,
        max_teams: track.maxTeams ?? null,
        category: track.category ?? null,
        badge: track.badge ?? null,
        competition_id: track.competitionId,
      }], {
      entityType: 'tracks:track',
      locale,
      tenantId: auth.tenantId,
      organizationId: auth.orgId,
      container,
    })

    const translatedCriteria = await applyPortalTranslationOverlays(
      criteria.map(c => ({
        id: c.id,
        name: c.name,
        description: c.description ?? null,
        max_score: c.maxScore,
        weight: c.weight,
        round: c.round,
        order: c.order,
        is_global: c.trackId === null,
      })),
      {
        entityType: 'judging:judging_criterion',
        locale,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
        container,
      },
    )

    return NextResponse.json({
      track: translatedTrack,
      criteria: translatedCriteria,
      attachments,
    })
  } catch (error) {
    console.error('[portal/track-detail] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Track detail (portal)',
  methods: { GET: { summary: 'Get track details with criteria and attachments' } },
}

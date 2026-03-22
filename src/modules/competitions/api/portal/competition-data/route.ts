import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import { AgendaItem, Announcement, CompetitionParticipation } from '../../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

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

    // Verify the user participates in this competition
    const participation = await em.findOne(CompetitionParticipation, {
      competitionId,
      customerUserId: auth.sub,
      tenantId: auth.tenantId,
      deletedAt: null,
    })
    if (!participation) {
      return NextResponse.json({ error: 'Not a participant in this competition' }, { status: 403 })
    }

    const dataType = url.searchParams.get('type') ?? 'agenda'

    if (dataType === 'agenda') {
      const items = await em.find(AgendaItem, {
        competitionId,
        tenantId: auth.tenantId,
      }, { orderBy: { startsAt: 'asc' } })

      return NextResponse.json({
        items: items.map(i => ({
          id: i.id, title: i.title, description: i.description, type: i.type,
          starts_at: i.startsAt, ends_at: i.endsAt, location: i.location,
          speaker_name: i.speakerName, is_mandatory: i.isMandatory,
        })),
      })
    }

    if (dataType === 'announcements') {
      const items = await em.find(Announcement, {
        competitionId,
        tenantId: auth.tenantId,
        deletedAt: null,
      }, { orderBy: { createdAt: 'desc' } })

      return NextResponse.json({
        items: items.map(a => ({
          id: a.id, title: a.title, content: a.content, priority: a.priority,
          pinned: a.pinned, published_at: a.publishedAt, target_roles: a.targetRoles,
        })),
      })
    }

    return NextResponse.json({ error: 'Invalid type parameter' }, { status: 400 })
  } catch (error) {
    console.error('[portal/competition-data] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Competition data',
  methods: {
    GET: { summary: 'Get agenda or announcements for a competition (portal)' },
  },
}

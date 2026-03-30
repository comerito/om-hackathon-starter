import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import { AgendaItem, Announcement, CompetitionParticipation, Milestone } from '../../../data/entities'
import { Track } from '../../../../tracks/data/entities'
import { Project } from '../../../../projects/data/entities'
import { Team } from '../../../../teams/data/entities'
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
          speaker_name: i.speakerName, speaker_bio: i.speakerBio ?? null,
          speaker_photo_url: i.speakerPhotoUrl ?? null, is_mandatory: i.isMandatory,
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
          category: a.category, action_url: a.actionUrl, action_label: a.actionLabel,
        })),
      })
    }

    if (dataType === 'tracks') {
      const items = await em.find(Track, {
        competitionId,
        tenantId: auth.tenantId,
      }, { orderBy: { order: 'asc' } })

      return NextResponse.json({
        items: items.map(t => ({
          id: t.id, name: t.name, short_description: t.shortDescription ?? null,
          description: t.description, color: t.color,
          icon_url: t.iconUrl, max_teams: t.maxTeams, order: t.order,
          category: t.category, badge: t.badge,
        })),
      })
    }

    if (dataType === 'milestones') {
      const items = await em.find(Milestone, {
        competitionId,
        tenantId: auth.tenantId,
      }, { orderBy: { sortOrder: 'asc' } })
      return NextResponse.json({
        items: items.map(m => ({
          id: m.id, name: m.name, description: m.description,
          due_date: m.dueDate, status: m.status, sort_order: m.sortOrder,
        })),
      })
    }

    if (dataType === 'projects') {
      const statusFilter = url.searchParams.get('status') ?? 'published'
      const items = await em.find(Project, {
        competitionId,
        tenantId: auth.tenantId,
        status: statusFilter,
        deletedAt: null,
      } as any, { orderBy: { title: 'asc' } })

      // Resolve team names
      const teamIds = [...new Set(items.map(p => p.teamId))]
      let teamMap = new Map<string, string>()
      if (teamIds.length > 0) {
        const teams = await em.find(Team, { id: { $in: teamIds } } as any)
        teamMap = new Map(teams.map(t => [t.id, t.name]))
      }

      return NextResponse.json({
        items: items.map(p => ({
          id: p.id, title: p.title, tagline: p.tagline,
          team_id: p.teamId, track_id: p.trackId,
          team_name: teamMap.get(p.teamId) ?? null,
        })),
      })
    }

    return NextResponse.json({ error: 'Invalid type parameter. Supported: agenda, announcements, tracks, milestones, projects' }, { status: 400 })
  } catch (error) {
    console.error('[portal/competition-data] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Competition data',
  methods: {
    GET: { summary: 'Get agenda, announcements, tracks, milestones, or projects for a competition (portal)' },
  },
}

import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { DemoSession, DemoStatus } from '../../../data/entities'
import { Team } from '../../../../teams/data/entities'
import { Project } from '../../../../projects/data/entities'
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
    const locale = await resolvePortalLocale(req, { auth, container })

    // Find currently active demo (presenting or qa)
    const activeDemos = await em.find(DemoSession, {
      competitionId, tenantId: auth.tenantId,
      status: { $in: [DemoStatus.PRESENTING, DemoStatus.QA, DemoStatus.ON_DECK] },
    } as FilterQuery<DemoSession>, { orderBy: { presentationOrder: 'ASC' } })

    // Find full queue
    const queue = await em.find(DemoSession, {
      competitionId, tenantId: auth.tenantId,
    } as FilterQuery<DemoSession>, { orderBy: { presentationOrder: 'ASC' } })

    // Get team/project names
    const teamIds = [...new Set(queue.map(d => d.teamId))]
    const projectIds = [...new Set(queue.map(d => d.projectId))]
    const teams = teamIds.length ? await em.find(Team, { id: { $in: teamIds } } as FilterQuery<Team>) : []
    const projects = projectIds.length ? await em.find(Project, { id: { $in: projectIds } } as FilterQuery<Project>) : []
    const teamMap = new Map(teams.map(t => [t.id, t.name]))
    const translatedProjects = await applyPortalTranslationOverlays(
      projects.map(p => ({ id: p.id, title: p.title })),
      {
        entityType: 'projects:project',
        locale,
        tenantId: auth.tenantId,
        organizationId: auth.orgId,
        container,
      },
    )
    const projectMap = new Map(translatedProjects.map(p => [p.id, p.title]))

    const presenting = activeDemos.find(d => d.status === DemoStatus.PRESENTING || d.status === DemoStatus.QA) ?? null
    const onDeck = activeDemos.find(d => d.status === DemoStatus.ON_DECK) ?? null

    function mapDemo(d: DemoSession) {
      return {
        id: d.id, team_id: d.teamId, project_id: d.projectId, track_id: d.trackId,
        team_name: teamMap.get(d.teamId) ?? null,
        project_title: projectMap.get(d.projectId) ?? null,
        presentation_order: d.presentationOrder, status: d.status,
        actual_start: d.actualStart?.toISOString() ?? null,
        presentation_duration_minutes: d.presentationDurationMinutes,
        qa_duration_minutes: d.qaDurationMinutes,
        round: d.round,
      }
    }

    return NextResponse.json({
      presenting: presenting ? mapDemo(presenting) : null,
      on_deck: onDeck ? mapDemo(onDeck) : null,
      queue: queue.map(mapDemo),
      server_time: Date.now(),
    })
  } catch (error) {
    console.error('[portal/current-demo] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal', summary: 'Current demo session',
  methods: { GET: { summary: 'Get current presenting demo and full queue' } },
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { DemoSession, DemoStatus } from '../../data/entities'
import { Project, ProjectStatus } from '../../../projects/data/entities'
import { Competition } from '../../../competitions/data/entities'
import { Team } from '../../../teams/data/entities'
import { Track } from '../../../tracks/data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const generateSchema = z.object({
  action: z.literal('generate'),
  competition_id: z.string().uuid(),
  round: z.enum(['preliminary', 'final']).default('preliminary'),
})

const advanceSchema = z.object({
  action: z.literal('advance'),
  id: z.string().uuid(),
  status: z.enum(['on_deck', 'presenting', 'qa', 'completed', 'skipped']),
})

const postBodySchema = z.discriminatedUnion('action', [generateSchema, advanceSchema])

const reorderSchema = z.object({
  id: z.string().uuid(),
  new_order: z.number().int().min(0),
})

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['judging.view'] },
  POST: { requireAuth: true, requireFeatures: ['judging.demos.manage'] },
  PUT: { requireAuth: true, requireFeatures: ['judging.demos.manage'] },
}

export async function GET(req: Request) {
  try {
    const auth = await getAuthFromCookies()
    if (!auth?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const url = new URL(req.url)
    const competitionId = url.searchParams.get('competition_id')
    const round = url.searchParams.get('round') || 'preliminary'

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    const where: Record<string, unknown> = { tenantId: auth.tenantId }
    if (competitionId) where.competitionId = competitionId
    if (round) where.round = round

    const demos = await em.find(DemoSession, where as FilterQuery<DemoSession>, {
      orderBy: { presentationOrder: 'ASC' },
    })

    const teamIds = [...new Set(demos.map(d => d.teamId))]
    const projectIds = [...new Set(demos.map(d => d.projectId))]
    const trackIds = [...new Set(demos.map(d => d.trackId))]
    const [teams, projects, tracks] = await Promise.all([
      teamIds.length
        ? em.find(Team, { id: { $in: teamIds }, tenantId: auth.tenantId } as FilterQuery<Team>)
        : Promise.resolve([]),
      projectIds.length
        ? em.find(Project, { id: { $in: projectIds }, tenantId: auth.tenantId } as FilterQuery<Project>)
        : Promise.resolve([]),
      trackIds.length
        ? em.find(Track, { id: { $in: trackIds }, tenantId: auth.tenantId } as FilterQuery<Track>)
        : Promise.resolve([]),
    ])
    const teamMap = new Map(teams.map(team => [team.id, team.name]))
    const projectMap = new Map(projects.map(project => [project.id, project.title]))
    const trackMap = new Map(tracks.map(track => [track.id, track.name]))

    return NextResponse.json({
      items: demos.map(d => ({
        id: d.id, competition_id: d.competitionId, team_id: d.teamId,
        project_id: d.projectId, track_id: d.trackId,
        team_name: teamMap.get(d.teamId) ?? null,
        project_title: projectMap.get(d.projectId) ?? null,
        track_name: trackMap.get(d.trackId) ?? null,
        presentation_order: d.presentationOrder, status: d.status,
        scheduled_start: d.scheduledStart?.toISOString() ?? null,
        actual_start: d.actualStart?.toISOString() ?? null,
        actual_end: d.actualEnd?.toISOString() ?? null,
        presentation_duration_minutes: d.presentationDurationMinutes,
        qa_duration_minutes: d.qaDurationMinutes,
        round: d.round,
      })),
      total: demos.length,
    })
  } catch (error) {
    console.error('[judging/demos] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const parsed = postBodySchema.parse(body)

    const auth = await getAuthFromCookies()
    if (!auth?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    if (parsed.action === 'generate') {
      const competitionId = parsed.competition_id
      const round = parsed.round

      // Read duration config from competition
      const competition = await em.findOne(Competition, { id: competitionId, tenantId: auth.tenantId } as FilterQuery<Competition>)
      const demoConfig = (competition as Record<string, unknown> | null)?.demoConfig as { presentationDurationMinutes?: number; qaDurationMinutes?: number } | undefined
      const presDuration = demoConfig?.presentationDurationMinutes ?? 3
      const qaDuration = demoConfig?.qaDurationMinutes ?? 2

      const projects = await em.find(Project, {
        competitionId, status: ProjectStatus.PUBLISHED, deletedAt: null, tenantId: auth.tenantId,
      } as FilterQuery<Project>, { orderBy: { trackId: 'ASC', createdAt: 'ASC' } })

      let order = 0; let created = 0
      for (const project of projects) {
        const existing = await em.findOne(DemoSession, { projectId: project.id, competitionId, round } as FilterQuery<DemoSession>)
        if (existing) { order = Math.max(order, existing.presentationOrder + 1); continue }
        const now = new Date()
        em.create(DemoSession, {
          competitionId, teamId: project.teamId, projectId: project.id, trackId: project.trackId,
          presentationOrder: order++, presentationDurationMinutes: presDuration, qaDurationMinutes: qaDuration,
          status: DemoStatus.QUEUED, round: round as 'preliminary' | 'final',
          tenantId: auth.tenantId!, organizationId: auth.orgId!, createdAt: now, updatedAt: now,
        })
        created++
      }
      if (created > 0) await em.flush()
      return NextResponse.json({ ok: true, count: created }, { status: 201 })
    }

    if (parsed.action === 'advance') {
      const demo = await em.findOne(DemoSession, { id: parsed.id, tenantId: auth.tenantId } as FilterQuery<DemoSession>)
      if (!demo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      const now = new Date()
      demo.status = parsed.status as DemoStatus
      if (parsed.status === 'presenting') demo.actualStart = now
      else if (parsed.status === 'completed' || parsed.status === 'skipped') demo.actualEnd = now
      await em.persistAndFlush(demo)

      try {
        const eventBus = container.resolve('eventBus') as { emit: (id: string, payload: Record<string, unknown>) => Promise<void> }
        await eventBus.emit('judging.demo.status_changed', {
          demoId: demo.id, status: demo.status, actualStart: demo.actualStart?.toISOString() ?? null,
          durationMinutes: demo.presentationDurationMinutes, qaDurationMinutes: demo.qaDurationMinutes,
          teamId: demo.teamId, projectId: demo.projectId, competitionId: demo.competitionId,
          serverTime: Date.now(), tenantId: auth.tenantId, organizationId: auth.orgId,
        })
      } catch (e) { console.error('[judging/demos] Event emit error:', e) }

      return NextResponse.json({ ok: true, demo: { id: demo.id, status: demo.status } })
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 }) // unreachable due to discriminated union
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[judging/demos] POST error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await getAuthFromCookies()
    if (!auth?.tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await req.json()
    const parsedPut = reorderSchema.parse(body)
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const demo = await em.findOne(DemoSession, { id: parsedPut.id, tenantId: auth.tenantId } as FilterQuery<DemoSession>)
    if (!demo) return NextResponse.json({ error: 'Not found' }, { status: 404 })
    demo.presentationOrder = parsedPut.new_order
    await em.persistAndFlush(demo)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('[judging/demos] PUT error:', error)
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Judging', summary: 'Demo session management',
  methods: { GET: { summary: 'List demo sessions' }, POST: { summary: 'Generate queue or advance demo' }, PUT: { summary: 'Reorder demo' } },
}

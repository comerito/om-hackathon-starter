import { NextResponse } from 'next/server'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { JudgePanel, JudgePanelJudge, JudgePanelTrack } from '../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['judging.panels.manage'] },
  POST: { requireAuth: true, requireFeatures: ['judging.panels.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['judging.panels.manage'] },
}

// GET: list judges and tracks for a panel
export async function GET(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    const url = new URL(req.url)
    const panelId = url.searchParams.get('panel_id')
    if (!panelId) return NextResponse.json({ error: 'panel_id required' }, { status: 400 })

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const knex = (em as any).getConnection().getKnex()

    // Verify panel exists
    const panel = await em.findOne(JudgePanel, { id: panelId, tenantId: auth.tenantId, deletedAt: null } as FilterQuery<JudgePanel>)
    if (!panel) return NextResponse.json({ error: 'Panel not found' }, { status: 404 })

    // Get judges with display names
    const judges = await knex('judging_panel_judge as pj')
      .where('pj.panel_id', panelId)
      .where('pj.tenant_id', auth.tenantId)
      .leftJoin('customer_users as cu', 'cu.id', 'pj.judge_id')
      .select('pj.id', 'pj.judge_id', 'cu.display_name', 'cu.email')

    // Get tracks with names
    const tracks = await knex('judging_panel_track as pt')
      .where('pt.panel_id', panelId)
      .where('pt.tenant_id', auth.tenantId)
      .leftJoin('tracks_track as t', 't.id', 'pt.track_id')
      .select('pt.id', 'pt.track_id', 't.name as track_name', 't.color')

    return NextResponse.json({
      panel: { id: panel.id, name: panel.name, round: panel.round, competition_id: panel.competitionId },
      judges: judges.map((j: any) => ({
        id: j.id,
        judge_id: j.judge_id,
        display_name: j.display_name || j.email || j.judge_id.slice(0, 8),
        email: j.email ?? null,
      })),
      tracks: tracks.map((t: any) => ({
        id: t.id,
        track_id: t.track_id,
        track_name: t.track_name ?? t.track_id.slice(0, 8),
        color: t.color ?? '#6366f1',
      })),
    })
  } catch (error) {
    console.error('[panel-members] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const addSchema = z.object({
  panel_id: z.string().uuid(),
  type: z.enum(['judge', 'track']),
  judge_id: z.string().uuid().optional(),
  track_id: z.string().uuid().optional(),
})

// POST: add a judge or track to a panel
export async function POST(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    const body = await req.json()
    const parsed = addSchema.parse(body)
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    const organizationId = auth.orgId
    if (!organizationId) return NextResponse.json({ error: 'Organization context required' }, { status: 400 })

    // Verify panel exists
    const panel = await em.findOne(JudgePanel, { id: parsed.panel_id, tenantId: auth.tenantId, deletedAt: null } as FilterQuery<JudgePanel>)
    if (!panel) return NextResponse.json({ error: 'Panel not found' }, { status: 404 })

    if (parsed.type === 'judge') {
      if (!parsed.judge_id) return NextResponse.json({ error: 'judge_id required' }, { status: 400 })
      // Check duplicate
      const existing = await em.findOne(JudgePanelJudge, { panelId: parsed.panel_id, judgeId: parsed.judge_id } as FilterQuery<JudgePanelJudge>)
      if (existing) return NextResponse.json({ error: 'Judge already assigned to this panel' }, { status: 409 })
      const entry = em.create(JudgePanelJudge, {
        panelId: parsed.panel_id,
        judgeId: parsed.judge_id,
        tenantId: auth.tenantId,
        organizationId,
      })
      await em.persistAndFlush(entry)
      return NextResponse.json({ ok: true, id: entry.id }, { status: 201 })
    }

    if (parsed.type === 'track') {
      if (!parsed.track_id) return NextResponse.json({ error: 'track_id required' }, { status: 400 })
      const existing = await em.findOne(JudgePanelTrack, { panelId: parsed.panel_id, trackId: parsed.track_id } as FilterQuery<JudgePanelTrack>)
      if (existing) return NextResponse.json({ error: 'Track already assigned to this panel' }, { status: 409 })
      const entry = em.create(JudgePanelTrack, {
        panelId: parsed.panel_id,
        trackId: parsed.track_id,
        tenantId: auth.tenantId,
        organizationId,
      })
      await em.persistAndFlush(entry)
      return NextResponse.json({ ok: true, id: entry.id }, { status: 201 })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    console.error('[panel-members] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

const removeSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['judge', 'track']),
})

// DELETE: remove a judge or track from a panel
export async function DELETE(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    const url = new URL(req.url)
    const id = url.searchParams.get('id')
    const type = url.searchParams.get('type')
    if (!id || !type) return NextResponse.json({ error: 'id and type required' }, { status: 400 })

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    if (type === 'judge') {
      const entry = await em.findOne(JudgePanelJudge, { id, tenantId: auth.tenantId } as FilterQuery<JudgePanelJudge>)
      if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      await em.removeAndFlush(entry)
      return NextResponse.json({ ok: true })
    }

    if (type === 'track') {
      const entry = await em.findOne(JudgePanelTrack, { id, tenantId: auth.tenantId } as FilterQuery<JudgePanelTrack>)
      if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      await em.removeAndFlush(entry)
      return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 })
  } catch (error) {
    console.error('[panel-members] DELETE error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Judging',
  summary: 'Panel members management',
  methods: {
    GET: { summary: 'List judges and tracks assigned to a panel' },
    POST: { summary: 'Add a judge or track to a panel' },
    DELETE: { summary: 'Remove a judge or track from a panel' },
  },
}

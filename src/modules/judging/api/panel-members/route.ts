import { NextResponse } from 'next/server'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { JudgePanel, JudgePanelJudge, JudgePanelTrack } from '../../data/entities'
import { NOT_A_JUDGE_ERROR, isEligibleJudge } from '../../lib/judgeEligibility'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { rawAll } from '@/lib/db'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['judging.panels.manage'] },
  POST: { requireAuth: true, requireFeatures: ['judging.panels.manage'] },
  DELETE: { requireAuth: true, requireFeatures: ['judging.panels.manage'] },
}

type PanelJudgeRow = {
  id: string
  judge_id: string
  display_name: string | null
  email: string | null
}

type PanelTrackRow = {
  id: string
  track_id: string
  track_name: string | null
  color: string | null
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

    // Verify panel exists
    const panel = await em.findOne(JudgePanel, { id: panelId, tenantId: auth.tenantId, deletedAt: null } as FilterQuery<JudgePanel>)
    if (!panel) return NextResponse.json({ error: 'Panel not found' }, { status: 404 })

    // Get judges with display names
    const judges = await rawAll<PanelJudgeRow>(em,
      `SELECT pj.id AS id, pj.judge_id AS judge_id, cu.display_name AS display_name, cu.email AS email
       FROM judging_panel_judge pj
       LEFT JOIN customer_users cu ON cu.id = pj.judge_id
       WHERE pj.panel_id = ? AND pj.tenant_id = ?`,
      [panelId, auth.tenantId],
    )

    // Get tracks with names
    const tracks = await rawAll<PanelTrackRow>(em,
      `SELECT pt.id AS id, pt.track_id AS track_id, t.name AS track_name, t.color AS color
       FROM judging_panel_track pt
       LEFT JOIN tracks_track t ON t.id = pt.track_id
       WHERE pt.panel_id = ? AND pt.tenant_id = ?`,
      [panelId, auth.tenantId],
    )

    return NextResponse.json({
      panel: { id: panel.id, name: panel.name, round: panel.round, competition_id: panel.competitionId },
      judges: judges.map((j) => ({
        id: j.id,
        judge_id: j.judge_id,
        display_name: j.display_name || j.email || j.judge_id.slice(0, 8),
        email: j.email ?? null,
      })),
      tracks: tracks.map((t) => ({
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
      // Only judges of this panel's competition may be assigned — the UI scopes its dropdown to
      // the same set, but the endpoint must not trust the client for a scoring-rights grant.
      const eligible = await isEligibleJudge(em, parsed.judge_id, {
        competitionId: panel.competitionId,
        tenantId: auth.tenantId,
      })
      if (!eligible) return NextResponse.json({ error: NOT_A_JUDGE_ERROR }, { status: 422 })
      // Check duplicate
      const existing = await em.findOne(JudgePanelJudge, { panelId: parsed.panel_id, judgeId: parsed.judge_id } as FilterQuery<JudgePanelJudge>)
      if (existing) return NextResponse.json({ error: 'Judge already assigned to this panel' }, { status: 409 })
      const entry = em.create(JudgePanelJudge, {
        panelId: parsed.panel_id,
        judgeId: parsed.judge_id,
        tenantId: auth.tenantId,
        organizationId,
      })
      em.persist(entry)
      await em.flush()
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
      em.persist(entry)
      await em.flush()
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
      em.remove(entry)
      await em.flush()
      return NextResponse.json({ ok: true })
    }

    if (type === 'track') {
      const entry = await em.findOne(JudgePanelTrack, { id, tenantId: auth.tenantId } as FilterQuery<JudgePanelTrack>)
      if (!entry) return NextResponse.json({ error: 'Not found' }, { status: 404 })
      em.remove(entry)
      await em.flush()
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

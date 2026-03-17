import { NextResponse, type NextRequest } from 'next/server'
import { z } from 'zod'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { AuthContext } from '@open-mercato/shared/lib/auth/server'
import { scoringProgressSchema } from '../../../data/validators'
import { judgingTag, errorSchema } from '../../openapi'

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['judging.scores.view'] },
}

// ---------------------------------------------------------------------------
// GET — Scoring progress matrix
// ---------------------------------------------------------------------------

export async function GET(
  req: NextRequest,
  _ctx: { params: Record<string, string | string[]>; auth: AuthContext },
) {
  const url = new URL(req.url)
  const params = Object.fromEntries(url.searchParams.entries())
  const parsed = scoringProgressSchema.safeParse(params)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid query', details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    )
  }

  const { competitionId, round } = parsed.data
  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager
  const knex = em.getKnex()

  // Get all panels + judges for this competition
  let panelQuery = knex('judging_panel as p')
    .where('p.competition_id', competitionId)
    .whereNull('p.deleted_at')

  if (round) {
    panelQuery = panelQuery.where('p.round', round)
  }

  const panels = await panelQuery.select('p.id', 'p.name', 'p.round')

  // Get judges per panel
  const panelIds = panels.map((p: { id: string }) => p.id)
  const judges = panelIds.length > 0
    ? await knex('judging_panel_judge').whereIn('panel_id', panelIds).select('panel_id', 'judge_id')
    : []

  // Get all projects for competition
  const projects = await knex('projects_project')
    .where({ competition_id: competitionId, is_active: true })
    .whereIn('status', ['PUBLISHED', 'UNDER_REVIEW', 'SCORED'])
    .select('id', 'title', 'team_id', 'track_id')

  // Get tracks for panels
  const panelTracks = panelIds.length > 0
    ? await knex('judging_panel_track').whereIn('panel_id', panelIds).select('panel_id', 'track_id')
    : []

  // Get all submitted scores
  let scoreQuery = knex('judging_project_score')
    .where({ competition_id: competitionId, is_submitted: true })

  if (round) {
    scoreQuery = scoreQuery.where('round', round)
  }

  const scores = await scoreQuery.select('project_id', 'judge_id', 'round', 'total_score')

  // Build lookup: judgeId -> panelIds
  const judgePanelMap = new Map<string, string[]>()
  for (const j of judges) {
    const jp = j as { panel_id: string; judge_id: string }
    const arr = judgePanelMap.get(jp.judge_id) ?? []
    arr.push(jp.panel_id)
    judgePanelMap.set(jp.judge_id, arr)
  }

  // Build lookup: panelId -> trackIds
  const panelTrackMap = new Map<string, string[]>()
  for (const pt of panelTracks) {
    const ptrk = pt as { panel_id: string; track_id: string }
    const arr = panelTrackMap.get(ptrk.panel_id) ?? []
    arr.push(ptrk.track_id)
    panelTrackMap.set(ptrk.panel_id, arr)
  }

  // Build score lookup: `${projectId}:${judgeId}` -> score
  const scoreLookup = new Map<string, number | null>()
  for (const s of scores) {
    const sc = s as { project_id: string; judge_id: string; total_score: number | null }
    scoreLookup.set(`${sc.project_id}:${sc.judge_id}`, sc.total_score)
  }

  // Build progress matrix
  const allJudgeIds = [...new Set(judges.map((j: { judge_id: string }) => (j as { judge_id: string }).judge_id))]
  const projectRows = projects.map((p: { id: string; title: string; team_id: string; track_id: string }) => {
    const judgeScores: Record<string, { scored: boolean; score: number | null }> = {}
    let scoredCount = 0
    let expectedCount = 0

    for (const judgeId of allJudgeIds) {
      // Check if this judge should score this project (based on panel track assignments)
      const judgePanels = judgePanelMap.get(judgeId) ?? []
      let shouldScore = false
      for (const pid of judgePanels) {
        const tracks = panelTrackMap.get(pid) ?? []
        if (tracks.length === 0 || tracks.includes(p.track_id)) {
          shouldScore = true
          break
        }
      }

      if (shouldScore) {
        expectedCount++
        const key = `${p.id}:${judgeId}`
        const scored = scoreLookup.has(key)
        if (scored) scoredCount++
        judgeScores[judgeId] = { scored, score: scoreLookup.get(key) ?? null }
      }
    }

    return {
      projectId: p.id,
      title: p.title,
      teamId: p.team_id,
      trackId: p.track_id,
      judgeScores,
      scoredCount,
      expectedCount,
      complete: expectedCount > 0 && scoredCount >= expectedCount,
    }
  })

  const totalExpected = projectRows.reduce((s: number, r: { expectedCount: number }) => s + r.expectedCount, 0)
  const totalScored = projectRows.reduce((s: number, r: { scoredCount: number }) => s + r.scoredCount, 0)

  return NextResponse.json({
    projects: projectRows,
    judges: allJudgeIds,
    panels: panels.map((p: { id: string; name: string; round: string }) => ({
      id: p.id,
      name: p.name,
      round: p.round,
    })),
    summary: {
      totalProjects: projects.length,
      totalJudges: allJudgeIds.length,
      totalExpectedScores: totalExpected,
      totalCompletedScores: totalScored,
      progressPercent: totalExpected > 0 ? Math.round((totalScored / totalExpected) * 100) : 0,
    },
  })
}

// ---------------------------------------------------------------------------
// OpenAPI
// ---------------------------------------------------------------------------

export const openApi: OpenApiRouteDoc = {
  GET: {
    summary: 'Get scoring progress matrix',
    description: 'Returns a matrix of judges x projects showing which scores have been submitted.',
    tags: [judgingTag],
    responses: {
      200: { description: 'Scoring progress data' },
      400: { description: 'Invalid query', content: { 'application/json': { schema: errorSchema } } },
    },
  },
}

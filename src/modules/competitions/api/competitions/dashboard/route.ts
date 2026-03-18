import type { NextRequest } from 'next/server'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['competitions.view'] },
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const competitionId = searchParams.get('competitionId')
    if (!competitionId) {
      return Response.json({ error: 'competitionId is required' }, { status: 400 })
    }

    const { createRequestContainer } = await import('@open-mercato/shared/lib/di/container')
    const container = await createRequestContainer()
    const em = container.resolve('em') as import('@mikro-orm/postgresql').EntityManager
    const knex = em.getKnex()
    const auth = container.resolve('auth') as { tenantId: string; orgId: string }

    const scopeFilter = {
      tenant_id: auth.tenantId,
      organization_id: auth.orgId,
    }

    // Fetch competition
    const competition = await knex('competitions_competition')
      .where({ id: competitionId, ...scopeFilter })
      .select('id', 'name', 'stage', 'min_team_size', 'max_team_size')
      .first()

    if (!competition) {
      return Response.json({ error: 'Competition not found' }, { status: 404 })
    }

    // ---------------------------------------------------------------------------
    // Check-In
    // ---------------------------------------------------------------------------
    const [checkinTotal] = await knex('competitions_participation')
      .where({ competition_id: competitionId, ...scopeFilter })
      .count('id as count')

    const [checkinCheckedIn] = await knex('competitions_participation')
      .where({ competition_id: competitionId, checked_in: true, ...scopeFilter })
      .count('id as count')

    // ---------------------------------------------------------------------------
    // Teams
    // ---------------------------------------------------------------------------
    const [teamTotal] = await knex('teams_team')
      .where({ competition_id: competitionId, ...scopeFilter })
      .count('id as count')

    const [teamWithTrack] = await knex('teams_team')
      .where({ competition_id: competitionId, ...scopeFilter })
      .whereNotNull('track_id')
      .count('id as count')

    // Teams below minimum size
    const belowMinTeams = await knex('teams_team as t')
      .leftJoin('teams_membership as m', function () {
        this.on('m.team_id', '=', 't.id')
          .andOn('m.status', '=', knex.raw('?', ['ACTIVE']))
      })
      .where({ 't.competition_id': competitionId, 't.tenant_id': auth.tenantId, 't.organization_id': auth.orgId })
      .groupBy('t.id')
      .havingRaw('count(m.id) < ?', [competition.min_team_size ?? 2])
      .count('t.id as count')

    const belowMinCount = belowMinTeams.length

    // ---------------------------------------------------------------------------
    // Projects
    // ---------------------------------------------------------------------------
    const [projectTotal] = await knex('projects_project')
      .where({ competition_id: competitionId, ...scopeFilter })
      .count('id as count')

    const [projectDraft] = await knex('projects_project')
      .where({ competition_id: competitionId, status: 'DRAFT', ...scopeFilter })
      .count('id as count')

    const [projectPublished] = await knex('projects_project')
      .where({ competition_id: competitionId, status: 'PUBLISHED', ...scopeFilter })
      .count('id as count')

    const [projectFlagged] = await knex('projects_project')
      .where({ competition_id: competitionId, status: 'FLAGGED', ...scopeFilter })
      .count('id as count')

    // ---------------------------------------------------------------------------
    // Demos
    // ---------------------------------------------------------------------------
    let demoCompleted = 0
    let demoTotal = 0
    try {
      const [demoTotalRow] = await knex('judging_demo_slot')
        .where({ competition_id: competitionId, ...scopeFilter })
        .count('id as count')
      demoTotal = Number(demoTotalRow?.count ?? 0)

      const [demoCompletedRow] = await knex('judging_demo_slot')
        .where({ competition_id: competitionId, status: 'COMPLETED', ...scopeFilter })
        .count('id as count')
      demoCompleted = Number(demoCompletedRow?.count ?? 0)
    } catch {
      // Table may not exist yet
    }

    // ---------------------------------------------------------------------------
    // Judging
    // ---------------------------------------------------------------------------
    let scoresSubmitted = 0
    let scoresExpected = 0
    try {
      const [scoresSubmittedRow] = await knex('judging_score')
        .where({ competition_id: competitionId, ...scopeFilter })
        .count('id as count')
      scoresSubmitted = Number(scoresSubmittedRow?.count ?? 0)

      // Expected = judges * projects that have published status
      const [judgeCount] = await knex('competitions_participation')
        .where({ competition_id: competitionId, role: 'judge', ...scopeFilter })
        .count('id as count')
      const publishedProjects = Number(projectPublished?.count ?? 0)
      scoresExpected = Number(judgeCount?.count ?? 0) * publishedProjects
    } catch {
      // Table may not exist yet
    }

    // ---------------------------------------------------------------------------
    // Voting
    // ---------------------------------------------------------------------------
    let voteCount = 0
    try {
      const [voteRow] = await knex('sponsors_peer_vote')
        .where({ competition_id: competitionId, ...scopeFilter })
        .count('id as count')
      voteCount = Number(voteRow?.count ?? 0)
    } catch {
      // Table may not exist yet
    }

    // ---------------------------------------------------------------------------
    // Incidents
    // ---------------------------------------------------------------------------
    let incidentReported = 0
    let incidentUnderReview = 0
    let incidentResolved = 0
    let incidentDismissed = 0
    try {
      const [reportedRow] = await knex('incidents_report')
        .where({ competition_id: competitionId, status: 'REPORTED', ...scopeFilter })
        .count('id as count')
      incidentReported = Number(reportedRow?.count ?? 0)

      const [underReviewRow] = await knex('incidents_report')
        .where({ competition_id: competitionId, status: 'UNDER_REVIEW', ...scopeFilter })
        .count('id as count')
      incidentUnderReview = Number(underReviewRow?.count ?? 0)

      const [resolvedRow] = await knex('incidents_report')
        .where({ competition_id: competitionId, status: 'RESOLVED', ...scopeFilter })
        .count('id as count')
      incidentResolved = Number(resolvedRow?.count ?? 0)

      const [dismissedRow] = await knex('incidents_report')
        .where({ competition_id: competitionId, status: 'DISMISSED', ...scopeFilter })
        .count('id as count')
      incidentDismissed = Number(dismissedRow?.count ?? 0)
    } catch {
      // Table may not exist yet
    }

    // ---------------------------------------------------------------------------
    // Response
    // ---------------------------------------------------------------------------
    return Response.json({
      competition: {
        id: competition.id,
        name: competition.name,
        stage: competition.stage,
        minTeamSize: competition.min_team_size,
        maxTeamSize: competition.max_team_size,
      },
      checkin: {
        total: Number(checkinTotal?.count ?? 0),
        checkedIn: Number(checkinCheckedIn?.count ?? 0),
      },
      teams: {
        total: Number(teamTotal?.count ?? 0),
        withTrack: Number(teamWithTrack?.count ?? 0),
        withoutTrack: Number(teamTotal?.count ?? 0) - Number(teamWithTrack?.count ?? 0),
        belowMinSize: belowMinCount,
      },
      projects: {
        total: Number(projectTotal?.count ?? 0),
        draft: Number(projectDraft?.count ?? 0),
        published: Number(projectPublished?.count ?? 0),
        flagged: Number(projectFlagged?.count ?? 0),
      },
      demos: {
        total: demoTotal,
        completed: demoCompleted,
      },
      judging: {
        scoresSubmitted,
        scoresExpected,
      },
      voting: {
        totalVotes: voteCount,
      },
      incidents: {
        reported: incidentReported,
        underReview: incidentUnderReview,
        resolved: incidentResolved,
        dismissed: incidentDismissed,
        openTotal: incidentReported + incidentUnderReview,
      },
    })
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

export const openApi: OpenApiRouteDoc = {
  GET: {
    tags: ['Competitions'],
    summary: 'Get event command center dashboard metrics',
    description: 'Returns aggregated metrics for check-in, teams, projects, demos, judging, voting, and incidents for a competition.',
    parameters: [
      { name: 'competitionId', in: 'query', required: true, schema: { type: 'string', format: 'uuid' } },
    ],
    responses: {
      '200': { description: 'Dashboard metrics' },
      '400': { description: 'Missing competitionId' },
      '404': { description: 'Competition not found' },
    },
  },
}

import type { EntityManager } from '@mikro-orm/postgresql'
import { CompetitionStage, Competition } from '../data/entities'
import type { StageConfig } from '../data/validators'

// ---------------------------------------------------------------------------
// Valid transitions map
// ---------------------------------------------------------------------------

const VALID_TRANSITIONS: Record<string, string[]> = {
  [CompetitionStage.DRAFT]: [CompetitionStage.OPEN],
  [CompetitionStage.OPEN]: [CompetitionStage.TEAM_FORMATION],
  [CompetitionStage.TEAM_FORMATION]: [CompetitionStage.TRACK_SELECTION, CompetitionStage.HACKING],
  [CompetitionStage.TRACK_SELECTION]: [CompetitionStage.HACKING],
  [CompetitionStage.HACKING]: [CompetitionStage.DEMOS],
  [CompetitionStage.DEMOS]: [CompetitionStage.DELIBERATION],
  [CompetitionStage.DELIBERATION]: [CompetitionStage.FINISHED],
  [CompetitionStage.FINISHED]: [CompetitionStage.ARCHIVED],
  [CompetitionStage.ARCHIVED]: [],
}

// ---------------------------------------------------------------------------
// Stage side-effect descriptions
// ---------------------------------------------------------------------------

const STAGE_SIDE_EFFECTS: Record<string, string[]> = {
  [CompetitionStage.OPEN]: [
    'Registration will open for participants.',
    'Competition will become publicly visible on the portal.',
  ],
  [CompetitionStage.TEAM_FORMATION]: [
    'Participants can start forming teams.',
    'New registrations may still be allowed depending on configuration.',
  ],
  [CompetitionStage.TRACK_SELECTION]: [
    'Teams can select their competition track.',
    'Team membership changes may be restricted.',
  ],
  [CompetitionStage.HACKING]: [
    'Teams will be locked (no further membership changes).',
    'Solo participants without teams will be auto-assigned if allowSoloParticipants is enabled.',
    'Draft projects will be created for each team.',
    'Project submission countdown begins.',
  ],
  [CompetitionStage.DEMOS]: [
    'Project submission window closes.',
    'Remaining draft projects will be auto-published.',
    'Demo/presentation queue will be generated.',
    'Judging scorecards become available.',
  ],
  [CompetitionStage.DELIBERATION]: [
    'Judging scores will be finalized.',
    'Peer voting window closes.',
    'Leaderboard becomes available to organizers.',
  ],
  [CompetitionStage.FINISHED]: [
    'Final scores and rankings will be persisted.',
    'Results and prizes will be published.',
    'Leaderboard becomes publicly visible.',
  ],
  [CompetitionStage.ARCHIVED]: [
    'Competition will be hidden from active listings.',
    'All data is preserved but the competition is read-only.',
  ],
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StagePreview {
  currentStage: string
  targetStage: string
  sideEffects: string[]
  warnings: string[]
  counts: {
    totalParticipants: number
    checkedInParticipants: number
    teamsFormed: number
    teamsWithoutTrack: number
    teamsBelowMinSize: number
    unmatchedParticipants: number
    projectsDraft: number
    projectsPublished: number
    judgesWithIncompleteScores: number
  }
}

// ---------------------------------------------------------------------------
// StageService
// ---------------------------------------------------------------------------

export class StageService {
  /**
   * Check whether a transition from `from` to `to` is valid.
   */
  isValidTransition(from: string, to: string): boolean {
    const allowed = VALID_TRANSITIONS[from]
    if (!allowed) return false
    return allowed.includes(to)
  }

  /**
   * Return the list of stages reachable from `current`.
   */
  getNextStages(current: string): string[] {
    return VALID_TRANSITIONS[current] ?? []
  }

  /**
   * Build a preview of what will happen when advancing to `targetStage`.
   * Queries DB tables that may not exist yet; uses try/catch and returns 0.
   */
  async getStagePreview(
    competitionId: string,
    targetStage: string,
    em: EntityManager,
  ): Promise<StagePreview> {
    const competition = await em.findOne(Competition, { id: competitionId, deletedAt: null } as Record<string, unknown>)
    if (!competition) {
      throw new Error('Competition not found')
    }

    const currentStage = competition.stage
    const sideEffects = STAGE_SIDE_EFFECTS[targetStage] ?? []
    const warnings: string[] = []

    // Gather counts — each query is wrapped in try/catch because the
    // underlying tables (teams, projects, judging, etc.) may not exist yet.
    const counts = {
      totalParticipants: 0,
      checkedInParticipants: 0,
      teamsFormed: 0,
      teamsWithoutTrack: 0,
      teamsBelowMinSize: 0,
      unmatchedParticipants: 0,
      projectsDraft: 0,
      projectsPublished: 0,
      judgesWithIncompleteScores: 0,
    }

    // --- Participants ---
    try {
      const knex = em.getKnex()
      const participantRows = await knex('competitions_participation')
        .where({ competition_id: competitionId, deleted_at: null })
        .count('id as count')
      counts.totalParticipants = Number(participantRows[0]?.count ?? 0)

      const checkedInRows = await knex('competitions_participation')
        .where({ competition_id: competitionId, deleted_at: null, checked_in: true })
        .count('id as count')
      counts.checkedInParticipants = Number(checkedInRows[0]?.count ?? 0)
    } catch {
      // Table does not exist yet — leave at 0
    }

    // --- Teams ---
    try {
      const knex = em.getKnex()
      const teamRows = await knex('teams_team')
        .where({ competition_id: competitionId, deleted_at: null })
        .count('id as count')
      counts.teamsFormed = Number(teamRows[0]?.count ?? 0)

      const noTrackRows = await knex('teams_team')
        .where({ competition_id: competitionId, deleted_at: null })
        .whereNull('track_id')
        .count('id as count')
      counts.teamsWithoutTrack = Number(noTrackRows[0]?.count ?? 0)

      // Teams below minimum size
      const minSize = competition.minTeamSize
      const belowMinRows = await knex('teams_team')
        .where({ competition_id: competitionId, deleted_at: null })
        .where('member_count', '<', minSize)
        .count('id as count')
      counts.teamsBelowMinSize = Number(belowMinRows[0]?.count ?? 0)
    } catch {
      // Table does not exist yet — leave at 0
    }

    // --- Unmatched participants (participants not in any team) ---
    try {
      const knex = em.getKnex()
      const unmatchedRows = await knex('competitions_participation')
        .where({ competition_id: competitionId, deleted_at: null })
        .whereNull('team_id')
        .count('id as count')
      counts.unmatchedParticipants = Number(unmatchedRows[0]?.count ?? 0)
    } catch {
      // Table does not exist yet — leave at 0
    }

    // --- Projects ---
    try {
      const knex = em.getKnex()
      const draftRows = await knex('projects_project')
        .where({ competition_id: competitionId, deleted_at: null, status: 'DRAFT' })
        .count('id as count')
      counts.projectsDraft = Number(draftRows[0]?.count ?? 0)

      const publishedRows = await knex('projects_project')
        .where({ competition_id: competitionId, deleted_at: null, status: 'PUBLISHED' })
        .count('id as count')
      counts.projectsPublished = Number(publishedRows[0]?.count ?? 0)
    } catch {
      // Table does not exist yet — leave at 0
    }

    // --- Judging ---
    try {
      const knex = em.getKnex()
      const incompleteRows = await knex('judging_scorecard')
        .where({ competition_id: competitionId })
        .where('status', '!=', 'SUBMITTED')
        .countDistinct('judge_id as count')
      counts.judgesWithIncompleteScores = Number(incompleteRows[0]?.count ?? 0)
    } catch {
      // Table does not exist yet — leave at 0
    }

    // --- Generate warnings based on target stage ---
    if (targetStage === CompetitionStage.TEAM_FORMATION) {
      if (counts.totalParticipants === 0) {
        warnings.push('No participants have registered yet.')
      }
      if (counts.checkedInParticipants === 0 && counts.totalParticipants > 0) {
        warnings.push('No participants have checked in yet.')
      }
    }

    if (targetStage === CompetitionStage.TRACK_SELECTION) {
      if (counts.teamsFormed === 0) {
        warnings.push('No teams have been formed yet.')
      }
      if (counts.teamsBelowMinSize > 0) {
        warnings.push(`${counts.teamsBelowMinSize} team(s) are below the minimum team size of ${competition.minTeamSize}.`)
      }
      if (counts.unmatchedParticipants > 0) {
        warnings.push(`${counts.unmatchedParticipants} participant(s) are not assigned to any team.`)
      }
    }

    if (targetStage === CompetitionStage.HACKING) {
      if (counts.teamsFormed === 0) {
        warnings.push('No teams have been formed yet.')
      }
      if (counts.teamsWithoutTrack > 0) {
        warnings.push(`${counts.teamsWithoutTrack} team(s) have not selected a track.`)
      }
      if (counts.teamsBelowMinSize > 0) {
        warnings.push(`${counts.teamsBelowMinSize} team(s) are below the minimum team size of ${competition.minTeamSize}.`)
      }
      if (counts.unmatchedParticipants > 0) {
        const stageConfig = competition.stageConfig as StageConfig
        if (stageConfig.allowSoloParticipants) {
          warnings.push(`${counts.unmatchedParticipants} unmatched participant(s) will be auto-assigned to solo teams.`)
        } else {
          warnings.push(`${counts.unmatchedParticipants} participant(s) are not assigned to any team and solo participants are not allowed.`)
        }
      }
    }

    if (targetStage === CompetitionStage.DEMOS) {
      if (counts.projectsDraft > 0) {
        warnings.push(`${counts.projectsDraft} project(s) are still in DRAFT status and will be auto-published.`)
      }
      if (counts.projectsPublished === 0 && counts.projectsDraft === 0) {
        warnings.push('No projects have been submitted.')
      }
    }

    if (targetStage === CompetitionStage.DELIBERATION) {
      if (counts.judgesWithIncompleteScores > 0) {
        warnings.push(`${counts.judgesWithIncompleteScores} judge(s) have not completed scoring.`)
      }
    }

    if (targetStage === CompetitionStage.FINISHED) {
      if (counts.judgesWithIncompleteScores > 0) {
        warnings.push(`${counts.judgesWithIncompleteScores} judge(s) still have incomplete scores. Final rankings may be affected.`)
      }
    }

    return {
      currentStage,
      targetStage,
      sideEffects,
      warnings,
      counts,
    }
  }

  /**
   * Check whether TEAM_FORMATION -> HACKING skip is allowed.
   * This is valid if stageConfig.allowSimultaneousFormationAndTrack is true.
   */
  isSkipTrackSelectionAllowed(stageConfig: Record<string, unknown>): boolean {
    return Boolean(stageConfig?.allowSimultaneousFormationAndTrack)
  }
}

import type { EntityManager } from '@mikro-orm/postgresql'

interface VoteCheckResult {
  allowed: boolean
  reason?: string
}

interface VoteTally {
  projectId: string
  projectTitle: string
  teamId: string
  trackId: string
  voteCount: number
  rank: number
}

export class VotingService {
  constructor(private readonly em: EntityManager) {}

  /**
   * Check if a voter can cast a vote.
   * Enforces: vote limit, no self-vote, voting window (stage must be DEMOS or DELIBERATION).
   */
  async canCastVote(
    competitionId: string,
    voterId: string,
    projectId: string,
  ): Promise<VoteCheckResult> {
    const knex = this.em.getKnex()

    // Check competition exists and voting is open
    const competition = await knex('competitions_competition')
      .where('id', competitionId)
      .select('stage', 'peer_voting_config')
      .first()

    if (!competition) {
      return { allowed: false, reason: 'Competition not found' }
    }

    const votingStages = ['DEMOS', 'DELIBERATION']
    if (!votingStages.includes(competition.stage)) {
      return { allowed: false, reason: 'Voting is not open at this stage' }
    }

    const config = (typeof competition.peer_voting_config === 'string'
      ? JSON.parse(competition.peer_voting_config)
      : competition.peer_voting_config) as Record<string, unknown>

    const maxVotes = Number(config?.maxVotesPerParticipant ?? 3)

    // Check self-vote: voter must not be a member of the project's team
    const project = await knex('projects_project')
      .where('id', projectId)
      .select('team_id')
      .first()

    if (!project) {
      return { allowed: false, reason: 'Project not found' }
    }

    // Check if voter is on the project's team
    const membership = await knex('teams_invitation')
      .where({
        team_id: project.team_id,
        invitee_id: voterId,
        status: 'ACCEPTED',
      })
      .first()

    if (membership) {
      return { allowed: false, reason: 'You cannot vote for your own project' }
    }

    // Also check if the voter is the team leader
    const team = await knex('teams_team')
      .where('id', project.team_id)
      .select('leader_id')
      .first()

    if (team && team.leader_id === voterId) {
      return { allowed: false, reason: 'You cannot vote for your own project' }
    }

    // Check vote limit
    const currentVotes = await knex('sponsors_peer_vote')
      .where({ competition_id: competitionId, voter_id: voterId })
      .count('id as count')
      .first()

    const voteCount = Number(currentVotes?.count ?? 0)
    if (voteCount >= maxVotes) {
      return { allowed: false, reason: `You have already used all ${maxVotes} votes` }
    }

    // Check duplicate vote
    const existingVote = await knex('sponsors_peer_vote')
      .where({
        competition_id: competitionId,
        voter_id: voterId,
        project_id: projectId,
      })
      .first()

    if (existingVote) {
      return { allowed: false, reason: 'You have already voted for this project' }
    }

    return { allowed: true }
  }

  /**
   * Cast a vote with SELECT FOR UPDATE to prevent race conditions.
   */
  async castVote(
    competitionId: string,
    voterId: string,
    projectId: string,
    tenantId: string,
    organizationId: string,
  ): Promise<{ id: string }> {
    const knex = this.em.getKnex()

    // Use a transaction with row-level locking
    return await knex.transaction(async (trx) => {
      // Lock the voter's existing votes to prevent race conditions
      await trx.raw(
        `SELECT id FROM sponsors_peer_vote WHERE competition_id = ? AND voter_id = ? FOR UPDATE`,
        [competitionId, voterId],
      )

      // Re-check vote count inside transaction
      const competition = await trx('competitions_competition')
        .where('id', competitionId)
        .select('peer_voting_config')
        .first()

      const config = (typeof competition?.peer_voting_config === 'string'
        ? JSON.parse(competition.peer_voting_config)
        : competition?.peer_voting_config ?? {}) as Record<string, unknown>

      const maxVotes = Number(config?.maxVotesPerParticipant ?? 3)

      const currentVotes = await trx('sponsors_peer_vote')
        .where({ competition_id: competitionId, voter_id: voterId })
        .count('id as count')
        .first()

      const voteCount = Number(currentVotes?.count ?? 0)
      if (voteCount >= maxVotes) {
        throw new Error(`Vote limit of ${maxVotes} reached`)
      }

      // Insert the vote
      const [inserted] = await trx('sponsors_peer_vote')
        .insert({
          competition_id: competitionId,
          voter_id: voterId,
          project_id: projectId,
          tenant_id: tenantId,
          organization_id: organizationId,
          created_at: new Date(),
        })
        .returning('id')

      // Update project vote count
      await trx('projects_project')
        .where('id', projectId)
        .increment('peer_vote_count', 1)

      return { id: String(inserted.id) }
    })
  }

  /**
   * Retract a vote (if allowed by competition config).
   */
  async retractVote(
    competitionId: string,
    voterId: string,
    projectId: string,
  ): Promise<boolean> {
    const knex = this.em.getKnex()

    // Check if vote changes are allowed
    const competition = await knex('competitions_competition')
      .where('id', competitionId)
      .select('peer_voting_config', 'stage')
      .first()

    if (!competition) return false

    const votingStages = ['DEMOS', 'DELIBERATION']
    if (!votingStages.includes(competition.stage)) {
      throw new Error('Voting is not open at this stage')
    }

    const config = (typeof competition.peer_voting_config === 'string'
      ? JSON.parse(competition.peer_voting_config)
      : competition.peer_voting_config) as Record<string, unknown>

    if (config?.allowVoteChange === false) {
      throw new Error('Vote changes are not allowed in this competition')
    }

    return await knex.transaction(async (trx) => {
      const deleted = await trx('sponsors_peer_vote')
        .where({
          competition_id: competitionId,
          voter_id: voterId,
          project_id: projectId,
        })
        .delete()

      if (deleted > 0) {
        await trx('projects_project')
          .where('id', projectId)
          .decrement('peer_vote_count', 1)
      }

      return deleted > 0
    })
  }

  /**
   * Get vote tally for a competition, sorted by vote count descending.
   */
  async getVoteTally(competitionId: string): Promise<VoteTally[]> {
    const knex = this.em.getKnex()

    const rows = await knex('sponsors_peer_vote as v')
      .join('projects_project as p', 'p.id', 'v.project_id')
      .where('v.competition_id', competitionId)
      .groupBy('p.id', 'p.title', 'p.team_id', 'p.track_id')
      .select(
        'p.id as project_id',
        'p.title as project_title',
        'p.team_id as team_id',
        'p.track_id as track_id',
        knex.raw('count(v.id)::int as vote_count'),
      )
      .orderBy('vote_count', 'desc')

    return rows.map((row: Record<string, unknown>, idx: number) => ({
      projectId: String(row.project_id),
      projectTitle: String(row.project_title),
      teamId: String(row.team_id),
      trackId: String(row.track_id),
      voteCount: Number(row.vote_count),
      rank: idx + 1,
    }))
  }

  /**
   * Get a voter's current votes for a competition.
   */
  async getMyVotes(
    competitionId: string,
    voterId: string,
  ): Promise<{ projectId: string; createdAt: Date }[]> {
    const knex = this.em.getKnex()

    const rows = await knex('sponsors_peer_vote')
      .where({ competition_id: competitionId, voter_id: voterId })
      .select('project_id', 'created_at')
      .orderBy('created_at', 'asc')

    return rows.map((row: Record<string, unknown>) => ({
      projectId: String(row.project_id),
      createdAt: new Date(row.created_at as string),
    }))
  }
}

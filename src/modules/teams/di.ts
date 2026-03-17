import type { AwilixContainer } from 'awilix'
import { asValue } from 'awilix'

/**
 * TeamService — thin service layer for team operations that require
 * cross-entity coordination. Registered into the Awilix DI container.
 */
export class TeamService {
  constructor(
    private readonly em: import('@mikro-orm/postgresql').EntityManager,
  ) {}

  /**
   * Returns the count of active members for a given team.
   */
  async getMemberCount(teamId: string): Promise<number> {
    const knex = this.em.getKnex()
    const [{ count }] = await knex('teams_team_member')
      .where({ team_id: teamId, deleted_at: null })
      .count('* as count')
    return Number(count) || 0
  }

  /**
   * Returns whether a customer user is on any team in a given competition.
   */
  async isUserOnTeam(customerUserId: string, competitionId: string): Promise<boolean> {
    const knex = this.em.getKnex()
    const row = await knex('teams_team_member')
      .where({
        customer_user_id: customerUserId,
        competition_id: competitionId,
        deleted_at: null,
      })
      .first()
    return !!row
  }

  /**
   * Returns the team a user belongs to in a competition, or null.
   */
  async getUserTeam(customerUserId: string, competitionId: string): Promise<{ teamId: string; role: string } | null> {
    const knex = this.em.getKnex()
    const row = await knex('teams_team_member')
      .where({
        customer_user_id: customerUserId,
        competition_id: competitionId,
        deleted_at: null,
      })
      .select('team_id', 'role')
      .first()
    if (!row) return null
    return { teamId: row.team_id as string, role: row.role as string }
  }
}

export function register(container: AwilixContainer) {
  // Register TeamService as a scoped dependency
  // It will be resolved with the request-scoped EntityManager
  container.register({
    teamService: {
      resolve: (c: { em: import('@mikro-orm/postgresql').EntityManager }) => new TeamService(c.em),
      lifetime: 'SCOPED' as const,
    } as unknown as ReturnType<typeof asValue>,
  })
}

import type { ResponseEnricher } from '@open-mercato/shared/lib/crud/response-enricher'

/**
 * Enriches project list items with team name and track name by querying
 * the teams and tracks tables.
 */
const projectTeamTrackEnricher: ResponseEnricher = {
  id: 'projects.enrich-team-track',
  targetEntity: 'projects:project',
  async enrich({ items, container }) {
    if (!items || items.length === 0) return items

    try {
      const em = container.resolve('em') as import('@mikro-orm/postgresql').EntityManager
      const knex = em.getKnex()

      // Collect unique team and track ids
      const teamIds = [...new Set(items.map((i: Record<string, unknown>) => i.team_id as string).filter(Boolean))]
      const trackIds = [...new Set(items.map((i: Record<string, unknown>) => i.track_id as string).filter(Boolean))]

      // Fetch team names
      const teamMap = new Map<string, string>()
      if (teamIds.length > 0) {
        const teams = await knex('teams_team')
          .whereIn('id', teamIds)
          .select('id', 'name')
        for (const t of teams) {
          teamMap.set(t.id as string, t.name as string)
        }
      }

      // Fetch track names
      const trackMap = new Map<string, string>()
      if (trackIds.length > 0) {
        const tracks = await knex('tracks_track')
          .whereIn('id', trackIds)
          .select('id', 'name')
        for (const t of tracks) {
          trackMap.set(t.id as string, t.name as string)
        }
      }

      // Attach names to items
      return items.map((item: Record<string, unknown>) => ({
        ...item,
        team_name: teamMap.get(item.team_id as string) ?? null,
        track_name: trackMap.get(item.track_id as string) ?? null,
      }))
    } catch {
      // If enrichment fails, return items unchanged
      return items
    }
  },
}

export const enrichers = [projectTeamTrackEnricher]

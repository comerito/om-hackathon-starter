import type { ResponseEnricher } from '@open-mercato/shared/lib/crud/response-enricher'
import type { EntityManager } from '@mikro-orm/postgresql'
import { Team } from '../../teams/data/entities'
import { Track } from '../../tracks/data/entities'

type ProjectRecord = Record<string, unknown> & { id: string; team_id?: string; track_id?: string }

const projectContextEnricher: ResponseEnricher<ProjectRecord, { _projects: { teamName: string | null; trackName: string | null; trackColor: string | null } }> = {
  id: 'projects.project-context',
  targetEntity: 'projects:project',
  priority: 10,
  timeout: 2000,
  fallback: { _projects: { teamName: null, trackName: null, trackColor: null } },

  async enrichOne(record, context) {
    const em = (context.em as EntityManager).fork()
    let teamName: string | null = null
    let trackName: string | null = null
    let trackColor: string | null = null

    if (record.team_id) {
      const team = await em.findOne(Team, { id: record.team_id as string })
      teamName = team?.name ?? null
    }
    if (record.track_id) {
      const track = await em.findOne(Track, { id: record.track_id as string })
      trackName = track?.name ?? null
      trackColor = track?.color ?? null
    }

    return { ...record, _projects: { teamName, trackName, trackColor } }
  },

  async enrichMany(records, context) {
    const em = (context.em as EntityManager).fork()
    const teamIds = [...new Set(records.map(r => r.team_id).filter(Boolean))] as string[]
    const trackIds = [...new Set(records.map(r => r.track_id).filter(Boolean))] as string[]

    const teams = teamIds.length ? await em.find(Team, { id: { $in: teamIds } }) : []
    const tracks = trackIds.length ? await em.find(Track, { id: { $in: trackIds } }) : []

    const teamMap = new Map(teams.map(t => [t.id, t.name]))
    const trackMap = new Map(tracks.map(t => [t.id, { name: t.name, color: t.color }]))

    return records.map(r => ({
      ...r,
      _projects: {
        teamName: r.team_id ? (teamMap.get(r.team_id as string) ?? null) : null,
        trackName: r.track_id ? (trackMap.get(r.track_id as string)?.name ?? null) : null,
        trackColor: r.track_id ? (trackMap.get(r.track_id as string)?.color ?? null) : null,
      },
    }))
  },
}

export const enrichers: ResponseEnricher[] = [projectContextEnricher]

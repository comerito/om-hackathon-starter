import type { ResponseEnricher } from '@open-mercato/shared/lib/crud/response-enricher'
import type { EntityManager } from '@mikro-orm/postgresql'
import { Competition } from './entities'

type RecordWithCompetition = Record<string, unknown> & { id: string; competition_id?: string }

function createCompetitionEnricher(targetEntity: string, id: string): ResponseEnricher<RecordWithCompetition> {
  return {
    id,
    targetEntity,
    priority: 10,
    timeout: 2000,
    fallback: { _competitions: { name: null, stage: null } },
    async enrichOne(record, context) {
      if (!record.competition_id) return { ...record, _competitions: { name: null, stage: null } }
      const em = (context.em as EntityManager).fork()
      const comp = await em.findOne(Competition, { id: record.competition_id })
      return { ...record, _competitions: { name: comp?.name ?? null, stage: comp?.stage ?? null } }
    },
    async enrichMany(records, context) {
      const compIds = [...new Set(records.map(r => r.competition_id).filter(Boolean))] as string[]
      if (!compIds.length) return records.map(r => ({ ...r, _competitions: { name: null, stage: null } }))
      const em = (context.em as EntityManager).fork()
      const comps = await em.find(Competition, { id: { $in: compIds } })
      const map = new Map(comps.map(c => [c.id, { name: c.name, stage: c.stage }]))
      return records.map(r => ({
        ...r,
        _competitions: r.competition_id ? (map.get(r.competition_id as string) ?? { name: null, stage: null }) : { name: null, stage: null },
      }))
    },
  }
}

export const enrichers: ResponseEnricher[] = [
  createCompetitionEnricher('teams:team', 'competitions.team-competition-context'),
  createCompetitionEnricher('tracks:track', 'competitions.track-competition-context'),
]

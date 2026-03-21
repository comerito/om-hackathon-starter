import type { ResponseEnricher } from '@open-mercato/shared/lib/crud/response-enricher'
import type { EntityManager } from '@mikro-orm/postgresql'
import { TeamMember } from './entities'

type TeamRecord = Record<string, unknown> & { id: string }

const teamMemberCountEnricher: ResponseEnricher<TeamRecord, { _teams: { memberCount: number } }> = {
  id: 'teams.team-member-count',
  targetEntity: 'teams:team',
  priority: 10,
  timeout: 2000,
  fallback: { _teams: { memberCount: 0 } },

  async enrichOne(record, context) {
    const em = (context.em as EntityManager).fork()
    const count = await em.count(TeamMember, {
      teamId: record.id,
      organizationId: context.organizationId,
      deletedAt: null,
    })
    return { ...record, _teams: { memberCount: count } }
  },

  async enrichMany(records, context) {
    const em = (context.em as EntityManager).fork()
    const teamIds = records.map(r => r.id)
    if (!teamIds.length) return records.map(r => ({ ...r, _teams: { memberCount: 0 } }))

    const members = await em.find(TeamMember, {
      teamId: { $in: teamIds },
      organizationId: context.organizationId,
      deletedAt: null,
    })

    const countMap = new Map<string, number>()
    for (const m of members) {
      countMap.set(m.teamId, (countMap.get(m.teamId) ?? 0) + 1)
    }

    return records.map(r => ({
      ...r,
      _teams: { memberCount: countMap.get(r.id) ?? 0 },
    }))
  },
}

export const enrichers: ResponseEnricher[] = [teamMemberCountEnricher]

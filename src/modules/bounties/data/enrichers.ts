import type { ResponseEnricher } from '@open-mercato/shared/lib/crud/response-enricher'
import type { EntityManager } from '@mikro-orm/postgresql'

type RecordWithParticipant = Record<string, unknown> & {
  id: string
  participant_id?: string | null
  team_id?: string | null
}

export const enrichers: ResponseEnricher[] = [
  {
    id: 'bounties.pr-participant-context',
    targetEntity: 'bounties:bounty_pull_request',
    priority: 10,
    timeout: 2000,
    fallback: { _participant: { name: null, github_username: null }, _team: { name: null } },
    async enrichOne(record: RecordWithParticipant, context) {
      const em = (context.em as EntityManager).fork()
      let participantData = { name: null as string | null, github_username: null as string | null }
      let teamData = { name: null as string | null }

      if (record.participant_id) {
        const rows = await em.getConnection().execute(
          `SELECT cu.first_name, cu.last_name, cp.github_username
           FROM competitions_participation cp
           JOIN customer_accounts_user cu ON cu.id = cp.customer_user_id
           WHERE cp.id = ?`,
          [record.participant_id]
        )
        if (rows[0]) {
          participantData = {
            name: [rows[0].first_name, rows[0].last_name].filter(Boolean).join(' ') || null,
            github_username: rows[0].github_username,
          }
        }
      }

      if (record.team_id) {
        const rows = await em.getConnection().execute(
          `SELECT name FROM teams_team WHERE id = ?`,
          [record.team_id]
        )
        if (rows[0]) {
          teamData = { name: rows[0].name }
        }
      }

      return { ...record, _participant: participantData, _team: teamData }
    },
    async enrichMany(records: RecordWithParticipant[], context) {
      const em = (context.em as EntityManager).fork()

      const participantIds = [...new Set(records.map(r => r.participant_id).filter(Boolean))] as string[]
      const teamIds = [...new Set(records.map(r => r.team_id).filter(Boolean))] as string[]

      const participantMap = new Map<string, { name: string | null; github_username: string | null }>()
      if (participantIds.length > 0) {
        const rows = await em.getConnection().execute(
          `SELECT cp.id, cu.first_name, cu.last_name, cp.github_username
           FROM competitions_participation cp
           JOIN customer_accounts_user cu ON cu.id = cp.customer_user_id
           WHERE cp.id = ANY(?)`,
          [participantIds]
        )
        for (const r of rows) {
          participantMap.set(r.id, {
            name: [r.first_name, r.last_name].filter(Boolean).join(' ') || null,
            github_username: r.github_username,
          })
        }
      }

      const teamMap = new Map<string, string>()
      if (teamIds.length > 0) {
        const rows = await em.getConnection().execute(
          `SELECT id, name FROM teams_team WHERE id = ANY(?)`,
          [teamIds]
        )
        for (const r of rows) {
          teamMap.set(r.id, r.name)
        }
      }

      return records.map(record => ({
        ...record,
        _participant: record.participant_id
          ? (participantMap.get(record.participant_id) ?? { name: null, github_username: null })
          : { name: null, github_username: null },
        _team: record.team_id
          ? { name: teamMap.get(record.team_id) ?? null }
          : { name: null },
      }))
    },
  },
]

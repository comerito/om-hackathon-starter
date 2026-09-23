import type { EntityManager } from '@mikro-orm/postgresql'
import { rawAll } from '@/lib/db'

type PeerVoteCountRow = { project_id: string; vote_count: string | number }

/**
 * People's Choice votes per project, counted from `sponsors_peer_vote` — the table the portal
 * vote route writes. `projects_project.peer_vote_count` is a denormalized column that nothing
 * maintains, so every reader of the tally must count from the votes themselves.
 */
export async function countPeerVotesByProject(
  em: EntityManager,
  scope: { competitionId: string; tenantId: string },
): Promise<Map<string, number>> {
  const rows = await rawAll<PeerVoteCountRow>(
    em,
    `SELECT project_id, count(*) AS vote_count
       FROM sponsors_peer_vote
      WHERE competition_id = ? AND tenant_id = ?
      GROUP BY project_id`,
    [scope.competitionId, scope.tenantId],
  )
  const counts = new Map<string, number>()
  for (const row of rows) {
    const count = Number(row.vote_count)
    counts.set(String(row.project_id), Number.isFinite(count) ? count : 0)
  }
  return counts
}

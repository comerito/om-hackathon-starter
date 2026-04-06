import type { EntityManager } from '@mikro-orm/postgresql'
import { BountyPullRequest, BountyPRStatus } from '../data/entities'

interface MemberScore {
  participantId: string
  name: string
  githubUsername: string
  points: number
  prCount: number
}

interface TeamScore {
  teamId: string
  teamName: string
  totalPoints: number
  rank: number
  members: MemberScore[]
}

export interface LeaderboardData {
  teams: TeamScore[]
  lastUpdated: string
}

export class LeaderboardService {
  async getLeaderboard(em: EntityManager, competitionId: string, organizationId: string): Promise<LeaderboardData> {
    const approvedPRs = await em.find(BountyPullRequest, {
      competitionId,
      organizationId,
      status: BountyPRStatus.APPROVED,
      isDuplicate: false,
      deletedAt: null,
    })

    // We need participant and team data — resolve via raw query since we can't use ORM relationships
    const participantIds = [...new Set(approvedPRs.map(pr => pr.participantId).filter(Boolean))] as string[]
    const teamIds = [...new Set(approvedPRs.map(pr => pr.teamId).filter(Boolean))] as string[]

    // Batch resolve participant names + github usernames
    const participantMap = new Map<string, { name: string; githubUsername: string }>()
    if (participantIds.length > 0) {
      const participants = await em.getConnection().execute(
        `SELECT cp.id, cu.first_name, cu.last_name, cp.github_username
         FROM competitions_participation cp
         JOIN customer_accounts_user cu ON cu.id = cp.customer_user_id
         WHERE cp.id = ANY(?)`,
        [participantIds]
      )
      for (const p of participants) {
        participantMap.set(p.id, {
          name: [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Unknown',
          githubUsername: p.github_username ?? '',
        })
      }
    }

    // Batch resolve team names
    const teamMap = new Map<string, string>()
    if (teamIds.length > 0) {
      const teams = await em.getConnection().execute(
        `SELECT id, name FROM teams_team WHERE id = ANY(?)`,
        [teamIds]
      )
      for (const t of teams) {
        teamMap.set(t.id, t.name)
      }
    }

    // Group by team
    const teamScores = new Map<string, { teamName: string; totalPoints: number; members: Map<string, MemberScore> }>()

    for (const pr of approvedPRs) {
      if (!pr.teamId || !pr.participantId) continue

      if (!teamScores.has(pr.teamId)) {
        teamScores.set(pr.teamId, {
          teamName: teamMap.get(pr.teamId) ?? 'Unknown Team',
          totalPoints: 0,
          members: new Map(),
        })
      }

      const team = teamScores.get(pr.teamId)!
      if (!team.members.has(pr.participantId)) {
        const participant = participantMap.get(pr.participantId)
        team.members.set(pr.participantId, {
          participantId: pr.participantId,
          name: participant?.name ?? 'Unknown',
          githubUsername: participant?.githubUsername ?? pr.githubAuthor,
          points: 0,
          prCount: 0,
        })
      }

      const member = team.members.get(pr.participantId)!
      member.points += pr.totalPoints
      member.prCount += 1
      team.totalPoints += pr.totalPoints
    }

    const teams: TeamScore[] = Array.from(teamScores.entries())
      .map(([teamId, data]) => ({
        teamId,
        teamName: data.teamName,
        totalPoints: data.totalPoints,
        rank: 0,
        members: Array.from(data.members.values()).sort((a, b) => b.points - a.points),
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints)
      .map((team, index) => ({ ...team, rank: index + 1 }))

    return { teams, lastUpdated: new Date().toISOString() }
  }
}

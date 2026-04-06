"use client"

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useAppEvent } from '@open-mercato/ui/backend/injection/useAppEvent'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type LeaderboardTeam = {
  teamId: string
  teamName: string
  totalPoints: number
  rank: number
  members: Array<{
    participantId: string
    name: string
    githubUsername: string
    points: number
    prCount: number
  }>
}

type LeaderboardData = {
  teams: LeaderboardTeam[]
  lastUpdated: string
}

export default function BountyLeaderboard() {
  const t = useT()
  const scopeVersion = useOrganizationScopeVersion()
  const [expandedTeam, setExpandedTeam] = React.useState<string | null>(null)

  const { data, isLoading, refetch } = useQuery<LeaderboardData>({
    queryKey: ['bounty-leaderboard', scopeVersion],
    queryFn: async () => {
      const params = new URLSearchParams({
        competition_id: 'current',
        organization_id: 'current',
      })
      return await apiCall(`/api/bounties/leaderboard?${params}`) as unknown as LeaderboardData
    },
    refetchInterval: 10000,
  })

  useAppEvent('bounties.pull_request.approved', () => refetch(), [refetch])
  useAppEvent('bounties.pull_request.points_adjusted', () => refetch(), [refetch])

  const rankMedals = ['🥇', '🥈', '🥉']

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{t('bounties.leaderboard.heading', 'Bounty Hunting Leaderboard')}</h2>
        {data?.lastUpdated && (
          <span className="text-sm text-muted-foreground">
            {t('bounties.leaderboard.lastUpdated', 'Last updated')}: {new Date(data.lastUpdated).toLocaleTimeString()}
          </span>
        )}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">{t('common.loading', 'Loading...')}</p>
      ) : (
        <div className="space-y-3">
          {(data?.teams ?? []).map(team => (
            <div
              key={team.teamId}
              className="rounded-lg border bg-card transition-all hover:shadow-sm cursor-pointer"
              onClick={() => setExpandedTeam(expandedTeam === team.teamId ? null : team.teamId)}
            >
              <div className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl w-10 text-center">
                    {team.rank <= 3 ? rankMedals[team.rank - 1] : `#${team.rank}`}
                  </span>
                  <span className="font-semibold text-lg">{team.teamName}</span>
                </div>
                <span className="text-2xl font-bold">{team.totalPoints} pts</span>
              </div>

              {expandedTeam === team.teamId && team.members.length > 0 && (
                <div className="border-t px-4 py-3 bg-muted/30">
                  <div className="space-y-1">
                    {team.members.map(member => (
                      <div key={member.participantId} className="flex items-center justify-between text-sm">
                        <span>
                          <span className="font-medium">{member.name}</span>
                          <span className="text-muted-foreground ml-1">@{member.githubUsername}</span>
                        </span>
                        <span className="text-muted-foreground">
                          {member.points} pts ({member.prCount} PRs)
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}

          {(data?.teams ?? []).length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              {t('bounties.leaderboard.empty', 'No approved PRs yet. The leaderboard will populate as judges approve submissions.')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

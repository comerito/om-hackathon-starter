"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { PortalCompetitionLayout } from '../../../../../../competitions/components/PortalCompetitionLayout'
import { useCompetitionContext } from '../../../../../../competitions/components/CompetitionContext'
import { PortalPageTitle, SectionLabel, PortalBadge, CompetitionCountdown } from '@/components/portal'
import { Trophy, Users, GitPullRequest, ChevronDown, ChevronUp } from 'lucide-react'

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

export default function PortalLeaderboardPage({ params }: { params: { orgSlug: string } }) {
  const router = useRouter()
  const { auth } = usePortalContext()

  React.useEffect(() => {
    if (!auth.loading && !auth.user) {
      router.replace(`/${params.orgSlug}/portal/login`)
    }
  }, [auth.loading, auth.user, router, params.orgSlug])

  if (auth.loading || !auth.user) return null

  return (
    <PortalCompetitionLayout>
      <LeaderboardContent />
    </PortalCompetitionLayout>
  )
}

const rankStyles = [
  { bg: 'bg-amber-50 dark:bg-amber-500/10', border: 'border-amber-200 dark:border-amber-500/20', text: 'text-amber-600 dark:text-amber-400', medal: '🥇' },
  { bg: 'bg-gray-50 dark:bg-gray-500/10', border: 'border-gray-200 dark:border-gray-500/20', text: 'text-gray-500 dark:text-gray-400', medal: '🥈' },
  { bg: 'bg-orange-50 dark:bg-orange-500/10', border: 'border-orange-200 dark:border-orange-500/20', text: 'text-orange-600 dark:text-orange-400', medal: '🥉' },
]

function LeaderboardContent() {
  const t = useT()
  const { selectedId } = useCompetitionContext()
  const [expandedTeam, setExpandedTeam] = React.useState<string | null>(null)

  const { data, isLoading } = useQuery<LeaderboardData>({
    queryKey: ['portal-bounty-leaderboard', selectedId],
    queryFn: async () => {
      const params = new URLSearchParams({
        competition_id: selectedId ?? 'current',
        organization_id: 'current',
      })
      const { ok, result } = await apiCall<LeaderboardData>(`/api/bounties/leaderboard?${params}`)
      return ok && result ? result : { teams: [], lastUpdated: new Date().toISOString() }
    },
    refetchInterval: 10000,
  })

  const totalTeams = data?.teams?.length ?? 0
  const totalPoints = data?.teams?.reduce((s, t) => s + t.totalPoints, 0) ?? 0
  const totalPRs = data?.teams?.reduce((s, t) => s + t.members.reduce((ms, m) => ms + m.prCount, 0), 0) ?? 0

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-16 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />)}
        </div>
        {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PortalPageTitle
        label={t('bounties.portal.leaderboard.label', 'BOUNTY HUNTING')}
        title={t('bounties.portal.leaderboard.title', 'Leaderboard')}
        rightElement={<CompetitionCountdown />}
      />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-portal-primary/10">
              <Users className="size-5 text-portal-primary" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{totalTeams}</p>
              <p className="text-xs text-portal-secondary">{t('bounties.portal.leaderboard.teams', 'Teams')}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-portal-primary/10">
              <Trophy className="size-5 text-portal-primary" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{totalPoints}</p>
              <p className="text-xs text-portal-secondary">{t('bounties.portal.leaderboard.points', 'Total Points')}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-portal-primary/10">
              <GitPullRequest className="size-5 text-portal-primary" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{totalPRs}</p>
              <p className="text-xs text-portal-secondary">{t('bounties.portal.leaderboard.prs', 'Pull Requests')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Team rankings */}
      <div>
        <SectionLabel className="mb-3 block">{t('bounties.portal.leaderboard.rankings', 'TEAM RANKINGS')}</SectionLabel>
        <div className="space-y-3">
          {(data?.teams ?? []).map((team) => {
            const style = team.rank <= 3 ? rankStyles[team.rank - 1] : null
            const isExpanded = expandedTeam === team.teamId

            return (
              <div
                key={team.teamId}
                className={`rounded-xl border ${style ? `${style.border} ${style.bg}` : 'border-gray-100 dark:border-white/10 bg-white dark:bg-white/5'} transition-all cursor-pointer`}
                onClick={() => setExpandedTeam(isExpanded ? null : team.teamId)}
              >
                <div className="flex items-center justify-between p-4 sm:p-5">
                  <div className="flex items-center gap-4">
                    <div className={`flex size-10 items-center justify-center rounded-lg font-bold text-lg ${style ? `${style.bg} ${style.text}` : 'bg-gray-100 dark:bg-white/10 text-portal-secondary'}`}>
                      {style ? style.medal : `#${team.rank}`}
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-foreground">{team.teamName}</h3>
                      <p className="text-xs text-portal-secondary">
                        {team.members.length} {t('bounties.portal.leaderboard.members', 'members')}
                        {' · '}
                        {team.members.reduce((s, m) => s + m.prCount, 0)} {t('bounties.portal.leaderboard.prsLabel', 'PRs')}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-2xl font-bold text-foreground">{team.totalPoints}</p>
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-portal-secondary">{t('bounties.portal.leaderboard.pts', 'POINTS')}</p>
                    </div>
                    {isExpanded ? <ChevronUp className="size-4 text-portal-secondary" /> : <ChevronDown className="size-4 text-portal-secondary" />}
                  </div>
                </div>

                {isExpanded && team.members.length > 0 && (
                  <div className="border-t border-gray-100 dark:border-white/10 px-4 sm:px-5 py-3">
                    <div className="space-y-2">
                      {team.members.map((member, idx) => (
                        <div key={member.participantId} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex size-7 items-center justify-center rounded-full bg-portal-primary/10 text-xs font-bold text-portal-primary">
                              {idx + 1}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{member.name}</p>
                              <p className="text-xs text-portal-secondary">@{member.githubUsername}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-foreground">{member.points} pts</p>
                            <p className="text-[10px] text-portal-secondary">{member.prCount} PRs</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          {(data?.teams ?? []).length === 0 && (
            <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-8 sm:p-12 text-center">
              <Trophy className="size-12 text-portal-secondary/30 mx-auto mb-4" />
              <h3 className="text-base font-semibold text-foreground mb-1">{t('bounties.portal.leaderboard.emptyTitle', 'No scores yet')}</h3>
              <p className="text-sm text-portal-secondary">
                {t('bounties.portal.leaderboard.emptyDesc', 'The leaderboard will populate as judges approve bounty hunting pull requests.')}
              </p>
            </div>
          )}
        </div>
      </div>

      {data?.lastUpdated && (
        <p className="text-[10px] font-medium uppercase tracking-wider text-portal-secondary text-center">
          {t('bounties.portal.leaderboard.lastUpdated', 'Last updated')}: {new Date(data.lastUpdated).toLocaleTimeString()}
        </p>
      )}
    </div>
  )
}

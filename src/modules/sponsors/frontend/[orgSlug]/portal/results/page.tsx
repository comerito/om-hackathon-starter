'use client'

import { useEffect, useState, useCallback } from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard, PortalCardHeader } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Competition {
  id: string
  name: string
  stage: string
}

interface LeaderboardProject {
  id: string
  title: string
  team_id: string
  track_id: string
  final_score: number | null
  peer_vote_count: number | null
  rank: number | null
  manual_rank_override: number | null
}

interface TallyEntry {
  projectId: string
  projectTitle: string
  voteCount: number
  rank: number
}

interface PrizeItem {
  id: string
  name: string
  category: string
  value: string | null
  winning_project_id: string | null
  winning_team_id: string | null
  track_id: string | null
  sponsor_id: string | null
  rank: number | null
}

interface TrackItem {
  id: string
  name: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PortalResultsPage() {
  const t = useT()
  const { auth } = usePortalContext()
  const { user, loading: authLoading } = auth

  const [competition, setCompetition] = useState<Competition | null>(null)
  const [projects, setProjects] = useState<LeaderboardProject[]>([])
  const [tracks, setTracks] = useState<TrackItem[]>([])
  const [tally, setTally] = useState<TallyEntry[]>([])
  const [prizes, setPrizes] = useState<PrizeItem[]>([])
  const [userTeamId, setUserTeamId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      // Get active competition
      const compRes = await apiCall('/api/competitions/portal/active')
      const comp = compRes?.data?.[0] as Competition | undefined
      setCompetition(comp ?? null)

      if (!comp) {
        setLoading(false)
        return
      }

      const isPublished = ['FINISHED', 'ARCHIVED'].includes(comp.stage)
      if (!isPublished) {
        setLoading(false)
        return
      }

      // Find user's team
      const teamsRes = await apiCall(`/api/competitions/portal/data?type=teams&competitionId=${comp.id}`)
      const allTeams = teamsRes?.data ?? []
      let foundTeamId: string | null = null
      for (const team of allTeams) {
        const memberCheck = await apiCall(`/api/teams/invitations?teamId=${team.id}&inviteeId=${user.id}&status=ACCEPTED&pageSize=1`)
        if (memberCheck?.data?.length > 0) {
          foundTeamId = team.id as string
          break
        }
        if (team.leader_id === user.id) {
          foundTeamId = team.id as string
          break
        }
      }
      setUserTeamId(foundTeamId)

      // Fetch tracks
      const tracksRes = await apiCall(`/api/competitions/portal/data?type=tracks&competitionId=${comp.id}`)
      setTracks(tracksRes?.data ?? [])

      // Fetch scored projects
      const projRes = await apiCall(`/api/competitions/portal/data?type=projects&competitionId=${comp.id}`)
      setProjects(projRes?.data ?? [])

      // Fetch vote tally
      try {
        const tallyRes = await apiCall(`/api/sponsors/votes/tally?competitionId=${comp.id}`)
        setTally(tallyRes?.tally ?? [])
      } catch {
        // tally might not be available
      }

      // Fetch prizes
      const prizeRes = await apiCall(`/api/competitions/portal/data?type=prizes&competitionId=${comp.id}`)
      setPrizes(prizeRes?.data ?? [])
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  if (!competition) {
    return (
      <div className="flex flex-col gap-8">
        <PortalPageHeader title={t('sponsors.portal.results.title', 'Results')} />
        <PortalEmptyState
          title={t('sponsors.portal.results.noCompetition', 'No active competition')}
          description={t('sponsors.portal.results.noCompetitionDesc', 'There is no active competition at this time.')}
        />
      </div>
    )
  }

  const isPublished = ['FINISHED', 'ARCHIVED'].includes(competition.stage)
  if (!isPublished) {
    return (
      <div className="flex flex-col gap-8">
        <PortalPageHeader title={t('sponsors.portal.results.title', 'Results')} />
        <PortalEmptyState
          title={t('sponsors.portal.results.notReady', 'Results not ready')}
          description={t('sponsors.portal.results.notReadyDesc', 'Results will be published after the competition concludes.')}
        />
      </div>
    )
  }

  const trackMap = new Map(tracks.map((t) => [t.id, t.name]))
  const projectMap = new Map(projects.map((p) => [p.id, p]))

  // Group projects by track
  const projectsByTrack = tracks
    .map((track) => ({
      trackId: track.id,
      trackName: track.name,
      projects: projects
        .filter((p) => p.track_id === track.id)
        .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)),
    }))
    .filter((g) => g.projects.length > 0)

  // Find prizes with winners
  const awardedPrizes = prizes.filter((p) => p.winning_project_id)

  // People's choice winner
  const peoplesChoicePrize = prizes.find((p) => p.category === 'PEOPLES_CHOICE' && p.winning_project_id)

  // My team's project
  const myProject = userTeamId ? projects.find((p) => p.team_id === userTeamId) : null

  return (
    <div className="flex flex-col gap-8">
      <PortalPageHeader
        title={t('sponsors.portal.results.title', 'Results')}
        label={t('sponsors.portal.results.published', 'Official Results')}
      />

      {/* My Team Section */}
      {myProject && (
        <PortalCard>
          <PortalCardHeader
            label={t('sponsors.portal.results.myTeam', 'My Team')}
            title={myProject.title}
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-lg border p-3 text-center">
              <div className="text-xs text-muted-foreground">{t('sponsors.portal.results.rank', 'Final Rank')}</div>
              <div className="text-2xl font-bold">
                {myProject.rank != null ? `#${myProject.rank}` : '-'}
              </div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-xs text-muted-foreground">{t('sponsors.portal.results.score', 'Judge Score')}</div>
              <div className="text-2xl font-bold">
                {myProject.final_score != null ? myProject.final_score.toFixed(2) : '-'}
              </div>
            </div>
            <div className="rounded-lg border p-3 text-center">
              <div className="text-xs text-muted-foreground">{t('sponsors.portal.results.peerVotes', 'Peer Votes')}</div>
              <div className="text-2xl font-bold">
                {myProject.peer_vote_count ?? 0}
              </div>
            </div>
          </div>
          {/* Prizes won by my team */}
          {awardedPrizes.filter((p) => p.winning_team_id === userTeamId).length > 0 && (
            <div className="mt-4">
              <h4 className="text-sm font-medium mb-2">{t('sponsors.portal.results.prizesWon', 'Prizes Won')}</h4>
              <div className="flex flex-wrap gap-2">
                {awardedPrizes
                  .filter((p) => p.winning_team_id === userTeamId)
                  .map((prize) => (
                    <span
                      key={prize.id}
                      className="inline-flex items-center gap-1 rounded-full bg-yellow-100 text-yellow-800 px-3 py-1 text-sm font-medium"
                    >
                      {prize.name}
                      {prize.value && <span className="text-xs">({prize.value})</span>}
                    </span>
                  ))}
              </div>
            </div>
          )}
        </PortalCard>
      )}

      {/* Per-track leaderboard */}
      {projectsByTrack.map((group) => (
        <div key={group.trackId}>
          <h2 className="text-lg font-semibold mb-3">{group.trackName}</h2>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium w-16">{t('sponsors.portal.results.rankCol', '#')}</th>
                  <th className="text-left px-4 py-2 font-medium">{t('sponsors.portal.results.projectCol', 'Project')}</th>
                  <th className="text-right px-4 py-2 font-medium">{t('sponsors.portal.results.scoreCol', 'Score')}</th>
                  <th className="text-right px-4 py-2 font-medium">{t('sponsors.portal.results.votesCol', 'Votes')}</th>
                </tr>
              </thead>
              <tbody>
                {group.projects.map((project, idx) => {
                  const isMyTeam = project.team_id === userTeamId
                  return (
                    <tr
                      key={project.id}
                      className={`border-t ${isMyTeam ? 'bg-primary/5 font-medium' : ''}`}
                    >
                      <td className="px-4 py-2">
                        {idx === 0 && <span className="text-yellow-600 font-bold text-lg">1</span>}
                        {idx === 1 && <span className="text-gray-500 font-bold text-lg">2</span>}
                        {idx === 2 && <span className="text-amber-700 font-bold text-lg">3</span>}
                        {idx > 2 && <span>{idx + 1}</span>}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          {project.title}
                          {isMyTeam && (
                            <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-1.5 py-0.5 text-[10px] font-medium">
                              {t('sponsors.portal.results.you', 'You')}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right">
                        {project.final_score != null ? project.final_score.toFixed(2) : '-'}
                      </td>
                      <td className="px-4 py-2 text-right">{project.peer_vote_count ?? 0}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {/* People's Choice */}
      {peoplesChoicePrize && (
        <PortalCard>
          <PortalCardHeader
            label={t('sponsors.portal.results.peoplesChoice', "People's Choice Award")}
            title={projectMap.get(peoplesChoicePrize.winning_project_id!)?.title ?? 'Winner'}
          />
          <div className="mt-2 text-sm text-muted-foreground">
            {t('sponsors.portal.results.topVoted', 'Top voted project by participants')}
            {tally.length > 0 && tally[0] && (
              <span className="font-medium ml-1">
                ({tally[0].voteCount} {t('sponsors.portal.results.votesLabel', 'votes')})
              </span>
            )}
          </div>
        </PortalCard>
      )}

      {/* All Prize Winners */}
      {awardedPrizes.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">{t('sponsors.portal.results.allPrizes', 'Prize Winners')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {awardedPrizes.map((prize) => {
              const winnerProject = projectMap.get(prize.winning_project_id!)
              return (
                <div key={prize.id} className="rounded-lg border p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium">{prize.name}</span>
                    {prize.value && (
                      <span className="text-xs text-muted-foreground">({prize.value})</span>
                    )}
                  </div>
                  <div className="text-sm text-primary">
                    {winnerProject?.title ?? 'Unknown project'}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {prize.category === 'TRACK_PLACEMENT' && prize.track_id
                      ? `Track: ${trackMap.get(prize.track_id) ?? 'Unknown'}`
                      : prize.category.replace('_', ' ')}
                    {prize.rank != null ? ` - #${prize.rank}` : ''}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Vote Tally */}
      {tally.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">{t('sponsors.portal.results.voteTally', 'Peer Vote Leaderboard')}</h2>
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium w-16">#</th>
                  <th className="text-left px-4 py-2 font-medium">{t('sponsors.portal.results.projectCol', 'Project')}</th>
                  <th className="text-right px-4 py-2 font-medium">{t('sponsors.portal.results.votesCol', 'Votes')}</th>
                </tr>
              </thead>
              <tbody>
                {tally.slice(0, 10).map((entry) => (
                  <tr key={entry.projectId} className="border-t">
                    <td className="px-4 py-2">{entry.rank}</td>
                    <td className="px-4 py-2">{entry.projectTitle}</td>
                    <td className="px-4 py-2 text-right font-semibold">{entry.voteCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

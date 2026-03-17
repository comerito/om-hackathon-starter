"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

interface TallyEntry {
  projectId: string
  projectTitle: string
  teamId: string
  trackId: string
  voteCount: number
  rank: number
}

interface TallyResponse {
  tally: TallyEntry[]
  totalVoters: number
  totalVotes: number
}

interface PrizeRow {
  id: string
  name: string
  category: string
  winning_project_id: string | null
  winning_team_id: string | null
  awarded_at: string | null
  value: string | null
  rank: number | null
}

interface ProjectRow {
  id: string
  title: string
  team_id: string
  track_id: string
  final_score: number | null
  peer_vote_count: number | null
  rank: number | null
}

export default function ResultsPage() {
  const t = useT()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const competitionId = searchParams.get('competitionId') ?? ''

  const [assigningPrizeId, setAssigningPrizeId] = React.useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = React.useState('')

  // Fetch vote tally
  const { data: tallyData } = useQuery<TallyResponse>({
    queryKey: ['vote-tally', competitionId],
    queryFn: async () => {
      const res = await apiCall(`/api/sponsors/votes/tally?competitionId=${competitionId}`)
      return res as TallyResponse
    },
    enabled: !!competitionId,
  })

  // Fetch prizes
  const { data: prizesData } = useQuery({
    queryKey: ['prizes-results', competitionId],
    queryFn: async () => fetchCrudList<PrizeRow>('sponsors/prizes', { competitionId, pageSize: '100' }),
    enabled: !!competitionId,
  })

  // Fetch projects for assignment dropdown
  const { data: projectsData } = useQuery({
    queryKey: ['projects-for-prizes', competitionId],
    queryFn: async () => fetchCrudList<ProjectRow>('projects/projects', { competitionId, pageSize: '100', sortField: 'rank', sortDir: 'asc' }),
    enabled: !!competitionId,
  })

  const handleAssignPrize = async (prizeId: string) => {
    if (!selectedProjectId) return
    const project = projectsData?.items?.find((p) => p.id === selectedProjectId)
    if (!project) return

    try {
      await apiCall('/api/sponsors/prizes/assign', {
        method: 'POST',
        body: JSON.stringify({
          prizeId,
          projectId: project.id,
          teamId: project.team_id,
        }),
      })
      flash(t('sponsors.results.flash.assigned', 'Prize assigned'), 'success')
      queryClient.invalidateQueries({ queryKey: ['prizes-results'] })
      setAssigningPrizeId(null)
      setSelectedProjectId('')
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to assign prize', 'error')
    }
  }

  const handleUnassignPrize = async (prizeId: string) => {
    try {
      await apiCall('/api/sponsors/prizes/unassign', {
        method: 'POST',
        body: JSON.stringify({ prizeId }),
      })
      flash(t('sponsors.results.flash.unassigned', 'Prize unassigned'), 'success')
      queryClient.invalidateQueries({ queryKey: ['prizes-results'] })
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to unassign', 'error')
    }
  }

  if (!competitionId) {
    return (
      <Page>
        <PageBody>
          <h1 className="text-2xl font-bold">{t('sponsors.results.title', 'Results')}</h1>
          <p className="text-muted-foreground mt-2">Please select a competition.</p>
        </PageBody>
      </Page>
    )
  }

  const tally = tallyData?.tally ?? []
  const prizes = prizesData?.items ?? []
  const projects = projectsData?.items ?? []

  return (
    <Page>
      <PageBody>
        <div className="flex items-start justify-between mb-6">
          <div>
            <Link
              href={`/backend/sponsors?competitionId=${competitionId}`}
              className="text-sm text-muted-foreground hover:underline"
            >
              {t('sponsors.results.backToSponsors', 'Back to Sponsors')}
            </Link>
            <h1 className="text-2xl font-bold mt-1">{t('sponsors.results.title', 'Results & Prize Assignment')}</h1>
          </div>
        </div>

        {/* Vote Tally Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">{t('sponsors.results.voteTally', 'Peer Vote Tally')}</h2>
          {tallyData && (
            <div className="flex gap-4 mb-4 text-sm">
              <span className="text-muted-foreground">
                {t('sponsors.results.totalVoters', 'Total voters')}: <strong>{tallyData.totalVoters}</strong>
              </span>
              <span className="text-muted-foreground">
                {t('sponsors.results.totalVotes', 'Total votes')}: <strong>{tallyData.totalVotes}</strong>
              </span>
            </div>
          )}
          {tally.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('sponsors.results.noVotes', 'No votes have been cast yet.')}</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">#</th>
                    <th className="text-left px-4 py-2 font-medium">{t('sponsors.results.project', 'Project')}</th>
                    <th className="text-right px-4 py-2 font-medium">{t('sponsors.results.votes', 'Votes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tally.map((entry) => (
                    <tr key={entry.projectId} className="border-t">
                      <td className="px-4 py-2 font-medium">{entry.rank}</td>
                      <td className="px-4 py-2">{entry.projectTitle}</td>
                      <td className="px-4 py-2 text-right font-semibold">{entry.voteCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Leaderboard Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">{t('sponsors.results.leaderboard', 'Project Leaderboard')}</h2>
          {projects.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('sponsors.results.noProjects', 'No scored projects yet.')}</p>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">{t('sponsors.results.rank', 'Rank')}</th>
                    <th className="text-left px-4 py-2 font-medium">{t('sponsors.results.project', 'Project')}</th>
                    <th className="text-right px-4 py-2 font-medium">{t('sponsors.results.score', 'Score')}</th>
                    <th className="text-right px-4 py-2 font-medium">{t('sponsors.results.peerVotes', 'Peer Votes')}</th>
                  </tr>
                </thead>
                <tbody>
                  {projects
                    .filter((p) => p.final_score != null || p.rank != null)
                    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999))
                    .map((project) => (
                      <tr key={project.id} className="border-t">
                        <td className="px-4 py-2 font-medium">
                          {project.rank != null ? `#${project.rank}` : '-'}
                        </td>
                        <td className="px-4 py-2">{project.title}</td>
                        <td className="px-4 py-2 text-right">
                          {project.final_score != null ? project.final_score.toFixed(2) : '-'}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {project.peer_vote_count ?? 0}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Prize Assignment Section */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold mb-3">{t('sponsors.results.prizeAssignment', 'Prize Assignment')}</h2>
          {prizes.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('sponsors.results.noPrizes', 'No prizes defined yet.')}</p>
          ) : (
            <div className="space-y-3">
              {prizes.map((prize) => (
                <div key={prize.id} className="rounded-lg border p-4 flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{prize.name}</span>
                      {prize.value && (
                        <span className="text-xs text-muted-foreground">({prize.value})</span>
                      )}
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        prize.category === 'TRACK_PLACEMENT' ? 'bg-blue-100 text-blue-800' :
                        prize.category === 'SPONSOR_PRIZE' ? 'bg-amber-100 text-amber-800' :
                        prize.category === 'PEOPLES_CHOICE' ? 'bg-pink-100 text-pink-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {prize.category.replace('_', ' ')}
                      </span>
                    </div>
                    {prize.winning_project_id && (
                      <div className="text-sm text-green-600 mt-1">
                        Winner: {projects.find((p) => p.id === prize.winning_project_id)?.title ?? prize.winning_project_id.slice(0, 8) + '...'}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {prize.winning_project_id ? (
                      <Button size="sm" variant="outline" onClick={() => handleUnassignPrize(prize.id)}>
                        {t('sponsors.results.unassign', 'Unassign')}
                      </Button>
                    ) : assigningPrizeId === prize.id ? (
                      <div className="flex items-center gap-2">
                        <select
                          value={selectedProjectId}
                          onChange={(e) => setSelectedProjectId(e.target.value)}
                          className="rounded-md border px-2 py-1 text-sm max-w-[200px]"
                        >
                          <option value="">Select project...</option>
                          {projects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.title} {p.rank ? `(#${p.rank})` : ''}
                            </option>
                          ))}
                        </select>
                        <Button size="sm" onClick={() => handleAssignPrize(prize.id)} disabled={!selectedProjectId}>
                          {t('sponsors.results.assign', 'Assign')}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setAssigningPrizeId(null); setSelectedProjectId('') }}>
                          {t('sponsors.results.cancelAssign', 'Cancel')}
                        </Button>
                      </div>
                    ) : (
                      <Button size="sm" onClick={() => setAssigningPrizeId(prize.id)}>
                        {t('sponsors.results.assignPrize', 'Assign Prize')}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </PageBody>
    </Page>
  )
}

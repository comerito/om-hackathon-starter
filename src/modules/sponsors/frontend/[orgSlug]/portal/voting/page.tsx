'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalEmptyState } from '@open-mercato/ui/portal/components'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { usePortalAppEvent } from '@open-mercato/ui/portal/hooks/usePortalAppEvent'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Competition {
  id: string
  name: string
  stage: string
  peerVotingConfig: Record<string, unknown>
}

interface ProjectItem {
  id: string
  title: string
  tagline: string | null
  team_id: string
  track_id: string
  demo_url: string | null
  repo_url: string | null
}

interface MyVotesResponse {
  votes: { projectId: string; createdAt: string }[]
  votesUsed: number
  maxVotes: number
  votingOpen: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PortalVotingPage() {
  const t = useT()
  const { auth } = usePortalContext()
  const { user, loading: authLoading } = auth

  const [competition, setCompetition] = useState<Competition | null>(null)
  const [projects, setProjects] = useState<ProjectItem[]>([])
  const [myVotes, setMyVotes] = useState<MyVotesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [votingInProgress, setVotingInProgress] = useState<string | null>(null)
  const [userTeamId, setUserTeamId] = useState<string | null>(null)

  // Countdown for voting window
  const [countdownMs, setCountdownMs] = useState<number | null>(null)
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      // Get active competition
      const compRes = await apiCall('/api/competitions/competitions?isActive=true&pageSize=1')
      const comp = compRes?.data?.[0] as Competition | undefined
      setCompetition(comp ?? null)

      if (!comp) {
        setLoading(false)
        return
      }

      // Find user's team
      const teamsRes = await apiCall(`/api/teams/teams?competitionId=${comp.id}&pageSize=100`)
      const allTeams = teamsRes?.data ?? []
      let foundTeamId: string | null = null

      for (const team of allTeams) {
        const memberCheck = await apiCall(`/api/teams/invitations?teamId=${team.id}&inviteeId=${user.id}&status=ACCEPTED&pageSize=1`)
        if (memberCheck?.data?.length > 0) {
          foundTeamId = team.id as string
          break
        }
        // Also check if leader
        if (team.leader_id === user.id) {
          foundTeamId = team.id as string
          break
        }
      }
      setUserTeamId(foundTeamId)

      // Fetch published projects
      const projRes = await apiCall(`/api/projects/projects?competitionId=${comp.id}&status=PUBLISHED&pageSize=100&sortField=title&sortDir=asc`)
      const scoredRes = await apiCall(`/api/projects/projects?competitionId=${comp.id}&status=SCORED&pageSize=100&sortField=title&sortDir=asc`)
      const allProjects = [...(projRes?.data ?? []), ...(scoredRes?.data ?? [])]
      setProjects(allProjects)

      // Get my votes
      const votesRes = await apiCall(`/api/sponsors/votes?competitionId=${comp.id}`)
      setMyVotes(votesRes as MyVotesResponse)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  usePortalAppEvent('sponsors.vote.cast', () => { fetchData() })
  usePortalAppEvent('sponsors.vote.retracted', () => { fetchData() })

  // Countdown
  useEffect(() => {
    if (!competition) return
    // If stage is DELIBERATION, check for judging_deadline as the end of voting
    // For simplicity, we just show "voting active" without a specific countdown
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current)
    }
  }, [competition])

  const votingOpen = myVotes?.votingOpen ?? false
  const votedProjectIds = new Set(myVotes?.votes?.map((v) => v.projectId) ?? [])
  const votesUsed = myVotes?.votesUsed ?? 0
  const maxVotes = myVotes?.maxVotes ?? 3
  const votesRemaining = maxVotes - votesUsed

  const handleVote = async (projectId: string) => {
    if (!competition) return
    setVotingInProgress(projectId)
    try {
      await apiCall('/api/sponsors/votes', {
        method: 'POST',
        body: JSON.stringify({
          competitionId: competition.id,
          projectId,
        }),
      })
      await fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to vote')
    } finally {
      setVotingInProgress(null)
    }
  }

  const handleUnvote = async (projectId: string) => {
    if (!competition) return
    setVotingInProgress(projectId)
    try {
      await apiCall('/api/sponsors/votes/retract', {
        method: 'POST',
        body: JSON.stringify({
          competitionId: competition.id,
          projectId,
        }),
      })
      await fetchData()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to retract vote')
    } finally {
      setVotingInProgress(null)
    }
  }

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
        <PortalPageHeader title={t('sponsors.portal.voting.title', 'Peer Voting')} />
        <PortalEmptyState
          title={t('sponsors.portal.voting.noCompetition', 'No active competition')}
          description={t('sponsors.portal.voting.noCompetitionDesc', 'There is no active competition at this time.')}
        />
      </div>
    )
  }

  // Filter out own team's project
  const votableProjects = projects.filter((p) => p.team_id !== userTeamId)

  return (
    <div className="flex flex-col gap-6">
      <PortalPageHeader
        title={t('sponsors.portal.voting.title', 'Peer Voting')}
        label={votingOpen
          ? t('sponsors.portal.voting.open', 'Voting is open')
          : t('sponsors.portal.voting.closed', 'Voting is closed')}
      />

      {/* Vote counter */}
      <div className={`rounded-lg border p-4 text-center ${votingOpen ? 'border-primary/20 bg-primary/5' : 'border-muted bg-muted/30'}`}>
        <div className="text-xs text-muted-foreground mb-1">
          {t('sponsors.portal.voting.votesUsed', 'Votes used')}
        </div>
        <div className="text-3xl font-bold font-mono">
          {votesUsed} / {maxVotes}
        </div>
        {votingOpen && votesRemaining > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            {t('sponsors.portal.voting.votesRemaining', 'You have {{count}} vote(s) remaining').replace('{{count}}', String(votesRemaining))}
          </p>
        )}
      </div>

      {/* Voting closed overlay */}
      {!votingOpen && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
          <div className="text-sm font-medium text-amber-800">
            {t('sponsors.portal.voting.endedMsg', 'Voting has ended. Results will be announced during the closing ceremony.')}
          </div>
        </div>
      )}

      {/* Project grid */}
      {votableProjects.length === 0 ? (
        <PortalEmptyState
          title={t('sponsors.portal.voting.noProjects', 'No projects to vote on')}
          description={t('sponsors.portal.voting.noProjectsDesc', 'Projects will appear here once they are submitted.')}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {votableProjects.map((project) => {
            const isVoted = votedProjectIds.has(project.id)
            const isProcessing = votingInProgress === project.id
            const canVote = votingOpen && votesRemaining > 0 && !isVoted
            const canUnvote = votingOpen && isVoted

            return (
              <div
                key={project.id}
                className={`rounded-lg border p-4 transition-all ${
                  isVoted
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                    : 'hover:border-primary/30'
                }`}
              >
                <div className="mb-3">
                  <h3 className="font-medium text-sm">{project.title}</h3>
                  {project.tagline && (
                    <p className="text-xs text-muted-foreground mt-0.5">{project.tagline}</p>
                  )}
                </div>

                {(project.demo_url || project.repo_url) && (
                  <div className="flex gap-2 mb-3">
                    {project.demo_url && (
                      <a
                        href={project.demo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Demo
                      </a>
                    )}
                    {project.repo_url && (
                      <a
                        href={project.repo_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Repo
                      </a>
                    )}
                  </div>
                )}

                <div className="flex justify-end">
                  {isVoted ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleUnvote(project.id)}
                      disabled={!canUnvote || isProcessing}
                    >
                      {isProcessing
                        ? t('sponsors.portal.voting.processing', 'Processing...')
                        : t('sponsors.portal.voting.unvote', 'Remove Vote')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => handleVote(project.id)}
                      disabled={!canVote || isProcessing}
                    >
                      {isProcessing
                        ? t('sponsors.portal.voting.processing', 'Processing...')
                        : t('sponsors.portal.voting.vote', 'Vote')}
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

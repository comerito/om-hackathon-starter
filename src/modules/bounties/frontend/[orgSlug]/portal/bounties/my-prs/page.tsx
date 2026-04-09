"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { PortalCompetitionLayout } from '../../../../../../competitions/components/PortalCompetitionLayout'
import { useCompetitionContext } from '../../../../../../competitions/components/CompetitionContext'
import { PortalPageTitle, SectionLabel, PortalBadge, CompetitionCountdown } from '@/components/portal'
import { GitPullRequest, Trophy, CheckCircle, ExternalLink, AlertTriangle, Plus, Loader2, X } from 'lucide-react'
import Link from 'next/link'

type BountyPR = {
  id: string
  github_pr_number: number
  github_pr_url: string
  title: string
  status: string
  classifications: Array<{ category: string; points: number; reasoning: string }> | null
  total_points: number
  is_duplicate: boolean
  classification_confidence: number | null
  github_created_at: string
}

type MyPRsData = {
  ok: boolean
  github_username: string | null
  prs: BountyPR[]
}

type MembershipData = {
  team: { track_ids: string[] } | null
}

type ConfigData = {
  ok: boolean
  mappings: Record<string, string>
}

const statusBadgeVariant: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'muted'> = {
  detected: 'muted',
  classified: 'info' as 'default',
  pending_review: 'warning',
  approved: 'success',
  rejected: 'danger',
  duplicate: 'muted',
}

const statusLabels: Record<string, string> = {
  detected: 'Detected',
  classified: 'Classified',
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  duplicate: 'Duplicate',
}

const categoryLabels: Record<string, string> = {
  critical_bug_fix: 'Critical Bug Fix',
  regular_bug_fix: 'Bug Fix',
  new_improved_test: 'Test',
  documentation_improvement: 'Docs',
  minor_fix: 'Minor Fix',
}

export default function PortalMyPRsPage({ params }: { params: { orgSlug: string } }) {
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
      <MyPRsContent orgSlug={params.orgSlug} />
    </PortalCompetitionLayout>
  )
}

function MyPRsContent({ orgSlug }: { orgSlug: string }) {
  const t = useT()
  const queryClient = useQueryClient()
  const { selectedId } = useCompetitionContext()

  // Check if the user's team is on the bounty track via existing APIs
  const { data: membership, isLoading: membershipLoading } = useQuery<MembershipData>({
    queryKey: ['portal-team-membership', selectedId],
    queryFn: async () => {
      const { ok, result } = await apiCall<MembershipData>(`/api/teams/portal/my-membership?competition_id=${selectedId}`)
      return ok && result ? result : { team: null }
    },
    enabled: !!selectedId,
  })

  const { data: bountyConfig } = useQuery<ConfigData>({
    queryKey: ['portal-bounty-config'],
    queryFn: async () => {
      const { ok, result } = await apiCall<ConfigData>('/api/bounties/config')
      return ok && result ? result : { ok: false, mappings: {} }
    },
  })

  // Determine if the user is on the bounty track for this competition
  const bountyTrackId = selectedId ? bountyConfig?.mappings?.[selectedId] ?? null : null
  const teamTrackIds = membership?.team?.track_ids ?? []
  const isBountyParticipant = !!bountyTrackId && teamTrackIds.includes(bountyTrackId)

  // Fetch PRs only if on the bounty track
  const { data, isLoading } = useQuery<MyPRsData>({
    queryKey: ['portal-bounty-my-prs', selectedId],
    queryFn: async () => {
      const params = selectedId ? `?competition_id=${selectedId}` : ''
      const { ok, result } = await apiCall<MyPRsData>(`/api/bounties/portal/my-prs${params}`)
      return ok && result ? result : { ok: false, github_username: null, prs: [] }
    },
    enabled: !!selectedId && isBountyParticipant,
  })

  if (membershipLoading || isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-16 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-20 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />)}
        </div>
        {[1, 2].map(i => <div key={i} className="h-24 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />)}
      </div>
    )
  }

  if (!isBountyParticipant) {
    return (
      <div className="space-y-6">
        <PortalPageTitle
          label={t('bounties.portal.myPrs.label', 'BOUNTY HUNTING')}
          title={t('bounties.portal.myPrs.title', 'My Pull Requests')}
        />
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-8 sm:p-12 text-center">
          <AlertTriangle className="size-12 text-portal-secondary/30 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-foreground mb-1">
            {t('bounties.portal.myPrs.notOnTrack', 'Not on the Bounty Hunting Track')}
          </h3>
          <p className="text-sm text-portal-secondary max-w-md mx-auto">
            {t('bounties.portal.myPrs.notOnTrackDesc', 'Your team needs to be assigned to the Bounty Hunting track to participate. Contact your team lead or an organizer.')}
          </p>
        </div>
      </div>
    )
  }

  const prs = data?.prs ?? []
  const githubUsername = data?.github_username ?? null
  const totalPoints = prs.filter(pr => pr.status === 'approved' && !pr.is_duplicate).reduce((sum, pr) => sum + pr.total_points, 0)
  const approvedCount = prs.filter(pr => pr.status === 'approved').length
  const pendingCount = prs.filter(pr => pr.status === 'pending_review' || pr.status === 'classified').length

  return (
    <div className="space-y-6">
      <PortalPageTitle
        label={t('bounties.portal.myPrs.label', 'BOUNTY HUNTING')}
        title={t('bounties.portal.myPrs.title', 'My Pull Requests')}
        rightElement={<CompetitionCountdown />}
      />

      {/* Submit PR form */}
      <SubmitPRForm competitionId={selectedId!} onSubmitted={() => queryClient.invalidateQueries({ queryKey: ['portal-bounty-my-prs'] })} />

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-portal-primary/10">
              <Trophy className="size-5 text-portal-primary" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{totalPoints}</p>
              <p className="text-xs text-portal-secondary">{t('bounties.portal.myPrs.totalPoints', 'Total Points')}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-green-50 dark:bg-green-500/10">
              <CheckCircle className="size-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{approvedCount}</p>
              <p className="text-xs text-portal-secondary">{t('bounties.portal.myPrs.approved', 'Approved')}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-5">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-500/10">
              <GitPullRequest className="size-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{pendingCount}</p>
              <p className="text-xs text-portal-secondary">{t('bounties.portal.myPrs.pending', 'Pending')}</p>
            </div>
          </div>
        </div>
      </div>

      {/* PR list */}
      <div>
        <SectionLabel className="mb-3 block">{t('bounties.portal.myPrs.submissions', 'SUBMISSIONS')}</SectionLabel>
        <div className="space-y-3">
          {prs.map(pr => (
            <div key={pr.id} className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {/* Header: PR number + status */}
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <a
                      href={pr.github_pr_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-sm font-semibold text-portal-primary hover:underline"
                    >
                      #{pr.github_pr_number}
                      <ExternalLink className="size-3" />
                    </a>
                    <PortalBadge variant={statusBadgeVariant[pr.status] ?? 'muted'}>
                      {statusLabels[pr.status] ?? pr.status}
                    </PortalBadge>
                    {pr.is_duplicate && <PortalBadge variant="muted">Duplicate</PortalBadge>}
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-medium text-foreground leading-snug">{pr.title}</h3>

                  {/* Classification tags */}
                  {pr.classifications && pr.classifications.length > 0 && (
                    <div className="flex gap-1.5 mt-2.5 flex-wrap">
                      {pr.classifications.map((c, i) => (
                        <span
                          key={i}
                          className="inline-flex items-center rounded-full bg-portal-primary/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-portal-primary"
                        >
                          {categoryLabels[c.category] ?? c.category} · {c.points}pts
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Date */}
                  <p className="text-[10px] text-portal-secondary mt-2">
                    {new Date(pr.github_created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                  </p>
                </div>

                {/* Points badge */}
                <div className="shrink-0 flex flex-col items-center">
                  <span className={`text-2xl font-bold ${pr.status === 'approved' && !pr.is_duplicate ? 'text-portal-primary' : 'text-portal-secondary/50'}`}>
                    {pr.total_points}
                  </span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-portal-secondary">pts</span>
                </div>
              </div>
            </div>
          ))}

          {prs.length === 0 && (
            <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-8 sm:p-12 text-center">
              <GitPullRequest className="size-12 text-portal-secondary/30 mx-auto mb-4" />
              <h3 className="text-base font-semibold text-foreground mb-1">
                {t('bounties.portal.myPrs.emptyTitle', 'No pull requests yet')}
              </h3>
              <p className="text-sm text-portal-secondary max-w-md mx-auto">
                {t('bounties.portal.myPrs.emptyDesc', 'Open a pull request on GitHub, then use the "Submit a Pull Request" button above to register it for bounty evaluation.')}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SubmitPRForm({ competitionId, onSubmitted }: { competitionId: string; onSubmitted: () => void }) {
  const t = useT()
  const [prUrl, setPrUrl] = React.useState('')
  const [showForm, setShowForm] = React.useState(false)

  const mutation = useMutation({
    mutationFn: async (input: string) => {
      const { ok, result, error } = await apiCall<{ ok: boolean; pr: { id: string; github_pr_number: number; title: string } }>('/api/bounties/portal/submit-pr', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ pr_url: input, competition_id: competitionId }),
      })
      if (!ok) throw new Error(error ?? 'Failed to submit PR')
      return result!
    },
    onSuccess: () => {
      setPrUrl('')
      setShowForm(false)
      onSubmitted()
    },
  })

  if (!showForm) {
    return (
      <button
        onClick={() => { setShowForm(true); mutation.reset() }}
        className="w-full rounded-xl border-2 border-dashed border-portal-primary/30 bg-portal-primary/5 p-4 sm:p-5 flex items-center justify-center gap-2 text-sm font-semibold text-portal-primary hover:bg-portal-primary/10 hover:border-portal-primary/50 transition-colors"
      >
        <Plus className="size-4" />
        {t('bounties.portal.myPrs.submitPR', 'Submit a Pull Request')}
      </button>
    )
  }

  return (
    <div className="rounded-xl border border-portal-primary/20 bg-white dark:bg-white/5 p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GitPullRequest className="size-4 text-portal-primary" />
          <h3 className="text-sm font-semibold text-foreground">
            {t('bounties.portal.myPrs.submitTitle', 'Submit PR for Bounty')}
          </h3>
        </div>
        <button onClick={() => { setShowForm(false); mutation.reset() }} className="text-portal-secondary hover:text-foreground transition-colors">
          <X className="size-4" />
        </button>
      </div>

      <p className="text-xs text-portal-secondary">
        {t('bounties.portal.myPrs.submitHint', 'Paste a GitHub PR URL or enter a PR number. The PR will be automatically classified by our AI.')}
      </p>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (prUrl.trim() && !mutation.isPending) mutation.mutate(prUrl.trim())
        }}
        className="flex gap-2"
      >
        <input
          type="text"
          value={prUrl}
          onChange={(e) => setPrUrl(e.target.value)}
          placeholder="https://github.com/owner/repo/pull/123"
          disabled={mutation.isPending}
          className="flex-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-2 text-sm text-foreground placeholder:text-portal-secondary/50 focus:outline-none focus:ring-2 focus:ring-portal-primary/30 focus:border-portal-primary disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!prUrl.trim() || mutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-portal-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-portal-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {mutation.isPending ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              {t('bounties.portal.myPrs.submitting', 'Submitting...')}
            </>
          ) : (
            t('bounties.portal.myPrs.submit', 'Submit')
          )}
        </button>
      </form>

      {mutation.isError && (
        <div className="rounded-lg bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 p-3 flex items-start gap-2">
          <AlertTriangle className="size-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-xs text-red-700 dark:text-red-400">{mutation.error.message}</p>
        </div>
      )}

      {mutation.isSuccess && (
        <div className="rounded-lg bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 p-3 flex items-start gap-2">
          <CheckCircle className="size-4 text-green-500 mt-0.5 shrink-0" />
          <p className="text-xs text-green-700 dark:text-green-400">
            {t('bounties.portal.myPrs.submitted', 'PR submitted successfully! It will be classified shortly.')}
          </p>
        </div>
      )}
    </div>
  )
}

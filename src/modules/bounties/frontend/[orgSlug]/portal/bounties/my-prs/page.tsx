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
import { GitPullRequest, Trophy, CheckCircle, ExternalLink, AlertTriangle } from 'lucide-react'
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

      {/* GitHub identity */}
      {githubUsername && (
        <div className="rounded-xl border border-portal-primary/20 bg-portal-primary/5 p-4 sm:p-5 flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-portal-primary/10">
            <GitPullRequest className="size-5 text-portal-primary" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {t('bounties.portal.myPrs.tracking', 'Tracking PRs for')} <span className="font-bold text-portal-primary">@{githubUsername}</span>
            </p>
            <p className="text-xs text-portal-secondary">
              {t('bounties.portal.myPrs.trackingHint', 'PRs with the bounty-hunting label will appear here automatically.')}
            </p>
          </div>
        </div>
      )}

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
                {githubUsername
                  ? t('bounties.portal.myPrs.emptyWithGithub', 'Submit a pull request with the "bounty-hunting" label to the Open Mercato repo to get started!')
                  : t('bounties.portal.myPrs.emptyNoGithub', 'Set your GitHub username in your profile first, then submit PRs with the "bounty-hunting" label.')}
              </p>
              {!githubUsername && (
                <Link
                  href={`/${orgSlug}/portal/profile`}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-portal-primary px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-portal-primary/90 transition-colors"
                >
                  {t('bounties.portal.myPrs.setGithub', 'Set GitHub Username')}
                </Link>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

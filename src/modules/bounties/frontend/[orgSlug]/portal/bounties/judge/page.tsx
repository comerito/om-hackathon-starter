"use client"

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { PortalCompetitionLayout } from '../../../../../../competitions/components/PortalCompetitionLayout'
import { PortalPageTitle, SectionLabel, PortalBadge, CompetitionCountdown } from '@/components/portal'
import {
  GitPullRequest, CheckCircle, XCircle, AlertTriangle, ExternalLink,
  ChevronLeft, Clock, Shield, Copy, Pencil, Trophy, Loader2,
} from 'lucide-react'
import Link from 'next/link'

// ── Types ────────────────────────────────────────────────────────────

type BountyPR = {
  id: string
  github_pr_number: number
  github_pr_url: string
  title: string
  description: string | null
  github_author: string
  participant_id: string | null
  team_id: string | null
  status: string
  classifications: Array<{ category: string; points: number; reasoning: string }> | null
  classification_confidence: number | null
  classification_summary: string | null
  total_points: number
  points_override: Array<{ category: string; points: number; reasoning: string }> | null
  is_duplicate: boolean
  duplicate_of_id: string | null
  duplicate_marked_by: string | null
  duplicate_similarity: number | null
  split_group_id?: string | null
  is_split_child?: boolean
  github_created_at: string
  created_at: string
  _participant?: { name: string | null; github_username: string | null }
  _team?: { name: string | null }
}

type PRListResponse = {
  items: BountyPR[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

type ActivityItem = {
  id: string
  type: string
  pull_request_id: string | null
  actor_user_id: string | null
  message: string
  metadata: Record<string, unknown> | null
  created_at: string
}

// ── Constants ────────────────────────────────────────────────────────

const STATUS_TABS = ['all', 'pending_review', 'classified', 'approved', 'rejected', 'duplicate'] as const

const statusBadgeVariant: Record<string, 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'muted'> = {
  detected: 'muted',
  classified: 'info',
  pending_review: 'warning',
  approved: 'success',
  rejected: 'danger',
  duplicate: 'muted',
}

const statusLabels: Record<string, string> = {
  all: 'All',
  detected: 'Detected',
  classified: 'Classified',
  pending_review: 'Pending Review',
  approved: 'Approved',
  rejected: 'Rejected',
  duplicate: 'Duplicate',
}

const categoryLabels: Record<string, string> = {
  critical_bug_fix: 'Critical Bug Fix',
  regular_bug_fix: 'Regular Bug Fix',
  new_improved_test: 'New/Improved Test',
  documentation_improvement: 'Documentation',
  minor_fix: 'Minor Fix',
}

const activityIcons: Record<string, string> = {
  pr_detected: '🔍',
  pr_classified: '🏷',
  pr_approved: '✅',
  pr_rejected: '❌',
  pr_duplicate: '🔁',
  points_adjusted: '📊',
  points_revoked: '⚠',
  classification_overridden: '✏',
  manual_refresh: '🔄',
  pr_split_detected: '✂',
  pr_split_ungrouped: '🔓',
}

// ── Page Shell ───────────────────────────────────────────────────────

export default function PortalBountyJudgePage({ params }: { params: { orgSlug: string } }) {
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
      <JudgePanelContent orgSlug={params.orgSlug} />
    </PortalCompetitionLayout>
  )
}

// ── Main Content ─────────────────────────────────────────────────────

function JudgePanelContent({ orgSlug }: { orgSlug: string }) {
  const t = useT()
  const queryClient = useQueryClient()
  const [page, setPage] = React.useState(1)
  const [statusFilter, setStatusFilter] = React.useState<string>('all')
  const [selectedPRId, setSelectedPRId] = React.useState<string | null>(null)

  const queryParams = React.useMemo(() => {
    const p: Record<string, string> = {
      page: page.toString(),
      pageSize: '50',
      sortField: 'created_at',
      sortDir: 'desc',
    }
    if (statusFilter !== 'all') p.status = statusFilter
    return p
  }, [page, statusFilter])

  const queryString = new URLSearchParams(queryParams).toString()

  const { data, isLoading, isError } = useQuery<PRListResponse>({
    queryKey: ['portal-bounty-judge-prs', queryParams],
    queryFn: async () => {
      const { ok, result, response } = await apiCall<PRListResponse>(
        `/api/bounties/portal/judge/prs?${queryString}`,
      )
      if (!ok) {
        const body = await response.json().catch(() => null)
        throw new Error(body?.error ?? 'Failed to load PRs')
      }
      return result!
    },
    refetchInterval: 10000,
  })

  const selectedPR = React.useMemo(
    () => data?.items?.find(pr => pr.id === selectedPRId) ?? null,
    [data, selectedPRId],
  )

  const invalidate = React.useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['portal-bounty-judge-prs'] })
    queryClient.invalidateQueries({ queryKey: ['portal-bounty-judge-activity'] })
  }, [queryClient])

  if (isError) {
    return (
      <div className="space-y-6">
        <PortalPageTitle
          label={t('bounties.portal.judge.label', 'BOUNTY HUNTING')}
          title={t('bounties.portal.judge.title', 'Judge Panel')}
        />
        <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 p-8 text-center">
          <Shield className="size-12 text-red-400 mx-auto mb-4" />
          <h3 className="text-base font-semibold text-foreground mb-1">
            {t('bounties.portal.judge.accessDenied', 'Access Denied')}
          </h3>
          <p className="text-sm text-portal-secondary max-w-md mx-auto">
            {t('bounties.portal.judge.accessDeniedDesc', 'You must be assigned as a judge on the Bounty Hunting track to access this panel.')}
          </p>
        </div>
      </div>
    )
  }

  const items = data?.items ?? []
  const total = data?.total ?? 0
  const totalPages = data?.totalPages ?? 0

  return (
    <div className="space-y-5">
      <PortalPageTitle
        label={t('bounties.portal.judge.label', 'BOUNTY HUNTING')}
        title={t('bounties.portal.judge.title', 'Judge Panel')}
        rightElement={<CompetitionCountdown />}
      />

      {/* Nav links */}
      <div className="flex items-center gap-3 text-sm">
        <Link
          href={`/${orgSlug}/portal/bounties/leaderboard`}
          className="text-portal-primary hover:underline font-medium"
        >
          {t('bounties.portal.judge.leaderboard', 'Leaderboard')}
        </Link>
      </div>

      {/* Stats row */}
      <JudgeStatsRow items={items} total={total} />

      {/* Status filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {STATUS_TABS.map(tab => (
          <button
            key={tab}
            onClick={() => { setStatusFilter(tab); setPage(1); setSelectedPRId(null) }}
            className={`inline-flex items-center rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
              statusFilter === tab
                ? 'bg-portal-primary text-white shadow-sm'
                : 'bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-portal-secondary hover:bg-gray-50 dark:hover:bg-white/10'
            }`}
          >
            {statusLabels[tab] ?? tab}
          </button>
        ))}
      </div>

      {/* Main layout: list + detail */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* PR List */}
        <div className="lg:col-span-2 space-y-2">
          <SectionLabel className="block mb-2">
            {t('bounties.portal.judge.prList', 'PULL REQUESTS')}
            <span className="ml-2 text-portal-secondary font-normal">({total})</span>
          </SectionLabel>

          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-20 rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 animate-pulse" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-8 text-center">
              <GitPullRequest className="size-10 text-portal-secondary/30 mx-auto mb-3" />
              <p className="text-sm text-portal-secondary">
                {t('bounties.portal.judge.noPRs', 'No pull requests match this filter')}
              </p>
            </div>
          ) : (
            <>
              {items.map(pr => (
                <button
                  key={pr.id}
                  onClick={() => setSelectedPRId(pr.id)}
                  className={`w-full text-left rounded-xl border p-3.5 transition-all ${
                    selectedPRId === pr.id
                      ? 'border-portal-primary bg-portal-primary/5 ring-1 ring-portal-primary/20'
                      : 'border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 hover:border-portal-primary/30'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="text-xs font-semibold text-portal-primary">#{pr.github_pr_number}</span>
                        <PortalBadge variant={statusBadgeVariant[pr.status] ?? 'muted'}>
                          {statusLabels[pr.status] ?? pr.status}
                        </PortalBadge>
                        {pr.classification_confidence != null && pr.classification_confidence < 0.7 && (
                          <PortalBadge variant="warning">Low Conf.</PortalBadge>
                        )}
                        {pr.is_split_child && (
                          <PortalBadge variant="info">Split</PortalBadge>
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground leading-snug truncate">{pr.title}</p>
                      <p className="text-[11px] text-portal-secondary mt-0.5">
                        @{pr.github_author}
                        {pr._team?.name ? ` · ${pr._team.name}` : ''}
                      </p>
                    </div>
                    <div className="shrink-0 flex flex-col items-center">
                      <span className={`text-lg font-bold ${pr.status === 'approved' ? 'text-portal-primary' : 'text-portal-secondary/50'}`}>
                        {pr.total_points}
                      </span>
                      <span className="text-[9px] font-semibold uppercase tracking-wider text-portal-secondary">pts</span>
                    </div>
                  </div>
                </button>
              ))}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="text-xs font-medium text-portal-primary disabled:text-portal-secondary/30 disabled:cursor-not-allowed"
                  >
                    {t('common.previous', 'Previous')}
                  </button>
                  <span className="text-xs text-portal-secondary">
                    {page} / {totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="text-xs font-medium text-portal-primary disabled:text-portal-secondary/30 disabled:cursor-not-allowed"
                  >
                    {t('common.next', 'Next')}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-3">
          {selectedPR ? (
            <PRDetailPanel pr={selectedPR} onAction={invalidate} onBack={() => setSelectedPRId(null)} />
          ) : (
            <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-8 sm:p-12 text-center">
              <GitPullRequest className="size-12 text-portal-secondary/20 mx-auto mb-4" />
              <p className="text-sm text-portal-secondary">
                {t('bounties.portal.judge.selectPR', 'Select a PR from the list to view details and take action')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Activity Feed */}
      <PortalActivityFeed />
    </div>
  )
}

// ── Stats Row ────────────────────────────────────────────────────────

function JudgeStatsRow({ items, total }: { items: BountyPR[]; total: number }) {
  const t = useT()
  const pendingCount = items.filter(pr => pr.status === 'pending_review' || pr.status === 'classified').length
  const approvedCount = items.filter(pr => pr.status === 'approved').length
  const totalPoints = items.filter(pr => pr.status === 'approved' && !pr.is_duplicate).reduce((sum, pr) => sum + pr.total_points, 0)

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      <StatCard icon={<GitPullRequest className="size-4" />} label={t('bounties.portal.judge.totalPRs', 'Total PRs')} value={total} color="portal-primary" />
      <StatCard icon={<Clock className="size-4" />} label={t('bounties.portal.judge.needsReview', 'Needs Review')} value={pendingCount} color="amber-500" />
      <StatCard icon={<CheckCircle className="size-4" />} label={t('bounties.portal.judge.approved', 'Approved')} value={approvedCount} color="green-500" />
      <StatCard icon={<Trophy className="size-4" />} label={t('bounties.portal.judge.pointsAwarded', 'Points Awarded')} value={totalPoints} color="portal-primary" />
    </div>
  )
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-3 sm:p-4">
      <div className="flex items-center gap-2.5">
        <div className={`flex size-8 items-center justify-center rounded-lg bg-${color}/10 text-${color}`}>
          {icon}
        </div>
        <div>
          <p className="text-lg font-bold text-foreground">{value}</p>
          <p className="text-[10px] text-portal-secondary uppercase tracking-wide">{label}</p>
        </div>
      </div>
    </div>
  )
}

// ── PR Detail Panel ──────────────────────────────────────────────────

function PRDetailPanel({ pr, onAction, onBack }: { pr: BountyPR; onAction: () => void; onBack: () => void }) {
  const t = useT()
  const [actionLoading, setActionLoading] = React.useState<string | null>(null)
  const [adjustPoints, setAdjustPoints] = React.useState('')
  const [adjustReason, setAdjustReason] = React.useState('')

  const doAction = async (url: string, body: Record<string, unknown> = {}) => {
    setActionLoading(url)
    try {
      const { ok, response } = await apiCall(url, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!ok) {
        const errBody = await response.json().catch(() => null)
        throw new Error(errBody?.error ?? 'Action failed')
      }
      onAction()
    } catch (err) {
      console.error('Judge action failed:', err)
    } finally {
      setActionLoading(null)
    }
  }

  const handleApprove = () => doAction(`/api/bounties/portal/judge/prs/${pr.id}/approve`)
  const handleReject = () => doAction(`/api/bounties/portal/judge/prs/${pr.id}/reject`)

  const handleAdjustPoints = () => {
    const pts = parseInt(adjustPoints, 10)
    if (isNaN(pts) || pts < 0 || !adjustReason.trim()) return
    doAction(`/api/bounties/portal/judge/prs/${pr.id}/points`, {
      total_points: pts,
      reason: adjustReason,
    }).then(() => {
      setAdjustPoints('')
      setAdjustReason('')
    })
  }

  const confidencePct = pr.classification_confidence != null ? Math.round(pr.classification_confidence * 100) : null
  const isLowConfidence = pr.classification_confidence != null && pr.classification_confidence < 0.7

  return (
    <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 overflow-hidden">
      {/* Header */}
      <div className="border-b border-gray-100 dark:border-white/10 p-4 sm:p-5">
        <button
          onClick={onBack}
          className="lg:hidden inline-flex items-center gap-1 text-xs font-medium text-portal-primary mb-3"
        >
          <ChevronLeft className="size-3.5" />
          {t('common.back', 'Back')}
        </button>

        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <a
                href={pr.github_pr_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm font-semibold text-portal-primary hover:underline"
              >
                PR #{pr.github_pr_number}
                <ExternalLink className="size-3" />
              </a>
              <PortalBadge variant={statusBadgeVariant[pr.status] ?? 'muted'}>
                {statusLabels[pr.status] ?? pr.status}
              </PortalBadge>
              {isLowConfidence && (
                <PortalBadge variant="warning">
                  {t('bounties.portal.judge.lowConfidence', 'Low Confidence')}
                </PortalBadge>
              )}
            </div>
            <h3 className="text-base font-semibold text-foreground leading-snug">{pr.title}</h3>
            <p className="text-xs text-portal-secondary mt-1">
              @{pr.github_author}
              {pr._participant?.name ? ` (${pr._participant.name})` : ''}
              {pr._team?.name ? ` — ${pr._team.name}` : ''}
            </p>
          </div>
          <div className="shrink-0 flex flex-col items-center rounded-lg bg-portal-primary/5 px-3 py-2">
            <span className="text-2xl font-bold text-portal-primary">
              {(pr.points_override ?? pr.classifications ?? []).reduce((sum, c) => sum + c.points, 0)}
            </span>
            <span className="text-[9px] font-semibold uppercase tracking-wider text-portal-secondary">pts</span>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-5 space-y-4">
        {/* LLM Classification */}
        {(() => {
          const effectiveClassifications = pr.points_override ?? pr.classifications ?? []
          return effectiveClassifications.length > 0 ? (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <SectionLabel className="block">
                  {pr.points_override
                    ? t('bounties.portal.judge.overriddenClassification', 'CLASSIFICATION (OVERRIDDEN)')
                    : t('bounties.portal.judge.classification', 'AI CLASSIFICATION')}
                </SectionLabel>
                {confidencePct != null && (
                  <span className={`text-[10px] font-semibold ${isLowConfidence ? 'text-amber-600' : 'text-green-600'}`}>
                    {confidencePct}%
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {effectiveClassifications.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-sm rounded-lg bg-gray-50 dark:bg-white/5 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <span className="font-medium text-foreground">{categoryLabels[c.category] ?? c.category}</span>
                      {c.reasoning && (
                        <p className="text-[10px] text-portal-secondary mt-0.5 line-clamp-2">{c.reasoning}</p>
                      )}
                    </div>
                    <span className="font-bold text-portal-primary ml-3">{c.points} pts</span>
                  </div>
                ))}
              </div>
              {pr.classification_summary && (
                <p className="text-[11px] text-portal-secondary mt-2 italic leading-relaxed">
                  &quot;{pr.classification_summary}&quot;
                </p>
              )}
            </div>
          ) : null
        })()}

        {/* Duplicate info */}
        {pr.is_duplicate && (
          <div className="rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 p-3 text-sm">
            <div className="flex items-center gap-2">
              <Copy className="size-4 text-amber-600" />
              <span className="font-semibold text-amber-800 dark:text-amber-300">
                {t('bounties.portal.judge.duplicate', 'Marked as duplicate')}
              </span>
              <span className="text-amber-700 dark:text-amber-400 text-xs">
                ({pr.duplicate_marked_by === 'llm' ? 'by AI' : 'by judge'})
              </span>
            </div>
          </div>
        )}

        {/* Split group info */}
        {(pr.is_split_child || pr.split_group_id) && (
          <div className="rounded-lg bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 p-3 text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="size-4 text-blue-600" />
              <span className="font-semibold text-blue-800 dark:text-blue-300">
                {pr.is_split_child
                  ? t('bounties.portal.judge.splitChild', 'Split child — points suppressed')
                  : t('bounties.portal.judge.splitParent', 'Primary PR in split group')}
              </span>
            </div>
            {pr.is_split_child && (
              <p className="text-blue-700 dark:text-blue-400 text-xs mt-1">
                {t('bounties.portal.judge.splitChildNote', 'Points are awarded to the primary PR in this group only.')}
              </p>
            )}
          </div>
        )}

        {/* Action buttons */}
        {(pr.status === 'pending_review' || pr.status === 'classified') && (
          <div className="border-t border-gray-100 dark:border-white/10 pt-4">
            <SectionLabel className="block mb-2">
              {t('bounties.portal.judge.actions', 'ACTIONS')}
            </SectionLabel>
            <div className="flex gap-2">
              <ActionButton
                onClick={handleApprove}
                loading={actionLoading === `/api/bounties/portal/judge/prs/${pr.id}/approve`}
                variant="approve"
              >
                <CheckCircle className="size-3.5" />
                {t('bounties.portal.judge.approve', 'Approve')}
              </ActionButton>
              <ActionButton
                onClick={handleReject}
                loading={actionLoading === `/api/bounties/portal/judge/prs/${pr.id}/reject`}
                variant="reject"
              >
                <XCircle className="size-3.5" />
                {t('bounties.portal.judge.reject', 'Reject')}
              </ActionButton>
            </div>
          </div>
        )}

        {pr.status === 'rejected' && (
          <div className="border-t border-gray-100 dark:border-white/10 pt-4">
            <ActionButton
              onClick={handleApprove}
              loading={actionLoading === `/api/bounties/portal/judge/prs/${pr.id}/approve`}
              variant="approve"
            >
              <CheckCircle className="size-3.5" />
              {t('bounties.portal.judge.approveInstead', 'Approve Instead')}
            </ActionButton>
          </div>
        )}

        {/* Adjust Points (when approved) */}
        {pr.status === 'approved' && (
          <div className="border-t border-gray-100 dark:border-white/10 pt-4">
            <SectionLabel className="block mb-2">
              {t('bounties.portal.judge.adjustPoints', 'ADJUST POINTS')}
            </SectionLabel>
            <div className="flex gap-2">
              <input
                type="number"
                min="0"
                value={adjustPoints}
                onChange={e => setAdjustPoints(e.target.value)}
                placeholder="Points"
                className="w-20 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1.5 text-sm text-foreground placeholder:text-portal-secondary/50 focus:outline-none focus:ring-2 focus:ring-portal-primary/30"
              />
              <input
                type="text"
                value={adjustReason}
                onChange={e => setAdjustReason(e.target.value)}
                placeholder="Reason for adjustment"
                className="flex-1 rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-2.5 py-1.5 text-sm text-foreground placeholder:text-portal-secondary/50 focus:outline-none focus:ring-2 focus:ring-portal-primary/30"
              />
              <ActionButton
                onClick={handleAdjustPoints}
                loading={actionLoading === `/api/bounties/portal/judge/prs/${pr.id}/points`}
                variant="neutral"
                disabled={!adjustPoints || !adjustReason.trim()}
              >
                <Pencil className="size-3.5" />
                {t('bounties.portal.judge.adjust', 'Adjust')}
              </ActionButton>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Action Button ────────────────────────────────────────────────────

function ActionButton({
  onClick,
  loading,
  variant,
  disabled,
  children,
}: {
  onClick: () => void
  loading: boolean
  variant: 'approve' | 'reject' | 'neutral'
  disabled?: boolean
  children: React.ReactNode
}) {
  const baseStyles = 'inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const variantStyles = {
    approve: 'bg-green-600 text-white hover:bg-green-700 shadow-sm',
    reject: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    neutral: 'bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-foreground hover:bg-gray-50 dark:hover:bg-white/10',
  }

  return (
    <button onClick={onClick} disabled={loading || disabled} className={`${baseStyles} ${variantStyles[variant]}`}>
      {loading ? <Loader2 className="size-3.5 animate-spin" /> : null}
      {children}
    </button>
  )
}

// ── Activity Feed ────────────────────────────────────────────────────

function PortalActivityFeed() {
  const t = useT()

  const { data, isLoading } = useQuery({
    queryKey: ['portal-bounty-judge-activity'],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ items: ActivityItem[] }>(
        '/api/bounties/portal/judge/activity?limit=20',
      )
      return ok && result ? result : { items: [] }
    },
    refetchInterval: 5000,
  })

  return (
    <div className="rounded-xl border border-gray-100 dark:border-white/10 bg-white dark:bg-white/5 p-4 sm:p-5">
      <SectionLabel className="block mb-3">
        {t('bounties.portal.judge.activityFeed', 'ACTIVITY FEED')}
      </SectionLabel>
      {isLoading ? (
        <p className="text-sm text-portal-secondary">{t('common.loading', 'Loading...')}</p>
      ) : (
        <div className="space-y-1 max-h-48 overflow-y-auto">
          {(data?.items ?? []).map(item => (
            <div key={item.id} className="flex items-start gap-2 text-sm py-1">
              <span className="flex-shrink-0 text-xs">{activityIcons[item.type] ?? '📋'}</span>
              <span className="text-[10px] text-portal-secondary flex-shrink-0 w-14 pt-0.5">
                {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
              <span className="text-xs text-foreground">{item.message}</span>
            </div>
          ))}
          {(data?.items ?? []).length === 0 && (
            <p className="text-sm text-portal-secondary">{t('bounties.portal.judge.noActivity', 'No activity yet')}</p>
          )}
        </div>
      )}
    </div>
  )
}

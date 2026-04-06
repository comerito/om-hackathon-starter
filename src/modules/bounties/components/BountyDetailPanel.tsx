"use client"

import * as React from 'react'
import { Button } from '@open-mercato/ui/primitives/button'
import { EnumBadge } from '@open-mercato/ui/backend/ValueIcons'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type BountyPRRow = {
  id: string
  github_pr_number: number
  github_pr_url: string
  title: string
  github_author: string
  status: string
  classifications: Array<{ category: string; points: number; reasoning: string }> | null
  classification_confidence: number | null
  classification_summary: string | null
  total_points: number
  is_duplicate: boolean
  duplicate_marked_by: string | null
  _participant?: { name: string | null; github_username: string | null }
  _team?: { name: string | null }
}

const categoryLabels: Record<string, string> = {
  critical_bug_fix: 'Critical Bug Fix',
  regular_bug_fix: 'Regular Bug Fix',
  new_improved_test: 'New/Improved Test',
  documentation_improvement: 'Documentation',
  minor_fix: 'Minor Fix',
}

const statusPreset: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  detected: { label: 'Detected', variant: 'secondary' },
  classified: { label: 'Classified', variant: 'outline' },
  pending_review: { label: 'Pending Review', variant: 'default' },
  approved: { label: 'Approved', variant: 'default' },
  rejected: { label: 'Rejected', variant: 'destructive' },
  duplicate: { label: 'Duplicate', variant: 'secondary' },
}

interface Props {
  pr: BountyPRRow
  onAction: () => void
}

export default function BountyDetailPanel({ pr, onAction }: Props) {
  const t = useT()
  const [adjustPoints, setAdjustPoints] = React.useState('')
  const [adjustReason, setAdjustReason] = React.useState('')

  const handleApprove = async () => {
    try {
      await apiCall(`/api/bounties/prs/${pr.id}/approve`, { method: 'PATCH', body: '{}' })
      flash(t('bounties.flash.approved', 'PR approved'), 'success')
      onAction()
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed', 'error')
    }
  }

  const handleReject = async () => {
    try {
      await apiCall(`/api/bounties/prs/${pr.id}/reject`, { method: 'PATCH', body: '{}' })
      flash(t('bounties.flash.rejected', 'PR rejected'), 'success')
      onAction()
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed', 'error')
    }
  }

  const handleAdjustPoints = async () => {
    const pts = parseInt(adjustPoints, 10)
    if (isNaN(pts) || pts < 0 || !adjustReason.trim()) return
    try {
      await apiCall(`/api/bounties/prs/${pr.id}/points`, {
        method: 'PATCH',
        body: JSON.stringify({ total_points: pts, reason: adjustReason }),
      })
      flash(t('bounties.flash.pointsAdjusted', 'Points adjusted'), 'success')
      setAdjustPoints('')
      setAdjustReason('')
      onAction()
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed', 'error')
    }
  }

  const confidencePct = pr.classification_confidence != null ? Math.round(pr.classification_confidence * 100) : null
  const isLowConfidence = pr.classification_confidence != null && pr.classification_confidence < 0.7

  return (
    <div className="rounded-lg border p-4 space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <a href={pr.github_pr_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-semibold">
            PR #{pr.github_pr_number}
          </a>
          <EnumBadge value={pr.status} map={statusPreset} />
          {isLowConfidence && (
            <span className="inline-flex items-center rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-600/20">
              Low Confidence
            </span>
          )}
        </div>
        <h3 className="text-lg font-semibold">{pr.title}</h3>
        <p className="text-sm text-muted-foreground">
          @{pr.github_author}
          {pr._participant?.name ? ` (${pr._participant.name})` : ''}
          {pr._team?.name ? ` — ${pr._team.name}` : ''}
        </p>
      </div>

      {/* LLM Classification */}
      {pr.classifications && pr.classifications.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold mb-2">
            {t('bounties.detail.classification', 'LLM Classification')}
            {confidencePct != null && (
              <span className={`ml-2 text-xs ${isLowConfidence ? 'text-amber-600' : 'text-green-600'}`}>
                ({confidencePct}% confidence)
              </span>
            )}
          </h4>
          <div className="space-y-1">
            {pr.classifications.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-sm bg-muted/50 rounded px-3 py-1.5">
                <span>{categoryLabels[c.category] ?? c.category}</span>
                <span className="font-semibold">{c.points} pts</span>
              </div>
            ))}
          </div>
          {pr.classification_summary && (
            <p className="text-xs text-muted-foreground mt-1 italic">&quot;{pr.classification_summary}&quot;</p>
          )}
          <div className="text-sm font-semibold mt-2">
            {t('bounties.detail.total', 'Total')}: {pr.total_points} pts
          </div>
        </div>
      )}

      {/* Duplicate info */}
      {pr.is_duplicate && (
        <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
          <span className="font-semibold text-amber-800">
            {t('bounties.detail.duplicate', 'Marked as duplicate')}
          </span>
          <span className="text-amber-700 ml-1">
            ({pr.duplicate_marked_by === 'llm' ? 'by LLM' : 'by judge'})
          </span>
        </div>
      )}

      {/* Actions */}
      {(pr.status === 'pending_review' || pr.status === 'classified') && (
        <div className="flex gap-2">
          <Button variant="default" size="sm" onClick={handleApprove}>
            {t('bounties.actions.approve', 'Approve')}
          </Button>
          <Button variant="destructive" size="sm" onClick={handleReject}>
            {t('bounties.actions.reject', 'Reject')}
          </Button>
        </div>
      )}

      {pr.status === 'rejected' && (
        <Button variant="default" size="sm" onClick={handleApprove}>
          {t('bounties.actions.approveInstead', 'Approve Instead')}
        </Button>
      )}

      {/* Adjust Points */}
      {pr.status === 'approved' && (
        <div className="border-t pt-3 space-y-2">
          <h4 className="text-sm font-semibold">{t('bounties.detail.adjustPoints', 'Adjust Points')}</h4>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              value={adjustPoints}
              onChange={e => setAdjustPoints(e.target.value)}
              placeholder="Points"
              className="w-20 rounded border px-2 py-1 text-sm"
            />
            <input
              type="text"
              value={adjustReason}
              onChange={e => setAdjustReason(e.target.value)}
              placeholder="Reason"
              className="flex-1 rounded border px-2 py-1 text-sm"
            />
            <Button variant="outline" size="sm" onClick={handleAdjustPoints} disabled={!adjustPoints || !adjustReason.trim()}>
              {t('bounties.actions.adjust', 'Adjust')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

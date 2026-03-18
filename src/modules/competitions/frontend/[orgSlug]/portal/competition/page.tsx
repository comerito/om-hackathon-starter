'use client'

import { useEffect, useState, useCallback } from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard, PortalCardHeader, PortalStatRow, PortalCardDivider } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { usePortalAppEvent } from '@open-mercato/ui/portal/hooks/usePortalAppEvent'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Competition {
  id: string
  name: string
  slug: string
  description: string | null
  location: string | null
  stage: string
  startsAt: string
  endsAt: string
  timezone: string
  minTeamSize: number
  maxTeamSize: number
  projectSubmissionDeadline: string | null
  judgingDeadline: string | null
  codeOfConductUrl: string
  rulesUrl: string | null
  privacyPolicyUrl: string | null
  coverImageUrl: string | null
}

// ---------------------------------------------------------------------------
// Stage helpers
// ---------------------------------------------------------------------------

const STAGE_ORDER = [
  'DRAFT', 'OPEN', 'TEAM_FORMATION', 'TRACK_SELECTION',
  'HACKING', 'DEMOS', 'DELIBERATION', 'FINISHED', 'ARCHIVED',
]

const STAGE_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  OPEN: 'Registration Open',
  TEAM_FORMATION: 'Team Formation',
  TRACK_SELECTION: 'Track Selection',
  HACKING: 'Hacking',
  DEMOS: 'Demos',
  DELIBERATION: 'Deliberation',
  FINISHED: 'Finished',
  ARCHIVED: 'Archived',
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '--'
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PortalCompetitionPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const { auth } = usePortalContext()
  const { user, loading: authLoading } = auth

  const [competition, setCompetition] = useState<Competition | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const res = await apiCall('/api/competitions/competitions?isActive=true&pageSize=1')
      setCompetition(res?.data?.[0] ?? null)
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  usePortalAppEvent('competitions.competition.stage_advanced', () => { fetchData() })

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
        <PortalPageHeader title={t('competitions.portal.dashboard.title')} />
        <PortalEmptyState
          title={t('competitions.portal.dashboard.no_competition')}
          description="There is no active competition at this time."
        />
      </div>
    )
  }

  const currentStageIdx = STAGE_ORDER.indexOf(competition.stage)

  return (
    <div className="flex flex-col gap-6">
      {/* Cover image */}
      {competition.coverImageUrl && (
        <div className="overflow-hidden rounded-xl">
          <img
            src={competition.coverImageUrl}
            alt={competition.name}
            className="h-48 w-full object-cover sm:h-64"
          />
        </div>
      )}

      <PortalPageHeader
        label={competition.location ?? undefined}
        title={competition.name}
        description={competition.description ?? undefined}
      />

      {/* Stage progress with dots */}
      <PortalCard>
        <PortalCardHeader label="Progress" title="Competition Stage" />
        <div className="mt-4 flex items-center gap-1">
          {STAGE_ORDER.map((s, i) => {
            const isCurrent = i === currentStageIdx
            const isPast = i < currentStageIdx
            return (
              <div key={s} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`flex size-7 items-center justify-center rounded-full border-2 text-[10px] font-bold transition-colors ${
                    isCurrent
                      ? 'border-primary bg-primary text-primary-foreground'
                      : isPast
                        ? 'border-primary/40 bg-primary/20 text-primary'
                        : 'border-muted-foreground/30 bg-muted text-muted-foreground'
                  }`}
                >
                  {isPast ? '\u2713' : i + 1}
                </div>
                <span
                  className={`text-center text-[9px] leading-tight ${
                    isCurrent ? 'font-semibold text-foreground' : 'text-muted-foreground'
                  }`}
                >
                  {STAGE_LABELS[s]?.split(' ')[0] ?? s}
                </span>
              </div>
            )
          })}
        </div>
      </PortalCard>

      {/* Key dates */}
      <PortalCard>
        <PortalCardHeader label="Schedule" title="Key Dates" />
        <PortalStatRow label="Starts" value={formatDate(competition.startsAt)} />
        <PortalCardDivider />
        <PortalStatRow label="Ends" value={formatDate(competition.endsAt)} />
        {competition.projectSubmissionDeadline && (
          <>
            <PortalCardDivider />
            <PortalStatRow label="Submission deadline" value={formatDate(competition.projectSubmissionDeadline)} />
          </>
        )}
        {competition.judgingDeadline && (
          <>
            <PortalCardDivider />
            <PortalStatRow label="Judging deadline" value={formatDate(competition.judgingDeadline)} />
          </>
        )}
      </PortalCard>

      {/* Team rules */}
      <PortalCard>
        <PortalCardHeader label="Rules" title="Team Constraints" />
        <PortalStatRow label="Min team size" value={String(competition.minTeamSize)} />
        <PortalCardDivider />
        <PortalStatRow label="Max team size" value={String(competition.maxTeamSize)} />
      </PortalCard>

      {/* Links */}
      <PortalCard>
        <PortalCardHeader label="Documents" title="Rules & Policies" />
        <div className="mt-2 flex flex-col gap-2">
          <a
            href={competition.codeOfConductUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            Code of Conduct
          </a>
          {competition.rulesUrl && (
            <a
              href={competition.rulesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Competition Rules
            </a>
          )}
          {competition.privacyPolicyUrl && (
            <a
              href={competition.privacyPolicyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              Privacy Policy
            </a>
          )}
        </div>
      </PortalCard>
    </div>
  )
}

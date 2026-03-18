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
  stage: string
  startsAt: string
  endsAt: string
  projectSubmissionDeadline: string | null
  judgingDeadline: string | null
}

interface Participation {
  id: string
  competitionId: string
  role: 'participant' | 'mentor' | 'judge'
  cocAccepted: boolean
  privacyPolicyAccepted: boolean
  checkedIn: boolean
  profileComplete: boolean
  lookingForTeam: boolean
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

function stageProgress(stage: string): number {
  const idx = STAGE_ORDER.indexOf(stage)
  if (idx < 0) return 0
  return Math.round(((idx + 1) / STAGE_ORDER.length) * 100)
}

// ---------------------------------------------------------------------------
// Current-task prompt per stage + role
// ---------------------------------------------------------------------------

function getTaskPrompt(stage: string, role: string, participation: Participation | null): string {
  if (!participation) return 'Register for the competition to get started.'
  if (!participation.cocAccepted || !participation.privacyPolicyAccepted) {
    return 'Accept the Code of Conduct and Privacy Policy to continue.'
  }
  if (role === 'participant') {
    switch (stage) {
      case 'OPEN': return 'Complete your profile and wait for the competition to begin.'
      case 'TEAM_FORMATION': return 'Find teammates and form your team.'
      case 'TRACK_SELECTION': return 'Choose a track for your team.'
      case 'HACKING': return 'Build your project and submit before the deadline!'
      case 'DEMOS': return 'Prepare your demo presentation.'
      case 'DELIBERATION': return 'Sit tight - judges are reviewing projects.'
      case 'FINISHED': return 'The competition is over. Check the results!'
      default: return 'Stay tuned for updates.'
    }
  }
  if (role === 'judge') {
    switch (stage) {
      case 'DELIBERATION': return 'Review and score your assigned projects.'
      case 'DEMOS': return 'Watch team demos and prepare for scoring.'
      default: return 'Judging will begin during the deliberation stage.'
    }
  }
  if (role === 'mentor') {
    switch (stage) {
      case 'HACKING': return 'Support teams in your assigned tracks.'
      case 'TEAM_FORMATION': return 'Help participants find the right teammates.'
      default: return 'Mentoring sessions will be scheduled during hacking.'
    }
  }
  return 'Stay tuned for updates.'
}

// ---------------------------------------------------------------------------
// Countdown helper
// ---------------------------------------------------------------------------

function useCountdown(target: Date | null) {
  const [remaining, setRemaining] = useState('')

  useEffect(() => {
    if (!target) return
    function tick() {
      const diff = (target as Date).getTime() - Date.now()
      if (diff <= 0) { setRemaining('Now'); return }
      const days = Math.floor(diff / 86400000)
      const hours = Math.floor((diff % 86400000) / 3600000)
      const minutes = Math.floor((diff % 3600000) / 60000)
      const parts: string[] = []
      if (days > 0) parts.push(`${days}d`)
      if (hours > 0) parts.push(`${hours}h`)
      parts.push(`${minutes}m`)
      setRemaining(parts.join(' '))
    }
    tick()
    const id = setInterval(tick, 60000)
    return () => clearInterval(id)
  }, [target])

  return remaining
}

// ---------------------------------------------------------------------------
// Next deadline for stage
// ---------------------------------------------------------------------------

function getNextDeadline(comp: Competition | null): { label: string; date: Date } | null {
  if (!comp) return null
  const now = Date.now()
  const candidates: { label: string; date: Date }[] = []
  if (comp.startsAt && new Date(comp.startsAt).getTime() > now) {
    candidates.push({ label: 'Starts', date: new Date(comp.startsAt) })
  }
  if (comp.projectSubmissionDeadline && new Date(comp.projectSubmissionDeadline).getTime() > now) {
    candidates.push({ label: 'Submission deadline', date: new Date(comp.projectSubmissionDeadline) })
  }
  if (comp.judgingDeadline && new Date(comp.judgingDeadline).getTime() > now) {
    candidates.push({ label: 'Judging deadline', date: new Date(comp.judgingDeadline) })
  }
  if (comp.endsAt && new Date(comp.endsAt).getTime() > now) {
    candidates.push({ label: 'Ends', date: new Date(comp.endsAt) })
  }
  candidates.sort((a, b) => a.date.getTime() - b.date.getTime())
  return candidates[0] ?? null
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function PortalDashboardPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const { auth } = usePortalContext()
  const { user, loading: authLoading } = auth

  const [competition, setCompetition] = useState<Competition | null>(null)
  const [participation, setParticipation] = useState<Participation | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      // Fetch active competition
      const compRes = await apiCall('/api/competitions/portal/active')
      const comp: Competition | null = compRes?.data?.[0] ?? null
      setCompetition(comp)

      if (comp) {
        // Fetch current user's participation
        const partRes = await apiCall(`/api/competitions/portal/data?type=participations&competitionId=${comp.id}`)
        setParticipation(partRes?.data?.[0] ?? null)
      }
    } catch {
      // silent — dashboard is best-effort
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  // Refresh on stage changes
  usePortalAppEvent('competitions.competition.stage_advanced', () => { fetchData() })

  const nextDeadline = getNextDeadline(competition)
  const countdown = useCountdown(nextDeadline?.date ?? null)

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

  const role = participation?.role ?? 'participant'
  const stage = competition.stage
  const progress = stageProgress(stage)
  const taskPrompt = getTaskPrompt(stage, role, participation)

  return (
    <div className="flex flex-col gap-6">
      <PortalPageHeader
        label={competition.name}
        title={t('competitions.portal.dashboard.title')}
      />

      {/* Your Current Task */}
      <PortalCard className="border-primary/20 bg-primary/5">
        <PortalCardHeader
          label={t('competitions.portal.dashboard.your_task')}
          title={taskPrompt}
        />
      </PortalCard>

      {/* Stage progress */}
      <PortalCard>
        <PortalCardHeader
          label={t('competitions.portal.dashboard.stage')}
          title={STAGE_LABELS[stage] ?? stage}
        />
        {/* Progress bar */}
        <div className="mt-4 px-1">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-muted-foreground">
            <span>Draft</span>
            <span>Finished</span>
          </div>
        </div>
      </PortalCard>

      {/* Countdown */}
      {nextDeadline && (
        <PortalCard>
          <PortalCardHeader label="Next Deadline" title={nextDeadline.label} />
          <p className="mt-2 text-3xl font-bold tracking-tight text-primary">{countdown}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {nextDeadline.date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </p>
        </PortalCard>
      )}

      {/* Role-specific stats */}
      {participation && role === 'participant' && (
        <div className="grid gap-4 sm:grid-cols-2">
          <PortalCard>
            <PortalCardHeader label="Team" title={participation.lookingForTeam ? 'Looking for team' : 'Team status'} />
            <PortalStatRow label="Profile complete" value={participation.profileComplete ? 'Yes' : 'No'} />
            <PortalCardDivider />
            <PortalStatRow label="Checked in" value={participation.checkedIn ? 'Yes' : 'No'} />
          </PortalCard>
          <PortalCard>
            <PortalCardHeader label="Compliance" title="Agreements" />
            <PortalStatRow label="Code of Conduct" value={participation.cocAccepted ? 'Accepted' : 'Pending'} />
            <PortalCardDivider />
            <PortalStatRow label="Privacy Policy" value={participation.privacyPolicyAccepted ? 'Accepted' : 'Pending'} />
          </PortalCard>
        </div>
      )}

      {participation && role === 'judge' && (
        <PortalCard>
          <PortalCardHeader label="Judging" title="Your judging assignments" />
          <PortalStatRow label="Role" value="Judge" />
          <PortalCardDivider />
          <PortalStatRow label="Checked in" value={participation.checkedIn ? 'Yes' : 'No'} />
        </PortalCard>
      )}

      {participation && role === 'mentor' && (
        <PortalCard>
          <PortalCardHeader label="Mentoring" title="Your mentor assignments" />
          <PortalStatRow label="Role" value="Mentor" />
          <PortalCardDivider />
          <PortalStatRow label="Checked in" value={participation.checkedIn ? 'Yes' : 'No'} />
        </PortalCard>
      )}
    </div>
  )
}

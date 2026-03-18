"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useSearchParams } from 'next/navigation'
import { useAppEvent } from '@open-mercato/ui/backend/injection/useAppEvent'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardData {
  competition: {
    id: string
    name: string
    stage: string
    minTeamSize: number
    maxTeamSize: number
  }
  checkin: { total: number; checkedIn: number }
  teams: { total: number; withTrack: number; withoutTrack: number; belowMinSize: number }
  projects: { total: number; draft: number; published: number; flagged: number }
  demos: { total: number; completed: number }
  judging: { scoresSubmitted: number; scoresExpected: number }
  voting: { totalVotes: number }
  incidents: { reported: number; underReview: number; resolved: number; dismissed: number; openTotal: number }
}

// ---------------------------------------------------------------------------
// Traffic light helpers
// ---------------------------------------------------------------------------

type TrafficColor = 'green' | 'yellow' | 'red'

interface MetricCard {
  label: string
  value: string | number
  subLabel?: string
  color: TrafficColor
  section: string
  link?: string
}

const COLOR_STYLES: Record<TrafficColor, string> = {
  green: 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950',
  yellow: 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950',
  red: 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950',
}

const DOT_STYLES: Record<TrafficColor, string> = {
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
}

// ---------------------------------------------------------------------------
// Stage labels
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Build metric cards
// ---------------------------------------------------------------------------

function buildMetrics(data: DashboardData, competitionId: string): MetricCard[] {
  const cards: MetricCard[] = []
  const { checkin, teams, projects, demos, judging, voting, incidents, competition } = data

  // --- Check-In ---
  const checkinPct = checkin.total > 0 ? checkin.checkedIn / checkin.total : 0
  cards.push({
    label: 'Check-In Progress',
    value: `${checkin.checkedIn} / ${checkin.total}`,
    subLabel: `${Math.round(checkinPct * 100)}%`,
    color: checkinPct >= 0.75 ? 'green' : checkinPct >= 0.4 ? 'yellow' : 'red',
    section: 'Check-In',
    link: `/backend/competitions/checkin?competitionId=${competitionId}`,
  })

  // --- Teams ---
  cards.push({
    label: 'Teams Formed',
    value: teams.total,
    color: teams.total > 0 ? 'green' : 'yellow',
    section: 'Teams',
  })

  if (teams.withoutTrack > 0) {
    cards.push({
      label: 'Teams Without Track',
      value: teams.withoutTrack,
      color: teams.withoutTrack > teams.total * 0.3 ? 'red' : 'yellow',
      section: 'Teams',
    })
  }

  if (teams.belowMinSize > 0) {
    cards.push({
      label: `Teams Below Min Size (${competition.minTeamSize})`,
      value: teams.belowMinSize,
      color: 'red',
      section: 'Teams',
    })
  }

  // --- Projects ---
  cards.push({
    label: 'Projects Published',
    value: `${projects.published} / ${projects.total}`,
    color: projects.total > 0 && projects.published >= projects.total * 0.5 ? 'green' : projects.published > 0 ? 'yellow' : 'red',
    section: 'Projects',
  })

  if (projects.draft > 0) {
    cards.push({
      label: 'Projects in Draft',
      value: projects.draft,
      color: 'yellow',
      section: 'Projects',
    })
  }

  if (projects.flagged > 0) {
    cards.push({
      label: 'Projects Flagged',
      value: projects.flagged,
      color: 'red',
      section: 'Projects',
    })
  }

  // --- Demos ---
  if (demos.total > 0) {
    const demoPct = demos.completed / demos.total
    cards.push({
      label: 'Demo Progress',
      value: `${demos.completed} / ${demos.total}`,
      subLabel: `${Math.round(demoPct * 100)}%`,
      color: demoPct >= 0.9 ? 'green' : demoPct >= 0.5 ? 'yellow' : 'red',
      section: 'Demos',
    })
  }

  // --- Judging ---
  if (judging.scoresExpected > 0) {
    const judgingPct = judging.scoresSubmitted / judging.scoresExpected
    cards.push({
      label: 'Judging Progress',
      value: `${judging.scoresSubmitted} / ${judging.scoresExpected}`,
      subLabel: `${Math.round(judgingPct * 100)}%`,
      color: judgingPct >= 0.9 ? 'green' : judgingPct >= 0.5 ? 'yellow' : 'red',
      section: 'Judging',
    })
  }

  // --- Voting ---
  cards.push({
    label: 'Peer Votes Cast',
    value: voting.totalVotes,
    color: voting.totalVotes > 0 ? 'green' : 'yellow',
    section: 'Voting',
  })

  // --- Incidents ---
  if (incidents.openTotal > 0) {
    cards.push({
      label: 'Open Incidents',
      value: incidents.openTotal,
      subLabel: `${incidents.reported} reported, ${incidents.underReview} under review`,
      color: incidents.openTotal > 3 ? 'red' : 'yellow',
      section: 'Incidents',
      link: `/backend/incidents?competitionId=${competitionId}`,
    })
  }

  cards.push({
    label: 'Incidents Resolved',
    value: incidents.resolved + incidents.dismissed,
    color: 'green',
    section: 'Incidents',
    link: `/backend/incidents?competitionId=${competitionId}&status=RESOLVED`,
  })

  return cards
}

// ---------------------------------------------------------------------------
// MetricCard component
// ---------------------------------------------------------------------------

function MetricCardView({ card }: { card: MetricCard }) {
  const inner = (
    <div className={`rounded-lg border p-4 transition-colors ${COLOR_STYLES[card.color]} ${card.link ? 'hover:opacity-80 cursor-pointer' : ''}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`size-2 rounded-full ${DOT_STYLES[card.color]}`} />
        <span className="text-xs font-medium text-muted-foreground">{card.label}</span>
      </div>
      <div className="text-2xl font-bold tracking-tight">{card.value}</div>
      {card.subLabel && (
        <div className="text-xs text-muted-foreground mt-0.5">{card.subLabel}</div>
      )}
    </div>
  )

  if (card.link) {
    return <Link href={card.link}>{inner}</Link>
  }
  return inner
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CommandCenterPage() {
  const t = useT()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const scopeVersion = useOrganizationScopeVersion()
  const competitionId = searchParams.get('competitionId') ?? ''

  // Live refresh on any competition/incident/team/project/judging/sponsor event
  useAppEvent('competitions.*', () => {
    queryClient.invalidateQueries({ queryKey: ['command-center'] })
  }, [queryClient])
  useAppEvent('incidents.*', () => {
    queryClient.invalidateQueries({ queryKey: ['command-center'] })
  }, [queryClient])
  useAppEvent('teams.*', () => {
    queryClient.invalidateQueries({ queryKey: ['command-center'] })
  }, [queryClient])
  useAppEvent('projects.*', () => {
    queryClient.invalidateQueries({ queryKey: ['command-center'] })
  }, [queryClient])
  useAppEvent('judging.*', () => {
    queryClient.invalidateQueries({ queryKey: ['command-center'] })
  }, [queryClient])
  useAppEvent('sponsors.*', () => {
    queryClient.invalidateQueries({ queryKey: ['command-center'] })
  }, [queryClient])

  const { data, isLoading, error } = useQuery<DashboardData>({
    queryKey: ['command-center', competitionId, scopeVersion],
    queryFn: async () => {
      const res = await apiCall(`/api/competitions/competitions/dashboard?competitionId=${competitionId}`)
      return res as DashboardData
    },
    enabled: !!competitionId,
    refetchInterval: 30000,
  })

  if (!competitionId) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">{t('competitions.commandCenter.title', 'Event Command Center')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('competitions.commandCenter.selectCompetition', 'Please select a competition to view the dashboard.')}
        </p>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">{t('competitions.commandCenter.title', 'Event Command Center')}</h1>
        <div className="flex items-center justify-center py-20">
          <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">{t('competitions.commandCenter.title', 'Event Command Center')}</h1>
        <p className="text-red-600 mt-2">
          {t('competitions.commandCenter.error', 'Failed to load dashboard data.')}
        </p>
      </div>
    )
  }

  const allCards = buildMetrics(data, competitionId)

  // Separate attention items (yellow/red) from green
  const attentionCards = allCards.filter((c) => c.color === 'red' || c.color === 'yellow')
  const sections = ['Check-In', 'Teams', 'Projects', 'Demos', 'Judging', 'Voting', 'Incidents']

  return (
    <div className="flex flex-col gap-8 p-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          {t('competitions.commandCenter.title', 'Event Command Center')}
        </h1>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-sm text-muted-foreground">{data.competition.name}</span>
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
            {STAGE_LABELS[data.competition.stage] ?? data.competition.stage}
          </span>
          <span className="text-xs text-muted-foreground">
            Auto-refreshes every 30s
          </span>
        </div>
      </div>

      {/* Needs Attention */}
      {attentionCards.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <span className="size-2 rounded-full bg-yellow-500" />
            {t('competitions.commandCenter.needsAttention', 'Needs Attention')}
            <span className="text-sm font-normal text-muted-foreground">({attentionCards.length})</span>
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {attentionCards.map((card, i) => (
              <MetricCardView key={`attention-${i}`} card={card} />
            ))}
          </div>
        </div>
      )}

      {/* All sections */}
      {sections.map((section) => {
        const sectionCards = allCards.filter((c) => c.section === section)
        if (sectionCards.length === 0) return null
        return (
          <div key={section}>
            <h2 className="text-lg font-semibold mb-3">{section}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {sectionCards.map((card, i) => (
                <MetricCardView key={`${section}-${i}`} card={card} />
              ))}
            </div>
          </div>
        )
      })}

      {/* Stage side effects status */}
      <div className="rounded-lg border p-5">
        <h2 className="text-sm font-semibold text-muted-foreground mb-2">
          {t('competitions.commandCenter.stageStatus', 'Current Stage Status')}
        </h2>
        <div className="flex items-center gap-3">
          <span className="text-lg font-bold">
            {STAGE_LABELS[data.competition.stage] ?? data.competition.stage}
          </span>
          <StageProgressIndicator stage={data.competition.stage} />
        </div>
        <div className="mt-3 text-sm text-muted-foreground">
          {getStageDescription(data.competition.stage, data)}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stage progress indicator
// ---------------------------------------------------------------------------

const STAGES_ORDER = [
  'DRAFT', 'OPEN', 'TEAM_FORMATION', 'TRACK_SELECTION',
  'HACKING', 'DEMOS', 'DELIBERATION', 'FINISHED',
]

function StageProgressIndicator({ stage }: { stage: string }) {
  const currentIdx = STAGES_ORDER.indexOf(stage)
  return (
    <div className="flex items-center gap-1">
      {STAGES_ORDER.map((s, i) => (
        <div
          key={s}
          className={`h-2 w-6 rounded-full ${
            i <= currentIdx
              ? 'bg-primary'
              : 'bg-muted'
          }`}
          title={STAGE_LABELS[s]}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stage descriptions
// ---------------------------------------------------------------------------

function getStageDescription(stage: string, data: DashboardData): string {
  switch (stage) {
    case 'DRAFT':
      return 'Competition is in draft mode. Configure settings before opening registration.'
    case 'OPEN':
      return `Registration is open. ${data.checkin.total} participants registered so far.`
    case 'TEAM_FORMATION':
      return `${data.teams.total} teams formed. ${data.teams.belowMinSize > 0 ? `${data.teams.belowMinSize} teams below minimum size.` : 'All teams meet size requirements.'}`
    case 'TRACK_SELECTION':
      return `${data.teams.withTrack} of ${data.teams.total} teams have selected a track.`
    case 'HACKING':
      return `Hacking in progress. ${data.projects.published} projects published, ${data.projects.draft} still in draft.`
    case 'DEMOS':
      return `Demo presentations underway. ${data.demos.completed} of ${data.demos.total} completed.`
    case 'DELIBERATION':
      return `Judging in progress. ${data.judging.scoresSubmitted} of ${data.judging.scoresExpected} scores submitted.`
    case 'FINISHED':
      return `Event finished. ${data.voting.totalVotes} peer votes cast. Results are available.`
    case 'ARCHIVED':
      return 'This competition has been archived.'
    default:
      return ''
  }
}

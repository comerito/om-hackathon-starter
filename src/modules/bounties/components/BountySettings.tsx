"use client"

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@open-mercato/ui/primitives/button'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'

type CompetitionOption = { id: string; name: string }
type TrackOption = { id: string; name: string; color: string; competition_id: string }
type Mappings = Record<string, string>
type ScheduledJobRow = { id: string; name: string; isEnabled: boolean; scheduleValue: string; lastRunAt: string | null; nextRunAt: string | null }

export default function BountySettings() {
  const t = useT()
  const queryClient = useQueryClient()
  const scopeVersion = useOrganizationScopeVersion()
  const [addCompetitionId, setAddCompetitionId] = React.useState('')
  const [addTrackId, setAddTrackId] = React.useState('')
  const [saving, setSaving] = React.useState(false)
  const [creatingSchedule, setCreatingSchedule] = React.useState(false)

  // Load config
  const { data: config, isLoading: configLoading } = useQuery({
    queryKey: ['bounty-config', scopeVersion],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ ok: boolean; mappings: Mappings }>('/api/bounties/config')
      return ok && result ? result.mappings : {}
    },
  })

  // Load competitions
  const { data: competitions } = useQuery({
    queryKey: ['all-competitions', scopeVersion],
    queryFn: async () => {
      const res = await fetchCrudList<CompetitionOption>('competitions/competitions', { pageSize: '100' })
      return res?.items ?? []
    },
  })

  // Load all tracks
  const { data: allTracks } = useQuery({
    queryKey: ['all-tracks-lookup', scopeVersion],
    queryFn: async () => {
      const res = await fetchCrudList<TrackOption>('tracks/tracks', { pageSize: '100' })
      return res?.items ?? []
    },
  })

  // Load scheduler jobs to find bounty poll job
  const { data: pollJob, isLoading: pollJobLoading, refetch: refetchPollJob } = useQuery({
    queryKey: ['bounty-poll-job', scopeVersion],
    queryFn: async () => {
      const res = await fetchCrudList<ScheduledJobRow>('scheduler/jobs', {
        pageSize: '100',
        sourceModule: 'bounties',
      })
      return (res?.items ?? []).find(j => j.name.includes('GitHub PR Poll')) ?? null
    },
  })

  const handleCreateSchedule = async () => {
    setCreatingSchedule(true)
    try {
      const { ok } = await apiCall('/api/scheduler/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Bounty Hunting — GitHub PR Poll',
          description: 'Polls GitHub API every minute for new PRs with the bounty-hunting label.',
          scopeType: 'organization',
          scheduleType: 'cron',
          scheduleValue: '*/1 * * * *',
          timezone: 'UTC',
          targetType: 'queue',
          targetQueue: 'bounties-queue',
          targetPayload: { workerId: 'poll-github', data: {} },
          isEnabled: false,
          sourceType: 'module',
          sourceModule: 'bounties',
        }),
      })
      if (ok) {
        flash(t('bounties.settings.scheduleCreated', 'GitHub polling schedule created. Enable it when ready.'), 'success')
        refetchPollJob()
      } else {
        flash('Failed to create schedule', 'error')
      }
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to create schedule', 'error')
    } finally {
      setCreatingSchedule(false)
    }
  }

  const handleToggleSchedule = async () => {
    if (!pollJob) return
    setSaving(true)
    try {
      const { ok } = await apiCall(`/api/scheduler/jobs`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: pollJob.id,
          isEnabled: !pollJob.isEnabled,
        }),
      })
      if (ok) {
        flash(
          pollJob.isEnabled
            ? t('bounties.settings.schedulePaused', 'GitHub polling paused')
            : t('bounties.settings.scheduleEnabled', 'GitHub polling enabled'),
          'success'
        )
        refetchPollJob()
      }
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to update schedule', 'error')
    } finally {
      setSaving(false)
    }
  }

  const mappings = config ?? {}

  // Competitions that already have a mapping
  const mappedCompetitionIds = new Set(Object.keys(mappings))
  const unmappedCompetitions = (competitions ?? []).filter(c => !mappedCompetitionIds.has(c.id))

  // Tracks for the currently selected "add" competition
  const addTracks = React.useMemo(() => {
    if (!addCompetitionId || !allTracks) return []
    return allTracks.filter(t => t.competition_id === addCompetitionId)
  }, [addCompetitionId, allTracks])

  // Helper: resolve names
  const competitionName = (id: string) => competitions?.find(c => c.id === id)?.name ?? id
  const trackName = (id: string) => allTracks?.find(t => t.id === id)?.name ?? id
  const trackColor = (id: string) => allTracks?.find(t => t.id === id)?.color ?? '#888'

  const saveMappings = async (newMappings: Mappings) => {
    setSaving(true)
    try {
      const { ok } = await apiCall('/api/bounties/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mappings: newMappings }),
      })
      if (ok) {
        flash(t('bounties.settings.saved', 'Bounty track settings saved'), 'success')
        queryClient.invalidateQueries({ queryKey: ['bounty-config'] })
      } else {
        flash('Failed to save', 'error')
      }
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to save', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleAdd = async () => {
    if (!addCompetitionId || !addTrackId) return
    const newMappings = { ...mappings, [addCompetitionId]: addTrackId }
    await saveMappings(newMappings)
    setAddCompetitionId('')
    setAddTrackId('')
  }

  const handleRemove = async (competitionId: string) => {
    const newMappings = { ...mappings }
    delete newMappings[competitionId]
    await saveMappings(newMappings)
  }

  const entries = Object.entries(mappings)

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-bold mb-1">{t('bounties.settings.heading', 'Bounty Hunting Settings')}</h2>
      <p className="text-sm text-muted-foreground mb-6">
        {t('bounties.settings.description', 'Configure which track per competition is used for bounty hunting. Participants on the assigned track will see their bounty PRs and the leaderboard in the portal.')}
      </p>

      {/* Existing mappings table */}
      <div className="rounded-lg border bg-background overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="text-left px-4 py-3 font-medium">{t('bounties.settings.competition', 'Competition')}</th>
              <th className="text-left px-4 py-3 font-medium">{t('bounties.settings.track', 'Bounty Track')}</th>
              <th className="text-right px-4 py-3 font-medium w-24"></th>
            </tr>
          </thead>
          <tbody>
            {configLoading ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">{t('common.loading', 'Loading...')}</td></tr>
            ) : entries.length === 0 ? (
              <tr><td colSpan={3} className="px-4 py-6 text-center text-muted-foreground">{t('bounties.settings.noMappings', 'No bounty tracks configured yet. Add one below.')}</td></tr>
            ) : (
              entries.map(([compId, trkId]) => (
                <tr key={compId} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium">{competitionName(compId)}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full inline-block" style={{ backgroundColor: trackColor(trkId) }} />
                      {trackName(trkId)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleRemove(compId)}
                      disabled={saving}
                      className="text-xs text-destructive hover:text-destructive/80 font-medium disabled:opacity-50"
                    >
                      {t('common.remove', 'Remove')}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Add new mapping */}
      {unmappedCompetitions.length > 0 && (
        <div className="mt-4 rounded-lg border bg-background p-4">
          <h3 className="text-sm font-medium mb-3">{t('bounties.settings.addMapping', 'Add bounty track')}</h3>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t('bounties.settings.competition', 'Competition')}
              </label>
              <select
                value={addCompetitionId}
                onChange={(e) => { setAddCompetitionId(e.target.value); setAddTrackId('') }}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">{t('bounties.settings.selectCompetition', 'Select competition...')}</option>
                {unmappedCompetitions.map(comp => (
                  <option key={comp.id} value={comp.id}>{comp.name}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                {t('bounties.settings.track', 'Track')}
              </label>
              <select
                value={addTrackId}
                onChange={(e) => setAddTrackId(e.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
                disabled={!addCompetitionId}
              >
                <option value="">{addCompetitionId ? t('bounties.settings.selectTrack', 'Select track...') : t('bounties.settings.selectCompetitionFirst', 'Select competition first')}</option>
                {addTracks.map(track => (
                  <option key={track.id} value={track.id}>{track.name}</option>
                ))}
              </select>
            </div>

            <Button size="sm" onClick={handleAdd} disabled={!addCompetitionId || !addTrackId || saving}>
              {t('common.add', 'Add')}
            </Button>
          </div>
        </div>
      )}
      {/* GitHub Polling Schedule */}
      <div className="mt-8">
        <h3 className="text-lg font-bold mb-1">{t('bounties.settings.pollingHeading', 'GitHub Polling')}</h3>
        <p className="text-sm text-muted-foreground mb-4">
          {t('bounties.settings.pollingDescription', 'The polling schedule checks GitHub every minute for new PRs with the bounty-hunting label. Create the schedule and enable it when the event starts.')}
        </p>

        <div className="rounded-lg border bg-background p-5">
          {pollJobLoading ? (
            <p className="text-sm text-muted-foreground">{t('common.loading', 'Loading...')}</p>
          ) : pollJob ? (
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`inline-flex size-2 rounded-full ${pollJob.isEnabled ? 'bg-green-500' : 'bg-gray-300'}`} />
                  <span className="text-sm font-medium">
                    {pollJob.isEnabled
                      ? t('bounties.settings.pollingActive', 'Polling active')
                      : t('bounties.settings.pollingPaused', 'Polling paused')}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('bounties.settings.schedule', 'Schedule')}: {pollJob.scheduleValue}
                  {pollJob.lastRunAt && (
                    <> · {t('bounties.settings.lastRun', 'Last run')}: {new Date(pollJob.lastRunAt).toLocaleTimeString()}</>
                  )}
                </p>
              </div>
              <Button
                variant={pollJob.isEnabled ? 'outline' : 'default'}
                size="sm"
                onClick={handleToggleSchedule}
                disabled={saving}
              >
                {pollJob.isEnabled
                  ? t('bounties.settings.pausePolling', 'Pause')
                  : t('bounties.settings.enablePolling', 'Enable')}
              </Button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t('bounties.settings.noSchedule', 'No polling schedule configured')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('bounties.settings.noScheduleHint', 'Create a schedule to automatically detect new bounty hunting PRs from GitHub.')}
                </p>
              </div>
              <Button size="sm" onClick={handleCreateSchedule} disabled={creatingSchedule}>
                {creatingSchedule
                  ? t('common.creating', 'Creating...')
                  : t('bounties.settings.createSchedule', 'Create Poll Schedule')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

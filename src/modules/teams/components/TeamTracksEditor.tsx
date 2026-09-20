"use client"
import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { Button } from '@open-mercato/ui/primitives/button'
import { Checkbox } from '@open-mercato/ui/primitives/checkbox'
import { Label } from '@open-mercato/ui/primitives/label'
import type { TeamTrackSummary } from './TeamRoster'

/* Organizer track assignment for one team — works at any stage, see api/admin/assign-tracks. */

type TrackOption = { id: string; name: string; color: string | null; is_active: boolean }

type AssignResult = {
  ok?: boolean
  error?: string
  details?: Array<{ title?: string; status?: string } | string>
  created_project_ids?: string[]
  removed_project_ids?: string[]
}

export function TeamTracksEditor({
  teamId,
  competitionId,
  assigned,
  onSaved,
}: {
  teamId: string
  competitionId: string
  assigned: readonly TeamTrackSummary[]
  onSaved: () => void | Promise<void>
}) {
  const t = useT()
  const [options, setOptions] = React.useState<TrackOption[] | null>(null)
  const [maxTracks, setMaxTracks] = React.useState(1)
  const [stage, setStage] = React.useState<string | null>(null)
  const [selected, setSelected] = React.useState<string[]>(() => assigned.map((track) => track.id))
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => { setSelected(assigned.map((track) => track.id)) }, [assigned])

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      const [tracks, competitions] = await Promise.all([
        fetchCrudList<TrackOption>('tracks/tracks', { competition_id: competitionId, pageSize: '100', sortField: 'sort_order', sortDir: 'asc' }),
        fetchCrudList<{ id: string; stage: string; max_tracks_per_team: number }>('competitions/competitions', { id: competitionId, pageSize: '1' }),
      ])
      if (cancelled) return
      setOptions(tracks?.items ?? [])
      const competition = competitions?.items?.[0]
      setMaxTracks(Number(competition?.max_tracks_per_team ?? 1) || 1)
      setStage(competition?.stage ?? null)
    }
    load().catch(() => { if (!cancelled) setOptions([]) })
    return () => { cancelled = true }
  }, [competitionId])

  const assignedIds = assigned.map((track) => track.id)
  const dirty = selected.length !== assignedIds.length || selected.some((id) => !assignedIds.includes(id))
  const limitReached = selected.length >= maxTracks

  function toggle(trackId: string, checked: boolean) {
    setSelected((current) => {
      if (!checked) return current.filter((id) => id !== trackId)
      if (current.includes(trackId)) return current
      // With a single-track limit a click means "switch", not "blocked".
      return maxTracks === 1 ? [trackId] : [...current, trackId]
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      const { ok, result } = await apiCall<AssignResult>('/api/teams/admin/assign-tracks', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ team_id: teamId, track_ids: selected }),
      })
      if (!ok) {
        const titles = (result?.details ?? [])
          .map((detail) => (typeof detail === 'string' ? '' : detail.title ?? ''))
          .filter(Boolean)
        flash(`${result?.error ?? t('teams.tracksEditor.saveFailed', 'Could not update tracks')}${titles.length ? ` (${titles.join(', ')})` : ''}`, 'error')
        return
      }
      const created = result?.created_project_ids?.length ?? 0
      flash(
        created > 0
          ? t('teams.tracksEditor.savedWithDrafts', 'Tracks updated. Draft projects created: {count}', { count: created })
          : t('teams.tracksEditor.saved', 'Tracks updated'),
        'success',
      )
      await onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="text-base font-semibold">{t('teams.roster.tracks', 'Selected tracks')} ({assigned.length})</h3>
      <p className="mb-3 mt-1 text-xs text-muted-foreground">
        {t('teams.tracksEditor.help', 'Organizers can set tracks at any stage, up to {max} per team.', { max: maxTracks })}
        {stage === 'hacking' && ` ${t('teams.tracksEditor.hackingHint', 'The competition is in the hacking stage, so a draft project is created for every newly assigned track.')}`}
      </p>

      {options === null ? (
        <p className="text-sm text-muted-foreground">{t('teams.tracksEditor.loading', 'Loading tracks...')}</p>
      ) : options.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('teams.tracksEditor.noTracks', 'This competition has no tracks.')}</p>
      ) : (
        <div className="space-y-2">
          {options.map((track) => {
            const checked = selected.includes(track.id)
            // A deactivated track can be kept, but not newly given to a team.
            const disabled = saving || (!checked && ((maxTracks > 1 && limitReached) || (!track.is_active && !assignedIds.includes(track.id))))
            return (
              <div key={track.id} className="flex items-center gap-2">
                <Checkbox id={`team-track-${track.id}`} checked={checked} disabled={disabled} onCheckedChange={(value) => toggle(track.id, value === true)} />
                <Label htmlFor={`team-track-${track.id}`} className="flex items-center gap-1.5 font-normal">
                  <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: track.color ?? 'currentColor' }} aria-hidden="true" />
                  {track.name}
                  {!track.is_active && <span className="text-xs text-muted-foreground">({t('teams.tracksEditor.inactive', 'inactive')})</span>}
                </Label>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-4">
        <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
          {saving ? t('teams.tracksEditor.saving', 'Saving...') : t('teams.tracksEditor.save', 'Save tracks')}
        </Button>
      </div>
    </div>
  )
}

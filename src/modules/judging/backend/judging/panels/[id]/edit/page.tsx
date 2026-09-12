"use client"
import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { CrudForm, type CrudField, type CrudFormGroup } from '@open-mercato/ui/backend/CrudForm'
import { Button } from '@open-mercato/ui/primitives/button'
import { fetchCrudList, updateCrud, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { pushWithFlash } from '@open-mercato/ui/backend/utils/flash'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import Link from 'next/link'

type PanelData = {
  panel: { id: string; name: string; round: string; competition_id: string; _competitions?: { name: string | null } }
  judges: Array<{ id: string; judge_id: string; display_name: string; email: string | null }>
  tracks: Array<{ id: string; track_id: string; track_name: string; color: string }>
}

type JudgeOption = { id: string; display_name: string; email: string | null }
type TrackOption = { id: string; name: string; color: string }

export default function EditPanelPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const panelId = params?.id

  // Load panel data (judges + tracks)
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['panel-members', panelId],
    queryFn: async () => {
      if (!panelId) return null
      const { ok, result } = await apiCall<PanelData>(`/api/judging/panel-members?panel_id=${panelId}`)
      return ok ? result : null
    },
    enabled: !!panelId,
  })

  // Load available judges — filtered to the judges of the panel's own competition, the same
  // way the track dropdown below is. The endpoint resolves the competition from the panel.
  const { data: availableJudges, isLoading: judgesLoading, isError: judgesError } = useQuery({
    queryKey: ['available-judges', panelId],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ items: JudgeOption[] }>(
        `/api/judging/eligible-judges?panel_id=${panelId}`,
      )
      if (!ok) throw new Error('Failed to load judges')
      return result?.items ?? []
    },
    enabled: !!panelId,
  })

  // Load available tracks — filtered by the panel's competition
  const competitionId = data?.panel?.competition_id
  const { data: availableTracks } = useQuery({
    queryKey: ['available-tracks-for-panel', competitionId],
    queryFn: async () => {
      const params: Record<string, string> = { pageSize: '100' }
      if (competitionId) params.competition_id = competitionId
      const res = await fetchCrudList<TrackOption>('tracks/tracks', params)
      return res?.items ?? []
    },
    enabled: !!competitionId,
  })

  const [addingJudge, setAddingJudge] = React.useState(false)
  const [addingTrack, setAddingTrack] = React.useState(false)
  const [selectedJudgeId, setSelectedJudgeId] = React.useState('')
  const [selectedTrackId, setSelectedTrackId] = React.useState('')

  async function handleAddJudge() {
    if (!selectedJudgeId || !panelId) return
    setAddingJudge(true)
    const { ok, result } = await apiCall('/api/judging/panel-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ panel_id: panelId, type: 'judge', judge_id: selectedJudgeId }),
    })
    setAddingJudge(false)
    if (ok) {
      flash('Judge added', 'success')
      setSelectedJudgeId('')
      refetch()
    } else {
      flash((result as any)?.error ?? 'Failed to add judge', 'error')
    }
  }

  async function handleRemoveJudge(entryId: string) {
    const { ok } = await apiCall(`/api/judging/panel-members?id=${entryId}&type=judge`, { method: 'DELETE' })
    if (ok) { flash('Judge removed', 'success'); refetch() }
    else flash('Failed to remove', 'error')
  }

  async function handleAddTrack() {
    if (!selectedTrackId || !panelId) return
    setAddingTrack(true)
    const { ok, result } = await apiCall('/api/judging/panel-members', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ panel_id: panelId, type: 'track', track_id: selectedTrackId }),
    })
    setAddingTrack(false)
    if (ok) {
      flash('Track added', 'success')
      setSelectedTrackId('')
      refetch()
    } else {
      flash((result as any)?.error ?? 'Failed to add track', 'error')
    }
  }

  async function handleRemoveTrack(entryId: string) {
    const { ok } = await apiCall(`/api/judging/panel-members?id=${entryId}&type=track`, { method: 'DELETE' })
    if (ok) { flash('Track removed', 'success'); refetch() }
    else flash('Failed to remove', 'error')
  }

  // Filter out already-assigned judges/tracks from dropdowns
  const assignedJudgeIds = new Set(data?.judges.map(j => j.judge_id) ?? [])
  const assignedTrackIds = new Set(data?.tracks.map(t => t.track_id) ?? [])
  const unassignedJudges = (availableJudges ?? []).filter(j => !assignedJudgeIds.has(j.id))
  const unassignedTracks = (availableTracks ?? []).filter(t => !assignedTrackIds.has(t.id))

  if (!panelId) return null

  if (isLoading) {
    return <Page><PageBody><p className="text-sm text-muted-foreground">Loading...</p></PageBody></Page>
  }

  if (!data) {
    return <Page><PageBody><p className="text-sm text-portal-danger">Panel not found</p></PageBody></Page>
  }

  return (
    <Page>
      <PageBody>
        {/* Header */}
        <div className="mb-6">
          <Link href="/backend/judging" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            &larr; Back to Judging
          </Link>
          <h1 className="mt-2 text-xl font-bold">{data.panel.name}</h1>
          <p className="text-sm text-muted-foreground capitalize">Round: {data.panel.round}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Judges section */}
          <div className="rounded-lg border bg-background p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Assigned Judges ({data.judges.length})</h3>
            </div>

            {data.judges.length === 0 ? (
              <p className="text-sm text-muted-foreground">No judges assigned yet.</p>
            ) : (
              <div className="divide-y">
                {data.judges.map((judge) => (
                  <div key={judge.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                        {judge.display_name.split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{judge.display_name}</p>
                        {judge.email && <p className="text-xs text-muted-foreground">{judge.email}</p>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveJudge(judge.id)}
                      className="text-xs text-portal-danger hover:text-portal-danger/80 font-medium"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add judge — the dropdown only offers judges of this panel's competition */}
            <div className="pt-2 border-t">
              {judgesLoading ? (
                <p className="text-sm text-muted-foreground">Loading judges...</p>
              ) : judgesError ? (
                <p className="text-sm text-portal-danger">Could not load the list of judges. Reload the page to try again.</p>
              ) : (availableJudges ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No judges on this competition yet.{' '}
                  <Link href="/backend/competitions/participants" className="underline hover:text-foreground">
                    Invite a participant with the Judge role
                  </Link>{' '}
                  before assigning one to a panel.
                </p>
              ) : unassignedJudges.length === 0 ? (
                <p className="text-sm text-muted-foreground">Every judge of this competition is already on this panel.</p>
              ) : (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedJudgeId}
                    onChange={(e) => setSelectedJudgeId(e.target.value)}
                    className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Select a judge...</option>
                    {unassignedJudges.map(j => (
                      <option key={j.id} value={j.id}>{j.display_name || j.email}</option>
                    ))}
                  </select>
                  <Button size="sm" onClick={handleAddJudge} disabled={!selectedJudgeId || addingJudge}>
                    {addingJudge ? 'Adding...' : 'Add'}
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Tracks section */}
          <div className="rounded-lg border bg-background p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold">Assigned Tracks ({data.tracks.length})</h3>
            </div>

            {data.tracks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tracks assigned yet. This panel will judge all tracks.</p>
            ) : (
              <div className="divide-y">
                {data.tracks.map((track) => (
                  <div key={track.id} className="flex items-center justify-between py-2.5">
                    <div className="flex items-center gap-3">
                      <div className="h-3 w-3 rounded-full" style={{ backgroundColor: track.color }} />
                      <p className="text-sm font-medium">{track.track_name}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveTrack(track.id)}
                      className="text-xs text-portal-danger hover:text-portal-danger/80 font-medium"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add track */}
            <div className="flex items-center gap-2 pt-2 border-t">
              <select
                value={selectedTrackId}
                onChange={(e) => setSelectedTrackId(e.target.value)}
                className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Select a track...</option>
                {unassignedTracks.map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <Button size="sm" onClick={handleAddTrack} disabled={!selectedTrackId || addingTrack}>
                {addingTrack ? 'Adding...' : 'Add'}
              </Button>
            </div>
          </div>
        </div>

        {/* Delete panel */}
        <div className="mt-8 pt-6 border-t">
          <Button
            variant="outline"
            className="border-portal-danger/20 text-portal-danger hover:bg-portal-danger/5"
            onClick={async () => {
              if (!confirm('Delete this panel? This cannot be undone.')) return
              try {
                await deleteCrud('judging/panels', panelId)
                pushWithFlash(router, '/backend/judging', 'Panel deleted', 'success')
              } catch {
                flash('Failed to delete panel', 'error')
              }
            }}
          >
            Delete Panel
          </Button>
        </div>
      </PageBody>
    </Page>
  )
}

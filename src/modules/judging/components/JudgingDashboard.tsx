"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { EnumBadge } from '@open-mercato/ui/backend/ValueIcons'
import { Button } from '@open-mercato/ui/primitives/button'
import { fetchCrudList, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import Link from 'next/link'

type PanelRow = { id: string; name: string; competition_id: string; round: string; created_at: string; _judging?: { judgeCount: number; trackCount: number } }
type CriterionRow = { id: string; name: string; track_id: string | null; weight: number; max_score: number; round: string; order: number }
type DemoRow = {
  id: string
  team_id: string
  project_id: string
  track_id: string
  team_name: string | null
  project_title: string | null
  track_name: string | null
  status: string
  presentation_order: number
  actual_start: string | null
  round: string
}
type ScoreProgress = { project_id: string; judge_id: string; is_submitted: boolean; total_score: number | null; round: string }

const roundPreset: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  preliminary: { label: 'Preliminary', variant: 'default' },
  final: { label: 'Final', variant: 'secondary' },
  both: { label: 'Both', variant: 'outline' },
}

const demoStatusPreset: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  queued: { label: 'Queued', variant: 'secondary' },
  on_deck: { label: 'On Deck', variant: 'outline' },
  presenting: { label: 'Presenting', variant: 'default' },
  qa: { label: 'Q&A', variant: 'default' },
  completed: { label: 'Completed', variant: 'secondary' },
  skipped: { label: 'Skipped', variant: 'destructive' },
}

export default function JudgingDashboard() {
  const t = useT()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const scopeVersion = useOrganizationScopeVersion()
  const [tab, setTab] = React.useState<'panels' | 'criteria' | 'demos' | 'scores' | 'leaderboard'>('panels')
  const [selectedCompetitionId, setSelectedCompetitionId] = React.useState('')

  // Competitions for the demo queue selector
  const { data: competitionsData } = useQuery({
    queryKey: ['judging-competitions', scopeVersion],
    queryFn: () => fetchCrudList<{ id: string; name: string; stage: string }>('competitions/competitions', { pageSize: '20' }),
  })

  // Panels
  const { data: panelsData, isLoading: panelsLoading } = useQuery({
    queryKey: ['judging-panels', scopeVersion],
    queryFn: () => fetchCrudList<PanelRow>('judging/panels', { pageSize: '50' }),
    enabled: tab === 'panels',
  })

  // Tracks (for name lookup in criteria tab)
  const { data: tracksData } = useQuery({
    queryKey: ['judging-tracks', scopeVersion],
    queryFn: () => fetchCrudList<{ id: string; name: string }>('tracks/tracks', { pageSize: '100' }),
    enabled: tab === 'criteria',
  })
  const trackNameMap = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const t of tracksData?.items ?? []) map.set(t.id, t.name)
    return map
  }, [tracksData])

  // Criteria
  const { data: criteriaData, isLoading: criteriaLoading } = useQuery({
    queryKey: ['judging-criteria', scopeVersion],
    queryFn: () => fetchCrudList<CriterionRow>('judging/criteria', { pageSize: '50', sortField: 'order', sortDir: 'asc' }),
    enabled: tab === 'criteria',
  })

  // Copy criteria dialog state
  const [showCopyDialog, setShowCopyDialog] = React.useState(false)
  const [copySourceTrack, setCopySourceTrack] = React.useState<string>('')
  const [copyTargetTrack, setCopyTargetTrack] = React.useState<string>('')
  const [copyCompetitionId, setCopyCompetitionId] = React.useState<string>('')
  const [copying, setCopying] = React.useState(false)

  async function handleCopyCriteria() {
    if (!copyCompetitionId || !copyTargetTrack) { flash('Select competition and target track', 'error'); return }
    setCopying(true)
    const { ok, result } = await apiCall<{ count: number }>('/api/judging/copy-criteria', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        competition_id: copyCompetitionId,
        source_track_id: copySourceTrack || null,
        target_track_id: copyTargetTrack,
      }),
    })
    setCopying(false)
    if (ok) {
      flash(`Copied ${result?.count ?? 0} criteria`, 'success')
      queryClient.invalidateQueries({ queryKey: ['judging-criteria'] })
      setShowCopyDialog(false)
    } else {
      flash('Failed to copy criteria', 'error')
    }
  }

  // Demos
  const { data: demosData, isLoading: demosLoading } = useQuery({
    queryKey: ['judging-demos', scopeVersion, selectedCompetitionId],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedCompetitionId) params.set('competition_id', selectedCompetitionId)
      const url = params.size > 0 ? `/api/judging/demos?${params.toString()}` : '/api/judging/demos'
      const { ok, result } = await apiCall<{ items: DemoRow[] }>(url)
      return ok ? result : { items: [] }
    },
    enabled: tab === 'demos',
  })

  // Scores progress
  const { data: scoresData, isLoading: scoresLoading } = useQuery({
    queryKey: ['judging-scores', scopeVersion],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ items: ScoreProgress[] }>('/api/judging/scores')
      return ok ? result : { items: [] }
    },
    enabled: tab === 'scores',
  })

  // Leaderboard
  const { data: leaderboardData, isLoading: leaderboardLoading } = useQuery({
    queryKey: ['judging-leaderboard', scopeVersion],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ items: Array<{ project_title: string; team_name: string; average_score: number | null; rank: number | null; track_id: string }> }>('/api/judging/leaderboard?competition_id=all')
      return ok ? result : { items: [] }
    },
    enabled: tab === 'leaderboard',
  })

  const panelColumns = React.useMemo<ColumnDef<PanelRow>[]>(() => [
    { accessorKey: 'name', header: t('judging.table.name', 'Name'), meta: { priority: 1 } },
    { accessorKey: 'round', header: t('judging.table.round', 'Round'), meta: { priority: 2 }, cell: ({ getValue }) => <EnumBadge value={String(getValue())} map={roundPreset} /> },
    { id: 'judges', header: t('judging.table.judges', 'Judges'), meta: { priority: 2 }, cell: ({ row }) => row.original._judging?.judgeCount ?? 0 },
    { id: 'tracks', header: t('judging.table.tracks', 'Tracks'), meta: { priority: 3 }, cell: ({ row }) => row.original._judging?.trackCount ?? 0 },
  ], [t])

  const criterionColumns = React.useMemo<ColumnDef<CriterionRow>[]>(() => [
    { accessorKey: 'name', header: t('judging.table.name', 'Name'), meta: { priority: 1 } },
    { accessorKey: 'track_id', header: t('judging.table.track', 'Track'), meta: { priority: 2 }, cell: ({ getValue }) => { const v = getValue() as string | null; return v ? (trackNameMap.get(v) ?? v.substring(0, 8)) : 'All' } },
    { accessorKey: 'weight', header: t('judging.table.weight', 'Weight'), meta: { priority: 2 }, cell: ({ getValue }) => `${(Number(getValue()) * 100).toFixed(0)}%` },
    { accessorKey: 'max_score', header: t('judging.table.maxScore', 'Max'), meta: { priority: 2 } },
    { accessorKey: 'round', header: t('judging.table.round', 'Round'), meta: { priority: 3 }, cell: ({ getValue }) => <EnumBadge value={String(getValue())} map={roundPreset} /> },
  ], [t, trackNameMap])

  const demoColumns = React.useMemo<ColumnDef<DemoRow>[]>(() => [
    { accessorKey: 'presentation_order', header: '#', meta: { priority: 1 }, cell: ({ getValue }) => Number(getValue()) + 1 },
    { accessorKey: 'status', header: t('judging.table.status', 'Status'), meta: { priority: 1 }, cell: ({ getValue }) => <EnumBadge value={String(getValue())} map={demoStatusPreset} /> },
    {
      accessorKey: 'project_title',
      header: t('judging.table.project', 'Project'),
      meta: { priority: 2 },
      cell: ({ row }) => row.original.project_title ?? `${row.original.project_id.substring(0, 8)}...`,
    },
    {
      accessorKey: 'track_name',
      header: t('judging.table.track', 'Track'),
      meta: { priority: 2 },
      cell: ({ row }) => row.original.track_name ?? row.original.track_id.substring(0, 8),
    },
    { accessorKey: 'actual_start', header: t('judging.table.started', 'Started'), meta: { priority: 3 }, cell: ({ getValue }) => getValue() ? new Date(getValue() as string).toLocaleTimeString() : '—' },
  ], [t])

  async function handleGenerateQueue() {
    if (!selectedCompetitionId) { flash('Please select a competition first', 'error'); return }
    const confirmed = await confirm({ title: t('judging.confirmGenerate', 'Generate demo queue from published projects?') })
    if (!confirmed) return
    const { ok } = await apiCall('/api/judging/demos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'generate', competition_id: selectedCompetitionId }) })
    if (ok) { flash(t('judging.flash.queueGenerated', 'Demo queue generated'), 'success'); queryClient.invalidateQueries({ queryKey: ['judging-demos'] }) }
    else flash(t('judging.flash.error', 'Failed to generate queue'), 'error')
  }

  async function handleAdvanceDemo(demoId: string, status: string) {
    const { ok } = await apiCall('/api/judging/demos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'advance', id: demoId, status }) })
    if (ok) { queryClient.invalidateQueries({ queryKey: ['judging-demos'] }) }
    else flash(t('judging.flash.error', 'Failed to advance demo'), 'error')
  }

  const tabs = [
    { key: 'panels' as const, label: t('judging.tabs.panels', 'Panels') },
    { key: 'criteria' as const, label: t('judging.tabs.criteria', 'Criteria') },
    { key: 'demos' as const, label: t('judging.tabs.demos', 'Demo Queue') },
    { key: 'scores' as const, label: t('judging.tabs.scores', 'Scoring Progress') },
    { key: 'leaderboard' as const, label: t('judging.tabs.leaderboard', 'Leaderboard') },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'panels' && (
        <DataTable title={t('judging.panels.title', 'Judge Panels')}
          actions={<Button asChild><Link href="/backend/judging/panels/create">{t('judging.panels.create', 'Create Panel')}</Link></Button>}
          columns={panelColumns} data={panelsData?.items ?? []}
          isLoading={panelsLoading}
          rowActions={(row) => (
            <RowActions items={[
              { id: 'edit', label: t('common.edit', 'Edit'), onSelect: () => { window.location.href = `/backend/judging/panels/${row.id}/edit` } },
              { id: 'delete', label: t('common.delete', 'Delete'), destructive: true, onSelect: async () => {
                const ok = await confirm({ title: t('judging.panels.confirmDelete', 'Delete this panel?'), variant: 'destructive' })
                if (!ok) return
                await deleteCrud('judging/panels', row.id)
                flash(t('judging.flash.panelDeleted', 'Panel deleted'), 'success')
                queryClient.invalidateQueries({ queryKey: ['judging-panels'] })
              }},
            ]} />
          )}
        />
      )}

      {tab === 'criteria' && (
        <>
          <DataTable title={t('judging.criteria.title', 'Judging Criteria')}
            actions={
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowCopyDialog(true)}>{t('judging.criteria.copy', 'Copy Criteria')}</Button>
                <Button asChild><Link href="/backend/judging/criteria/create">{t('judging.criteria.create', 'Create Criterion')}</Link></Button>
              </div>
            }
            columns={criterionColumns} data={criteriaData?.items ?? []}
            isLoading={criteriaLoading}
            rowActions={(row) => (
              <RowActions items={[
                { id: 'edit', label: t('common.edit', 'Edit'), onSelect: () => { window.location.href = `/backend/judging/criteria/${row.id}/edit` } },
                { id: 'delete', label: t('common.delete', 'Delete'), destructive: true, onSelect: async () => {
                  const ok = await confirm({ title: t('judging.criteria.confirmDelete', 'Delete this criterion?'), variant: 'destructive' })
                  if (!ok) return
                  await deleteCrud('judging/criteria', row.id)
                  flash(t('judging.flash.criterionDeleted', 'Criterion deleted'), 'success')
                  queryClient.invalidateQueries({ queryKey: ['judging-criteria'] })
                }},
              ]} />
            )}
          />
          {showCopyDialog && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={() => setShowCopyDialog(false)}>
              <div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
                <h3 className="mb-4 text-lg font-semibold">{t('judging.criteria.copyTitle', 'Copy Criteria to Another Track')}</h3>
                <div className="space-y-3">
                  <div>
                    <label className="mb-1 block text-sm font-medium">{t('judging.fields.competition', 'Competition')}</label>
                    <select value={copyCompetitionId} onChange={(e) => setCopyCompetitionId(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                      <option value="">Select...</option>
                      {(competitionsData?.items ?? []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">{t('judging.criteria.sourceTrack', 'Source Track')}</label>
                    <select value={copySourceTrack} onChange={(e) => setCopySourceTrack(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                      <option value="">Global (all tracks)</option>
                      {(tracksData?.items ?? []).map(tr => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium">{t('judging.criteria.targetTrack', 'Target Track')}</label>
                    <select value={copyTargetTrack} onChange={(e) => setCopyTargetTrack(e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                      <option value="">Select...</option>
                      {(tracksData?.items ?? []).map(tr => <option key={tr.id} value={tr.id}>{tr.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setShowCopyDialog(false)}>Cancel</Button>
                  <Button onClick={handleCopyCriteria} disabled={copying || !copyCompetitionId || !copyTargetTrack}>
                    {copying ? 'Copying...' : 'Copy'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'demos' && (
        <>
          <div className="flex items-center gap-3 mb-4">
            <select
              value={selectedCompetitionId}
              onChange={(e) => setSelectedCompetitionId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Select competition...</option>
              {(competitionsData?.items ?? []).map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.stage})</option>
              ))}
            </select>
            <Button onClick={handleGenerateQueue} variant="outline" disabled={!selectedCompetitionId}>{t('judging.demos.generateQueue', 'Generate Queue')}</Button>
          </div>
          <DataTable title={t('judging.demos.title', 'Demo Sessions')}
            columns={demoColumns} data={demosData?.items ?? []}
            isLoading={demosLoading}
            rowActions={(row) => {
              const nextStatus = row.status === 'queued' ? 'on_deck' : row.status === 'on_deck' ? 'presenting' : row.status === 'presenting' ? 'qa' : row.status === 'qa' ? 'completed' : null
              return nextStatus ? (
                <RowActions items={[
                  { label: `→ ${nextStatus.replace('_', ' ')}`, onSelect: () => handleAdvanceDemo(row.id, nextStatus) },
                  { label: t('judging.demos.skip', 'Skip'), destructive: true, onSelect: () => handleAdvanceDemo(row.id, 'skipped') },
                ]} />
              ) : null
            }}
          />
        </>
      )}

      {tab === 'scores' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('judging.scores.title', 'Scoring Progress')}</h3>
          {scoresLoading ? <div className="text-muted-foreground">{t('common.loading', 'Loading...')}</div> : (
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-2 text-left">{t('judging.scores.project', 'Project')}</th>
                    <th className="p-2 text-left">{t('judging.scores.judge', 'Judge')}</th>
                    <th className="p-2 text-center">{t('judging.scores.status', 'Status')}</th>
                    <th className="p-2 text-right">{t('judging.scores.score', 'Score')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(scoresData?.items ?? []).map((s, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="p-2">{s.project_id.substring(0, 8)}...</td>
                      <td className="p-2">{s.judge_id.substring(0, 8)}...</td>
                      <td className="p-2 text-center">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${s.is_submitted ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                          {s.is_submitted ? 'Submitted' : 'Draft'}
                        </span>
                      </td>
                      <td className="p-2 text-right">{s.total_score != null ? s.total_score.toFixed(1) : '—'}</td>
                    </tr>
                  ))}
                  {(scoresData?.items ?? []).length === 0 && (
                    <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">{t('judging.scores.empty', 'No scores submitted yet')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'leaderboard' && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold">{t('judging.leaderboard.title', 'Leaderboard')}</h3>
          {leaderboardLoading ? <div className="text-muted-foreground">{t('common.loading', 'Loading...')}</div> : (
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="p-2 text-center w-12">#</th>
                    <th className="p-2 text-left">{t('judging.leaderboard.project', 'Project')}</th>
                    <th className="p-2 text-left">{t('judging.leaderboard.team', 'Team')}</th>
                    <th className="p-2 text-right">{t('judging.leaderboard.score', 'Avg Score')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(leaderboardData?.items ?? []).map((entry, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="p-2 text-center font-mono">{entry.rank ?? i + 1}</td>
                      <td className="p-2 font-medium">{entry.project_title}</td>
                      <td className="p-2">{entry.team_name}</td>
                      <td className="p-2 text-right font-mono">{entry.average_score != null ? entry.average_score.toFixed(1) : '—'}</td>
                    </tr>
                  ))}
                  {(leaderboardData?.items ?? []).length === 0 && (
                    <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">{t('judging.leaderboard.empty', 'No scores available yet')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {ConfirmDialogElement}
    </div>
  )
}

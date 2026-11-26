"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { EnumBadge } from '@open-mercato/ui/backend/ValueIcons'
import { Button } from '@open-mercato/ui/primitives/button'
import { Input } from '@open-mercato/ui/primitives/input'
import { fetchCrudList, deleteCrud, updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useCompetitionScope } from '@/lib/competition-scope'
import { useRouter } from 'next/navigation'
import { FileSpreadsheet } from 'lucide-react'
import { downloadCompetitionAttachments } from '../lib/downloadCompetitionAttachments'
import { downloadProjectsExport, fetchAllMatchingProjectIds } from '../lib/downloadProjectsExport'
import { ProjectsInlineFilters, toListQueryParams, type ProjectListFilters } from './ProjectsInlineFilters'

type ProjectRow = {
  id: string
  title: string
  team_id: string
  track_id: string
  competition_id: string
  status: string
  flagged_for_reuse: boolean
  flagged_reason: string | null
  submitted_at: string | null
  final_score: number | null
  created_at: string
  _projects?: { teamName: string | null; trackName: string | null; trackColor: string | null }
  _gallery?: { optedIn: boolean; status: string; prUrl: string | null; liveUrl: string | null }
}

type ListResponse = {
  items: ProjectRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const galleryStatusPreset: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  // Opted in on a draft: nothing has been requested from organizers yet
  not_requested: { label: 'Opted in', variant: 'outline' },
  requested: { label: 'Requested', variant: 'secondary' },
  pr_open: { label: 'PR open', variant: 'outline' },
  published: { label: 'Live', variant: 'default' },
  rejected: { label: 'Not accepted', variant: 'destructive' },
}

const statusPreset: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  published: { label: 'Published', variant: 'default' },
  under_review: { label: 'Under Review', variant: 'outline' },
  scored: { label: 'Scored', variant: 'default' },
}

export default function ProjectsTable() {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'title', desc: false }])
  const [page, setPage] = React.useState(1)
  const [searchValue, setSearchValue] = React.useState('')
  const [filterValues, setFilterValues] = React.useState<ProjectListFilters>({})
  const [flagProjectId, setFlagProjectId] = React.useState<string | null>(null)
  const [flagReason, setFlagReason] = React.useState('')
  const [flagging, setFlagging] = React.useState(false)
  const [exportingAttachments, setExportingAttachments] = React.useState(false)
  const [exportingAll, setExportingAll] = React.useState(false)
  const scopeVersion = useOrganizationScopeVersion()
  const { competitionId: scopedCompetitionId, ready: scopeReady } = useCompetitionScope()

  const applyFilters = React.useCallback((next: ProjectListFilters) => {
    setFilterValues(next)
    setPage(1)
  }, [])

  // Everything that narrows the list except paging — shared by the table and "export filtered".
  const filterParams = React.useMemo(() => {
    const params: Record<string, string> = {
      sortField: sorting[0]?.id || 'title',
      sortDir: sorting[0]?.desc ? 'desc' : 'asc',
      ...toListQueryParams(filterValues),
    }
    if (searchValue) params.title = searchValue
    // Global header scope wins over the per-page filter, which is hidden while scoped.
    if (scopedCompetitionId) params.competition_id = scopedCompetitionId
    return params
  }, [filterValues, searchValue, sorting, scopedCompetitionId])

  const queryParams = React.useMemo(
    () => new URLSearchParams({ ...filterParams, page: page.toString(), pageSize: '50' }).toString(),
    [filterParams, page],
  )

  const { data, isLoading, error } = useQuery<ListResponse>({
    queryKey: ['projects', queryParams, scopeVersion],
    queryFn: () => fetchCrudList<ProjectRow>('projects/projects', Object.fromEntries(new URLSearchParams(queryParams))),
    enabled: scopeReady,
  })

  const { data: competitionsData } = useQuery({
    queryKey: ['projects-competitions', scopeVersion],
    queryFn: async () => {
      const response = await fetchCrudList<{ id: string; name: string }>('competitions/competitions', { pageSize: '100' })
      return response?.items ?? []
    },
  })

  const competitionOptions = React.useMemo(
    () => (competitionsData ?? []).map((competition) => ({ value: competition.id, label: competition.name })),
    [competitionsData],
  )
  const selectedCompetitionId = scopedCompetitionId ?? filterValues.competition_id ?? null

  const { data: tracksData } = useQuery({
    queryKey: ['projects-tracks', selectedCompetitionId, scopeVersion],
    queryFn: async () => {
      const params: Record<string, string> = { pageSize: '100', sortField: 'name', sortDir: 'asc' }
      if (selectedCompetitionId) params.competition_id = selectedCompetitionId
      const response = await fetchCrudList<{ id: string; name: string; color: string | null; competition_id: string }>('tracks/tracks', params)
      return response?.items ?? []
    },
    enabled: scopeReady,
  })

  const trackOptions = React.useMemo(() => {
    const competitionNames = new Map((competitionsData ?? []).map((competition) => [competition.id, competition.name]))
    const tracks = tracksData ?? []
    // Without a competition the same track name can repeat across events: disambiguate.
    return tracks.map((track) => ({
      value: track.id,
      color: track.color,
      label: !selectedCompetitionId && competitionNames.get(track.competition_id)
        ? `${track.name} · ${competitionNames.get(track.competition_id)}`
        : track.name,
    }))
  }, [tracksData, competitionsData, selectedCompetitionId])

  // A track picked under another competition would silently empty the table: drop it.
  React.useEffect(() => {
    if (!filterValues.track_id || !tracksData) return
    if (!tracksData.some((track) => track.id === filterValues.track_id)) {
      applyFilters({ ...filterValues, track_id: undefined })
    }
  }, [tracksData, filterValues, applyFilters])

  async function runExport(ids: string[]): Promise<boolean> {
    if (ids.length === 0) {
      flash(t('projects.exportXlsx.empty', 'No projects to export'), 'error')
      return false
    }
    try {
      await downloadProjectsExport(ids)
      flash(t('projects.exportXlsx.done', 'Exported {count} projects to Excel', { count: ids.length }), 'success')
      return true
    } catch (err) {
      flash(err instanceof Error ? err.message : t('projects.exportXlsx.error', 'Failed to export projects'), 'error')
      return false
    }
  }

  async function handleExportFiltered() {
    setExportingAll(true)
    try {
      const ids = await fetchAllMatchingProjectIds(filterParams)
      await runExport(ids)
    } catch (err) {
      flash(err instanceof Error ? err.message : t('projects.exportXlsx.error', 'Failed to export projects'), 'error')
    } finally {
      setExportingAll(false)
    }
  }

  // Compute submission progress
  const totalProjects = data?.total ?? 0
  const submittedCount = data?.items?.filter(p => p.status !== 'draft').length ?? 0

  async function handleFlag() {
    if (!flagProjectId || !flagReason.trim()) return
    setFlagging(true)
    try {
      await updateCrud('projects/projects', { id: flagProjectId, flagged_for_reuse: true, flagged_reason: flagReason.trim() })
      flash(t('projects.flash.flagged', 'Project flagged for code reuse'), 'success')
      queryClient.invalidateQueries({ queryKey: ['projects'] })
      setFlagProjectId(null)
      setFlagReason('')
    } catch (err) {
      flash(err instanceof Error ? err.message : t('projects.table.error', 'Error'), 'error')
    } finally {
      setFlagging(false)
    }
  }

  async function handleUnflag(id: string) {
    try {
      await updateCrud('projects/projects', { id, flagged_for_reuse: false, flagged_reason: null })
      flash(t('projects.flash.unflagged', 'Flag removed'), 'success')
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    } catch (err) {
      flash(err instanceof Error ? err.message : t('projects.table.error', 'Error'), 'error')
    }
  }

  async function handleUnpublish(id: string) {
    const confirmed = await confirm({
      title: t('projects.table.confirmUnpublish', 'Unpublish this project?'),
      text: t('projects.table.confirmUnpublishDesc', 'This will revert the project to Draft status. The team will need to re-submit.'),
      variant: 'destructive',
    })
    if (!confirmed) return
    try {
      await updateCrud('projects/projects', { id, status: 'draft', submitted_at: null })
      flash(t('projects.flash.unpublished', 'Project unpublished — reverted to Draft'), 'success')
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    } catch (err) {
      flash(err instanceof Error ? err.message : t('projects.table.error', 'Error'), 'error')
    }
  }

  async function handleExportAttachments() {
    if (!selectedCompetitionId) return
    setExportingAttachments(true)
    try {
      await downloadCompetitionAttachments(selectedCompetitionId)
      flash(t('projects.export.started', 'Project attachments download started'), 'success')
    } catch (error) {
      flash(
        error instanceof Error ? error.message : t('projects.export.error', 'Failed to export project attachments'),
        'error',
      )
    } finally {
      setExportingAttachments(false)
    }
  }

  const columns = React.useMemo<ColumnDef<ProjectRow>[]>(() => [
    {
      accessorKey: 'title',
      header: t('projects.table.title', 'Title'),
      meta: { priority: 1 },
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span>{row.original.title}</span>
          {row.original.flagged_for_reuse && (
            <span className="inline-flex items-center rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800" title={row.original.flagged_reason ?? ''}>
              Flagged
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'teamName',
      header: t('projects.table.team', 'Team'),
      meta: { priority: 2 },
      cell: ({ row }) => row.original._projects?.teamName ?? row.original.team_id.substring(0, 8) + '...',
    },
    {
      id: 'trackName',
      header: t('projects.table.track', 'Track'),
      meta: { priority: 3 },
      cell: ({ row }) => {
        const track = row.original._projects
        if (!track?.trackName) return '—'
        return (
          <span className="inline-flex items-center gap-1">
            {track.trackColor && <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ backgroundColor: track.trackColor }} />}
            {track.trackName}
          </span>
        )
      },
    },
    {
      accessorKey: 'status',
      header: t('projects.table.status', 'Status'),
      meta: { priority: 2 },
      cell: ({ getValue }) => {
        const val = String(getValue())
        return <EnumBadge value={val} map={statusPreset} />
      },
    },
    {
      id: 'gallery',
      header: t('projects.table.gallery', 'Gallery'),
      enableSorting: false,
      meta: { priority: 5 },
      cell: ({ row }) => {
        const gallery = row.original._gallery
        if (!gallery?.optedIn && (!gallery || gallery.status === 'not_requested')) return '—'
        return <EnumBadge value={gallery.status} map={galleryStatusPreset} />
      },
    },
    {
      accessorKey: 'submitted_at',
      header: t('projects.table.submittedAt', 'Submitted'),
      meta: { priority: 4 },
      cell: ({ getValue }) => {
        const v = getValue()
        return v ? new Date(v as string).toLocaleDateString() : '—'
      },
    },
  ], [t])

  if (error) {
    return <div className="text-sm text-destructive">{t('projects.table.error', 'Failed to load projects')}</div>
  }

  return (
    <>
      {/* Submission progress tracker */}
      {totalProjects > 0 && (
        <div className="mb-4 rounded-lg border bg-muted/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">{t('projects.progress.title', 'Submission Progress')}</span>
            <span className="text-sm text-muted-foreground">{submittedCount} / {totalProjects} {t('projects.progress.submitted', 'submitted')}</span>
          </div>
          <div className="h-2 rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary transition-all"
              style={{ width: totalProjects ? `${(submittedCount / totalProjects) * 100}%` : '0%' }}
            />
          </div>
        </div>
      )}

      {/* Flag dialog */}
      {flagProjectId && (
        <div className="mb-4 rounded-lg border border-orange-500/50 bg-orange-50 p-4">
          <h3 className="text-sm font-medium text-orange-800 mb-2">
            {t('projects.table.confirmFlag', 'Flag this project for code reuse?')}
          </h3>
          <Input
            value={flagReason}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFlagReason(e.target.value)}
            placeholder={t('projects.table.flagReasonPlaceholder', 'Reason for flagging...')}
            className="mb-2"
            autoFocus
            onKeyDown={(e: React.KeyboardEvent) => { if (e.key === 'Enter') handleFlag(); if (e.key === 'Escape') setFlagProjectId(null) }}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={handleFlag} disabled={flagging || !flagReason.trim()}>
              {flagging ? t('common.saving', 'Saving...') : t('projects.table.flag', 'Flag')}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setFlagProjectId(null); setFlagReason('') }}>
              {t('common.cancel', 'Cancel')}
            </Button>
          </div>
        </div>
      )}

      <DataTable
        title={t('projects.table.title', 'Projects')}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleExportFiltered}
              disabled={exportingAll || !data?.total}
              title={t('projects.exportXlsx.filteredHint', 'Export every project matching the current filters')}
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0" aria-hidden="true" />
              {exportingAll
                ? t('projects.exportXlsx.exporting', 'Preparing Excel...')
                : t('projects.exportXlsx.filtered', 'Export to Excel ({count})', { count: data?.total ?? 0 })}
            </Button>
            {selectedCompetitionId ? (
              <Button
                type="button"
                variant="outline"
                onClick={handleExportAttachments}
                disabled={exportingAttachments}
              >
                {exportingAttachments
                  ? t('projects.export.exporting', 'Preparing archive...')
                  : t('projects.export.action', 'Download Competition Attachments')}
              </Button>
            ) : null}
          </div>
        }
        bulkActions={[
          {
            id: 'export-xlsx',
            label: t('projects.exportXlsx.selected', 'Export selected to Excel'),
            icon: FileSpreadsheet,
            // Returning false keeps the selection so the user can retry.
            onExecute: (rows: ProjectRow[]) => runExport(rows.map((row) => row.id)),
          },
        ]}
        // Changing filters, sorting or page clears a selection the user can no longer see.
        selectionScopeKey={queryParams}
        activeFilterChips={
          <ProjectsInlineFilters
            value={filterValues}
            onChange={applyFilters}
            competitionOptions={competitionOptions}
            trackOptions={trackOptions}
            showCompetition={!scopedCompetitionId}
          />
        }
        columns={columns}
        data={data?.items ?? []}
        searchValue={searchValue}
        onSearchChange={(v) => { setSearchValue(v); setPage(1) }}
        searchAlign="right"
        sortable
        sorting={sorting}
        onSortingChange={(s) => { setSorting(s); setPage(1) }}
        rowActions={(row) => (
          <RowActions
            items={[
              { id: 'edit', label: t('projects.table.edit', 'Edit'), href: `/backend/projects/${row.id}/edit` },
              ...(row.status === 'published'
                ? [{
                    id: 'unpublish',
                    label: t('projects.table.unpublish', 'Unpublish (revert to Draft)'),
                    destructive: true as const,
                    onSelect: () => handleUnpublish(row.id),
                  }]
                : []
              ),
              ...(row.flagged_for_reuse
                ? [{
                    id: 'unflag',
                    label: t('projects.table.unflag', 'Remove Flag'),
                    onSelect: () => handleUnflag(row.id),
                  }]
                : [{
                    id: 'flag',
                    label: t('projects.table.flag', 'Flag for Reuse'),
                    destructive: true as const,
                    onSelect: () => { setFlagProjectId(row.id); setFlagReason('') },
                  }]
              ),
              {
                id: 'delete',
                label: t('projects.table.delete', 'Delete'),
                destructive: true,
                onSelect: async () => {
                  const confirmed = await confirm({
                    title: t('projects.table.confirmDelete', 'Delete this project?'),
                    variant: 'destructive',
                  })
                  if (!confirmed) return
                  try {
                    await deleteCrud('projects/projects', row.id)
                    flash(t('projects.flash.deleted', 'Project deleted'), 'success')
                    queryClient.invalidateQueries({ queryKey: ['projects'] })
                  } catch (err) {
                    flash(err instanceof Error ? err.message : t('projects.table.error', 'Error'), 'error')
                  }
                },
              },
            ]}
          />
        )}
        pagination={{
          page,
          pageSize: 50,
          total: data?.total || 0,
          totalPages: data?.totalPages || 0,
          onPageChange: setPage,
        }}
        isLoading={isLoading || !scopeReady}
        onRowClick={(row) => router.push(`/backend/projects/${row.id}/edit`)}
      />
      {ConfirmDialogElement}
    </>
  )
}

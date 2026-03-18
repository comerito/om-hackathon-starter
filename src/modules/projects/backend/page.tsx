"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { fetchCrudList, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useRouter, useSearchParams } from 'next/navigation'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

type ProjectRow = {
  id: string
  team_id: string
  competition_id: string
  track_id: string
  title: string
  tagline: string | null
  status: string
  flagged_for_reuse: boolean
  flagged_reason: string | null
  submitted_at: string | null
  final_score: number | null
  rank: number | null
  is_active: boolean
  created_at: string
  updated_at: string
  team_name?: string | null
  track_name?: string | null
}

type ProjectsResponse = {
  items: ProjectRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  PUBLISHED: 'bg-green-100 text-green-800',
  UNDER_REVIEW: 'bg-yellow-100 text-yellow-800',
  SCORED: 'bg-blue-100 text-blue-800',
}

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}>
      {status}
    </span>
  )
}

function buildColumns(t: (key: string, fallback?: string) => string): ColumnDef<ProjectRow>[] {
  return [
    {
      accessorKey: 'title',
      header: t('projects.table.column.title', 'Title'),
      meta: { priority: 1 },
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.original.title}</span>
          {row.original.flagged_for_reuse && (
            <span className="inline-flex items-center rounded-full bg-red-100 text-red-800 px-1.5 py-0.5 text-[10px] font-medium">
              Flagged
            </span>
          )}
        </div>
      ),
    },
    {
      id: 'team',
      header: t('projects.table.column.team', 'Team'),
      meta: { priority: 2 },
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.team_name ?? row.original.team_id.slice(0, 8) + '...'}
        </span>
      ),
    },
    {
      id: 'track',
      header: t('projects.table.column.track', 'Track'),
      meta: { priority: 3 },
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.track_name ?? row.original.track_id.slice(0, 8) + '...'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: t('projects.table.column.status', 'Status'),
      meta: { priority: 4 },
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    {
      accessorKey: 'flagged_for_reuse',
      header: t('projects.table.column.flagged', 'Flagged'),
      meta: { priority: 5 },
      cell: ({ getValue }) => {
        const val = getValue() as boolean
        return val
          ? <span className="text-red-600 text-xs font-medium">Yes</span>
          : <span className="text-muted-foreground text-xs">No</span>
      },
    },
    {
      accessorKey: 'submitted_at',
      header: t('projects.table.column.submittedAt', 'Submitted'),
      meta: { priority: 6 },
      cell: ({ getValue }) => {
        const val = getValue() as string | null
        if (!val) return <span className="text-muted-foreground">-</span>
        return new Date(val).toLocaleDateString()
      },
    },
  ]
}

export default function ProjectsPage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'title', desc: false }])
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<string>('')
  const [flaggedFilter, setFlaggedFilter] = React.useState<string>('')
  const scopeVersion = useOrganizationScopeVersion()

  const competitionId = searchParams.get('competitionId') ?? ''

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: '50',
      sortField: sorting[0]?.id || 'title',
      sortDir: sorting[0]?.desc ? 'desc' : 'asc',
    })
    if (competitionId) params.set('competitionId', competitionId)
    if (search) params.set('title', search)
    if (statusFilter) params.set('status', statusFilter)
    if (flaggedFilter) params.set('flaggedForReuse', flaggedFilter)
    return params.toString()
  }, [page, sorting, search, competitionId, statusFilter, flaggedFilter])

  const columns = React.useMemo(() => buildColumns(t), [t])

  const { data, isLoading, error } = useQuery<ProjectsResponse>({
    queryKey: ['projects', queryParams, scopeVersion],
    queryFn: async () => fetchCrudList<ProjectRow>('projects/projects', Object.fromEntries(new URLSearchParams(queryParams))),
    enabled: !!competitionId,
  })

  const handleSortingChange = (newSorting: SortingState) => {
    setSorting(newSorting)
    setPage(1)
  }

  const handleFlag = React.useCallback(async (row: ProjectRow) => {
    const reason = window.prompt(t('projects.table.prompt.flagReason', 'Reason for flagging:'))
    if (!reason) return
    try {
      await apiCall('/api/projects/projects/flag', {
        method: 'POST',
        body: JSON.stringify({ projectId: row.id, reason }),
      })
      flash(t('projects.flash.flagged', 'Project flagged'), 'success')
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    } catch (err) {
      const message = err instanceof Error ? err.message : t('projects.table.error.flag', 'Failed to flag project')
      flash(message, 'error')
    }
  }, [t, queryClient])

  const handleUnflag = React.useCallback(async (row: ProjectRow) => {
    try {
      await apiCall('/api/projects/projects/unflag', {
        method: 'POST',
        body: JSON.stringify({ projectId: row.id }),
      })
      flash(t('projects.flash.unflagged', 'Flag removed'), 'success')
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    } catch (err) {
      const message = err instanceof Error ? err.message : t('projects.table.error.unflag', 'Failed to remove flag')
      flash(message, 'error')
    }
  }, [t, queryClient])

  if (!competitionId) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">{t('projects.table.title', 'Projects')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('projects.table.selectCompetition', 'Please select a competition to view its projects.')}
        </p>
      </div>
    )
  }

  if (error) {
    return <div className="text-sm text-destructive">{t('projects.table.error.generic', 'Failed to load projects')}</div>
  }

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('projects.table.title', 'Projects')}
          actions={(
            <div className="flex items-center gap-2">
              <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">{t('projects.table.filter.allStatuses', 'All statuses')}</option>
              <option value="DRAFT">{t('projects.table.filter.draft', 'Draft')}</option>
              <option value="PUBLISHED">{t('projects.table.filter.published', 'Published')}</option>
              <option value="UNDER_REVIEW">{t('projects.table.filter.underReview', 'Under Review')}</option>
              <option value="SCORED">{t('projects.table.filter.scored', 'Scored')}</option>
            </select>
            <select
              value={flaggedFilter}
              onChange={(e) => { setFlaggedFilter(e.target.value); setPage(1) }}
              className="rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">{t('projects.table.filter.allFlags', 'All')}</option>
              <option value="true">{t('projects.table.filter.flaggedOnly', 'Flagged only')}</option>
              <option value="false">{t('projects.table.filter.unflaggedOnly', 'Unflagged only')}</option>
            </select>
          </div>
        )}
        columns={columns}
        data={data?.items ?? []}
        searchValue={search}
        onSearchChange={(v) => {
          setSearch(v)
          setPage(1)
        }}
        searchAlign="right"
        sortable
        sorting={sorting}
        onSortingChange={handleSortingChange}
        rowActions={(row) => (
          <RowActions
            items={[
              {
                label: t('projects.table.actions.view', 'View details'),
                href: `/backend/projects/${row.id}`,
              },
              ...(!row.flagged_for_reuse
                ? [{
                    label: t('projects.table.actions.flag', 'Flag for reuse'),
                    destructive: true,
                    onSelect: () => handleFlag(row),
                  }]
                : [{
                    label: t('projects.table.actions.unflag', 'Remove flag'),
                    onSelect: () => handleUnflag(row),
                  }]),
              {
                label: t('projects.table.actions.delete', 'Delete'),
                destructive: true,
                onSelect: async () => {
                  const confirmed = await confirm({
                    title: t('projects.table.confirm.delete', 'Delete this project?'),
                    variant: 'destructive',
                  })
                  if (!confirmed) return
                  try {
                    await deleteCrud('projects/projects', row.id)
                    flash(t('projects.flash.deleted', 'Project deleted'), 'success')
                    queryClient.invalidateQueries({ queryKey: ['projects'] })
                  } catch (err) {
                    const message =
                      err instanceof Error && err.message
                        ? err.message
                        : t('projects.table.error.delete', 'Failed to delete project')
                    flash(message, 'error')
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
        isLoading={isLoading}
        onRowClick={(row) => router.push(`/backend/projects/${row.id}`)}
        />
        {ConfirmDialogElement}
      </PageBody>
    </Page>
  )
}

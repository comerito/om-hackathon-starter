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

type TeamRow = {
  id: string
  competition_id: string
  track_id: string | null
  name: string
  description?: string | null
  avatar_url?: string | null
  status: string
  is_finalist: boolean
  table_number?: number | null
  table_location?: string | null
  presentation_order?: number | null
  is_active?: boolean
  created_at?: string | null
  updated_at?: string | null
  member_count?: number
}

type TeamsResponse = {
  items: TeamRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  DISQUALIFIED: 'bg-red-100 text-red-800',
  WITHDRAWN: 'bg-gray-100 text-gray-800',
}

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}>
      {status}
    </span>
  )
}

function buildColumns(t: (key: string, fallback?: string) => string): ColumnDef<TeamRow>[] {
  return [
    {
      accessorKey: 'name',
      header: t('teams.table.column.name', 'Name'),
      meta: { priority: 1 },
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.original.name}</span>
          {row.original.is_finalist && (
            <span className="inline-flex items-center rounded-full bg-yellow-100 text-yellow-800 px-1.5 py-0.5 text-[10px] font-medium">
              Finalist
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: t('teams.table.column.status', 'Status'),
      meta: { priority: 2 },
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    {
      id: 'member_count',
      header: t('teams.table.column.members', 'Members'),
      meta: { priority: 3 },
      cell: () => <span className="text-muted-foreground">-</span>,
    },
    {
      id: 'track',
      header: t('teams.table.column.track', 'Track'),
      meta: { priority: 4 },
      cell: ({ row }) => {
        if (!row.original.track_id) return <span className="text-muted-foreground">-</span>
        return <span className="text-xs">{row.original.track_id.slice(0, 8)}...</span>
      },
    },
    {
      accessorKey: 'table_number',
      header: t('teams.table.column.table', 'Table'),
      meta: { priority: 5 },
      cell: ({ getValue }) => {
        const val = getValue() as number | null
        return val != null ? `#${val}` : <span className="text-muted-foreground">-</span>
      },
    },
    {
      accessorKey: 'created_at',
      header: t('teams.table.column.createdAt', 'Created'),
      meta: { priority: 6 },
      cell: ({ getValue }) => {
        const val = getValue() as string | null
        if (!val) return '-'
        return new Date(val).toLocaleDateString()
      },
    },
  ]
}

export default function TeamsPage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'name', desc: false }])
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<string>('')
  const scopeVersion = useOrganizationScopeVersion()

  const competitionId = searchParams.get('competitionId') ?? ''

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: '50',
      sortField: sorting[0]?.id || 'name',
      sortDir: sorting[0]?.desc ? 'desc' : 'asc',
    })
    if (competitionId) params.set('competitionId', competitionId)
    if (search) params.set('name', search)
    if (statusFilter) params.set('status', statusFilter)
    return params.toString()
  }, [page, sorting, search, competitionId, statusFilter])

  const columns = React.useMemo(() => buildColumns(t), [t])

  const { data, isLoading, error } = useQuery<TeamsResponse>({
    queryKey: ['teams', queryParams, scopeVersion],
    queryFn: async () => fetchCrudList<TeamRow>('teams/teams', Object.fromEntries(new URLSearchParams(queryParams))),
    enabled: !!competitionId,
  })

  const handleSortingChange = (newSorting: SortingState) => {
    setSorting(newSorting)
    setPage(1)
  }

  const handleDisqualify = React.useCallback(async (row: TeamRow) => {
    const reason = window.prompt(t('teams.table.prompt.disqualifyReason', 'Reason for disqualification:'))
    if (!reason) return
    try {
      await apiCall('/api/teams/teams/disqualify', {
        method: 'POST',
        body: JSON.stringify({ teamId: row.id, reason }),
      })
      flash(t('teams.flash.disqualified', 'Team disqualified'), 'success')
      queryClient.invalidateQueries({ queryKey: ['teams'] })
    } catch (err) {
      const message = err instanceof Error ? err.message : t('teams.table.error.disqualify', 'Failed to disqualify team')
      flash(message, 'error')
    }
  }, [t, queryClient])

  const handleReactivate = React.useCallback(async (row: TeamRow) => {
    try {
      await apiCall('/api/teams/teams/reactivate', {
        method: 'POST',
        body: JSON.stringify({ teamId: row.id }),
      })
      flash(t('teams.flash.reactivated', 'Team reactivated'), 'success')
      queryClient.invalidateQueries({ queryKey: ['teams'] })
    } catch (err) {
      const message = err instanceof Error ? err.message : t('teams.table.error.reactivate', 'Failed to reactivate team')
      flash(message, 'error')
    }
  }, [t, queryClient])

  if (!competitionId) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">{t('teams.table.title', 'Teams')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('teams.table.selectCompetition', 'Please select a competition to view its teams.')}
        </p>
      </div>
    )
  }

  if (error) {
    return <div className="text-sm text-destructive">{t('teams.table.error.generic', 'Failed to load teams')}</div>
  }

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('teams.table.title', 'Teams')}
          actions={(
            <div className="flex items-center gap-2">
              <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">{t('teams.table.filter.allStatuses', 'All statuses')}</option>
              <option value="ACTIVE">{t('teams.table.filter.active', 'Active')}</option>
              <option value="DISQUALIFIED">{t('teams.table.filter.disqualified', 'Disqualified')}</option>
              <option value="WITHDRAWN">{t('teams.table.filter.withdrawn', 'Withdrawn')}</option>
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
                label: t('teams.table.actions.view', 'View details'),
                href: `/backend/teams/${row.id}`,
              },
              ...(row.status === 'ACTIVE'
                ? [{
                    label: t('teams.table.actions.disqualify', 'Disqualify'),
                    destructive: true,
                    onSelect: () => handleDisqualify(row),
                  }]
                : []),
              ...(row.status !== 'ACTIVE'
                ? [{
                    label: t('teams.table.actions.reactivate', 'Reactivate'),
                    onSelect: () => handleReactivate(row),
                  }]
                : []),
              {
                label: t('teams.table.actions.delete', 'Delete'),
                destructive: true,
                onSelect: async () => {
                  const confirmed = await confirm({
                    title: t('teams.table.confirm.delete', 'Delete this team?'),
                    variant: 'destructive',
                  })
                  if (!confirmed) return
                  try {
                    await deleteCrud('teams/teams', row.id)
                    flash(t('teams.flash.deleted', 'Team deleted'), 'success')
                    queryClient.invalidateQueries({ queryKey: ['teams'] })
                  } catch (err) {
                    const message =
                      err instanceof Error && err.message
                        ? err.message
                        : t('teams.table.error.delete', 'Failed to delete team')
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
        onRowClick={(row) => router.push(`/backend/teams/${row.id}`)}
        />
        {ConfirmDialogElement}
      </PageBody>
    </Page>
  )
}

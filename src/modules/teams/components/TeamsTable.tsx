"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { EnumBadge } from '@open-mercato/ui/backend/ValueIcons'
import { Button } from '@open-mercato/ui/primitives/button'
import { fetchCrudList, deleteCrud, updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type TeamRow = {
  id: string
  name: string
  competition_id: string
  track_id: string | null
  status: string
  is_finalist: boolean
  created_at: string
}

type ListResponse = {
  items: TeamRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const statusPreset: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Active', variant: 'default' },
  disqualified: { label: 'Disqualified', variant: 'destructive' },
  withdrawn: { label: 'Withdrawn', variant: 'secondary' },
}

export default function TeamsTable() {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'name', desc: false }])
  const [page, setPage] = React.useState(1)
  const [searchValue, setSearchValue] = React.useState('')
  const scopeVersion = useOrganizationScopeVersion()

  const queryParams = React.useMemo(() => {
    const params: Record<string, string> = {
      page: page.toString(),
      pageSize: '50',
      sortField: sorting[0]?.id || 'name',
      sortDir: sorting[0]?.desc ? 'desc' : 'asc',
    }
    if (searchValue) params.name = searchValue
    return new URLSearchParams(params).toString()
  }, [page, sorting, searchValue])

  const { data, isLoading, error } = useQuery<ListResponse>({
    queryKey: ['teams', queryParams, scopeVersion],
    queryFn: () => fetchCrudList<TeamRow>('teams/teams', Object.fromEntries(new URLSearchParams(queryParams))),
  })

  const columns = React.useMemo<ColumnDef<TeamRow>[]>(() => [
    { accessorKey: 'name', header: t('teams.table.name', 'Name'), meta: { priority: 1 } },
    {
      accessorKey: 'track_id',
      header: t('teams.table.track', 'Track'),
      meta: { priority: 3 },
      cell: ({ getValue }) => {
        const val = getValue() as string | null
        return val ? val.substring(0, 8) + '...' : '\u2014'
      },
    },
    {
      accessorKey: 'status',
      header: t('teams.table.status', 'Status'),
      meta: { priority: 2 },
      cell: ({ getValue }) => {
        const val = String(getValue())
        return <EnumBadge value={val} map={statusPreset} />
      },
    },
    {
      accessorKey: 'created_at',
      header: t('teams.table.createdAt', 'Created'),
      meta: { priority: 4 },
      cell: ({ getValue }) => {
        const v = getValue()
        return v ? new Date(v as string).toLocaleDateString() : '\u2014'
      },
    },
  ], [t])

  if (error) {
    return <div className="text-sm text-destructive">{t('teams.table.error', 'Failed to load teams')}</div>
  }

  return (
    <>
      <DataTable
        title={t('teams.table.title', 'Teams')}
        actions={
          <Button asChild>
            <Link href="/backend/teams/create">{t('teams.table.create', 'Create Team')}</Link>
          </Button>
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
              { label: t('teams.table.edit', 'Edit'), href: `/backend/teams/${row.id}/edit` },
              {
                label: t('teams.table.disqualify', 'Disqualify'),
                destructive: true,
                onSelect: async () => {
                  const confirmed = await confirm({
                    title: t('teams.table.confirmDisqualify', 'Disqualify this team?'),
                    text: t('teams.table.disqualifyText', 'This action will mark the team as disqualified.'),
                    variant: 'destructive',
                  })
                  if (!confirmed) return
                  try {
                    await updateCrud('teams/teams', { id: row.id, status: 'disqualified', disqualification_reason: 'Disqualified by admin' })
                    flash(t('teams.flash.disqualified', 'Team disqualified'), 'success')
                    queryClient.invalidateQueries({ queryKey: ['teams'] })
                  } catch (err) {
                    flash(err instanceof Error ? err.message : t('teams.table.error', 'Error'), 'error')
                  }
                },
              },
              {
                label: t('teams.table.delete', 'Delete'),
                destructive: true,
                onSelect: async () => {
                  const confirmed = await confirm({
                    title: t('teams.table.confirmDelete', 'Delete this team?'),
                    variant: 'destructive',
                  })
                  if (!confirmed) return
                  try {
                    await deleteCrud('teams/teams', row.id)
                    flash(t('teams.flash.deleted', 'Team deleted'), 'success')
                    queryClient.invalidateQueries({ queryKey: ['teams'] })
                  } catch (err) {
                    flash(err instanceof Error ? err.message : t('teams.table.error', 'Error'), 'error')
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
        onRowClick={(row) => router.push(`/backend/teams/${row.id}/edit`)}
      />
      {ConfirmDialogElement}
    </>
  )
}

"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { Button } from '@open-mercato/ui/primitives/button'
import { fetchCrudList, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type TrackRow = {
  id: string
  name: string
  competition_id: string
  color: string
  max_teams: number | null
  order: number
  is_active: boolean
  created_at: string
}

type ListResponse = {
  items: TrackRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export default function TracksTable() {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'sort_order', desc: false }])
  const [page, setPage] = React.useState(1)
  const [searchValue, setSearchValue] = React.useState('')
  const scopeVersion = useOrganizationScopeVersion()

  const queryParams = React.useMemo(() => {
    const params: Record<string, string> = {
      page: page.toString(),
      pageSize: '50',
      sortField: sorting[0]?.id || 'sort_order',
      sortDir: sorting[0]?.desc ? 'desc' : 'asc',
    }
    if (searchValue) params.name = searchValue
    return new URLSearchParams(params).toString()
  }, [page, sorting, searchValue])

  const { data, isLoading, error } = useQuery<ListResponse>({
    queryKey: ['tracks', queryParams, scopeVersion],
    queryFn: () => fetchCrudList<TrackRow>('tracks/tracks', Object.fromEntries(new URLSearchParams(queryParams))),
  })

  const columns = React.useMemo<ColumnDef<TrackRow>[]>(() => [
    {
      accessorKey: 'name',
      header: t('tracks.table.name', 'Name'),
      meta: { priority: 1 },
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-3 w-3 rounded-full flex-shrink-0"
            style={{ backgroundColor: row.original.color || '#6366f1' }}
          />
          {row.original.name}
        </span>
      ),
    },
    { accessorKey: 'competition_id', header: t('tracks.table.competition', 'Competition'), meta: { priority: 3 } },
    {
      accessorKey: 'max_teams',
      header: t('tracks.table.maxTeams', 'Max Teams'),
      meta: { priority: 2 },
      cell: ({ getValue }) => {
        const v = getValue()
        return v != null ? String(v) : '\u2014'
      },
    },
    { accessorKey: 'sort_order', header: t('tracks.table.order', 'Order'), meta: { priority: 4 }, accessorFn: (row) => row.order },
  ], [t])

  if (error) {
    return <div className="text-sm text-destructive">{t('tracks.table.error', 'Failed to load tracks')}</div>
  }

  return (
    <>
      <DataTable
        title={t('tracks.table.title', 'Tracks')}
        actions={
          <Button asChild>
            <Link href="/backend/tracks/create">{t('tracks.table.create', 'Create Track')}</Link>
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
              { label: t('tracks.table.edit', 'Edit'), href: `/backend/tracks/${row.id}/edit` },
              {
                label: t('tracks.table.delete', 'Delete'),
                destructive: true,
                onSelect: async () => {
                  const confirmed = await confirm({
                    title: t('tracks.table.confirmDelete', 'Delete this track?'),
                    variant: 'destructive',
                  })
                  if (!confirmed) return
                  try {
                    await deleteCrud('tracks/tracks', row.id)
                    flash(t('tracks.flash.deleted', 'Track deleted'), 'success')
                    queryClient.invalidateQueries({ queryKey: ['tracks'] })
                  } catch (err) {
                    flash(err instanceof Error ? err.message : t('tracks.table.error', 'Error'), 'error')
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
        onRowClick={(row) => router.push(`/backend/tracks/${row.id}/edit`)}
      />
      {ConfirmDialogElement}
    </>
  )
}

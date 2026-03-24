"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { EnumBadge } from '@open-mercato/ui/backend/ValueIcons'
import { Button } from '@open-mercato/ui/primitives/button'
import { fetchCrudList, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type CompetitionRow = {
  id: string
  name: string
  slug: string
  stage: string
  starts_at: string
  ends_at: string
  is_active: boolean
  created_at: string
}

type ListResponse = {
  items: CompetitionRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const stagePreset: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft: { label: 'Draft', variant: 'secondary' },
  open: { label: 'Open', variant: 'default' },
  team_formation: { label: 'Team Formation', variant: 'default' },
  track_selection: { label: 'Track Selection', variant: 'default' },
  hacking: { label: 'Hacking', variant: 'default' },
  demos: { label: 'Demos', variant: 'default' },
  deliberation: { label: 'Deliberation', variant: 'default' },
  finished: { label: 'Finished', variant: 'outline' },
  archived: { label: 'Archived', variant: 'secondary' },
}

export default function CompetitionsTable() {
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
    queryKey: ['competitions', queryParams, scopeVersion],
    queryFn: () => fetchCrudList<CompetitionRow>('competitions/competitions', Object.fromEntries(new URLSearchParams(queryParams))),
  })

  const columns = React.useMemo<ColumnDef<CompetitionRow>[]>(() => [
    { accessorKey: 'name', header: t('competitions.table.name', 'Name'), meta: { priority: 1 } },
    { accessorKey: 'slug', header: t('competitions.table.slug', 'Slug'), meta: { priority: 3 } },
    {
      accessorKey: 'stage',
      header: t('competitions.table.stage', 'Stage'),
      meta: { priority: 2 },
      cell: ({ getValue }) => {
        const val = String(getValue())
        return <EnumBadge value={val} map={stagePreset} />
      },
    },
    {
      accessorKey: 'starts_at',
      header: t('competitions.table.startsAt', 'Starts'),
      meta: { priority: 4 },
      cell: ({ getValue }) => {
        const v = getValue()
        return v ? new Date(v as string).toLocaleDateString() : '—'
      },
    },
  ], [t])

  if (error) {
    return <div className="text-sm text-destructive">{t('competitions.table.error', 'Failed to load competitions')}</div>
  }

  return (
    <>
      <DataTable
        title={t('competitions.table.title', 'Competitions')}
        actions={
          <Button asChild>
            <Link href="/backend/competitions/create">{t('competitions.table.create', 'Create Competition')}</Link>
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
              { label: t('competitions.table.edit', 'Edit'), href: `/backend/competitions/${row.id}/edit` },
              {
                label: t('competitions.table.delete', 'Delete'),
                destructive: true,
                onSelect: async () => {
                  const confirmed = await confirm({
                    title: t('competitions.table.confirmDelete', 'Delete this competition?'),
                    variant: 'destructive',
                  })
                  if (!confirmed) return
                  try {
                    await deleteCrud('competitions/competitions', row.id)
                    flash(t('competitions.flash.deleted', 'Competition deleted'), 'success')
                    queryClient.invalidateQueries({ queryKey: ['competitions'] })
                  } catch (err) {
                    flash(err instanceof Error ? err.message : t('competitions.table.error', 'Error'), 'error')
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
        onRowClick={(row) => router.push(`/backend/competitions/${row.id}/edit`)}
      />
      {ConfirmDialogElement}
    </>
  )
}

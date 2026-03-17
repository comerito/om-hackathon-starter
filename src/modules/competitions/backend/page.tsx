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
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type CompetitionRow = {
  id: string
  name: string
  slug: string
  stage: string
  location?: string | null
  starts_at?: string | null
  ends_at?: string | null
  is_active?: boolean
  created_at?: string | null
}

type CompetitionsResponse = {
  items: CompetitionRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const STAGE_SEVERITY: Record<string, 'info' | 'warning' | 'success' | 'error' | 'neutral'> = {
  DRAFT: 'neutral',
  OPEN: 'info',
  TEAM_FORMATION: 'info',
  TRACK_SELECTION: 'info',
  HACKING: 'warning',
  DEMOS: 'warning',
  DELIBERATION: 'warning',
  FINISHED: 'success',
  ARCHIVED: 'neutral',
}

function buildColumns(t: (key: string, fallback?: string) => string): ColumnDef<CompetitionRow>[] {
  return [
    { accessorKey: 'name', header: t('competitions.table.column.name', 'Name'), meta: { priority: 1 } },
    { accessorKey: 'slug', header: t('competitions.table.column.slug', 'Slug'), meta: { priority: 3 } },
    {
      accessorKey: 'stage',
      header: t('competitions.table.column.stage', 'Stage'),
      meta: { priority: 2 },
      cell: ({ getValue }) => {
        const raw = getValue() as string
        return <EnumBadge value={raw} map={STAGE_SEVERITY} />
      },
    },
    { accessorKey: 'location', header: t('competitions.table.column.location', 'Location'), meta: { priority: 4 } },
    { accessorKey: 'starts_at', header: t('competitions.table.column.startsAt', 'Starts at'), meta: { priority: 5 } },
    { accessorKey: 'ends_at', header: t('competitions.table.column.endsAt', 'Ends at'), meta: { priority: 6 } },
  ]
}

export default function CompetitionsPage() {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'name', desc: false }])
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const scopeVersion = useOrganizationScopeVersion()

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: '50',
      sortField: sorting[0]?.id || 'name',
      sortDir: sorting[0]?.desc ? 'desc' : 'asc',
    })
    if (search) params.set('name', search)
    return params.toString()
  }, [page, sorting, search])

  const columns = React.useMemo(() => buildColumns(t), [t])

  const { data, isLoading, error } = useQuery<CompetitionsResponse>({
    queryKey: ['competitions', queryParams, scopeVersion],
    queryFn: async () => fetchCrudList<CompetitionRow>('competitions/competitions', Object.fromEntries(new URLSearchParams(queryParams))),
  })

  const handleSortingChange = (newSorting: SortingState) => {
    setSorting(newSorting)
    setPage(1)
  }

  if (error) {
    return <div className="text-sm text-destructive">{t('competitions.table.error.generic', 'Failed to load competitions')}</div>
  }

  return (
    <>
      <DataTable
        title={t('competitions.table.title', 'Competitions')}
        actions={(
          <Button asChild>
            <Link href="/backend/competitions/competitions/create">{t('competitions.table.actions.create', 'New competition')}</Link>
          </Button>
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
              { label: t('competitions.table.actions.edit', 'Edit'), href: `/backend/competitions/competitions/${row.id}/edit` },
              {
                label: t('competitions.table.actions.delete', 'Delete'),
                destructive: true,
                onSelect: async () => {
                  const confirmed = await confirm({
                    title: t('competitions.table.confirm.delete', 'Delete this competition?'),
                    variant: 'destructive',
                  })
                  if (!confirmed) return
                  try {
                    await deleteCrud('competitions/competitions', row.id)
                    flash(t('competitions.flash.deleted', 'Competition deleted'), 'success')
                    queryClient.invalidateQueries({ queryKey: ['competitions'] })
                  } catch (err) {
                    const message =
                      err instanceof Error && err.message
                        ? err.message
                        : t('competitions.table.error.delete', 'Failed to delete competition')
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
        onRowClick={(row) => router.push(`/backend/competitions/competitions/${row.id}/edit`)}
      />
      {ConfirmDialogElement}
    </>
  )
}

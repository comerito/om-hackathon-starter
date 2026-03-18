"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { Button } from '@open-mercato/ui/primitives/button'
import { fetchCrudList, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CompetitionPicker } from '../../competitions/components/CompetitionPicker'

type TrackRow = {
  id: string
  competition_id: string
  name: string
  description?: string | null
  color: string
  icon_url?: string | null
  max_teams?: number | null
  order: number
  mentor_ids?: string[]
  is_active?: boolean
  created_at?: string | null
}

type TracksResponse = {
  items: TrackRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

function ColorDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block size-3 rounded-full mr-2 shrink-0"
      style={{ backgroundColor: color }}
    />
  )
}

function buildColumns(t: (key: string, fallback?: string) => string): ColumnDef<TrackRow>[] {
  return [
    {
      accessorKey: 'name',
      header: t('tracks.table.column.name', 'Name'),
      meta: { priority: 1 },
      cell: ({ row }) => (
        <div className="flex items-center">
          <ColorDot color={row.original.color ?? '#6366f1'} />
          <span>{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: 'description',
      header: t('tracks.table.column.description', 'Description'),
      meta: { priority: 3 },
      cell: ({ getValue }) => {
        const val = getValue() as string | null
        if (!val) return <span className="text-muted-foreground">-</span>
        return <span className="truncate max-w-[300px] block">{val}</span>
      },
    },
    {
      accessorKey: 'max_teams',
      header: t('tracks.table.column.maxTeams', 'Max teams'),
      meta: { priority: 4 },
      cell: ({ getValue }) => {
        const val = getValue() as number | null
        return val != null ? String(val) : <span className="text-muted-foreground">Unlimited</span>
      },
    },
    {
      accessorKey: 'order',
      header: t('tracks.table.column.order', 'Order'),
      meta: { priority: 5 },
    },
    {
      id: 'teams_count',
      header: t('tracks.table.column.teamsCount', 'Teams'),
      meta: { priority: 6 },
      cell: () => <span className="text-muted-foreground">0</span>,
    },
  ]
}

export default function TracksPage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'order', desc: false }])
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const scopeVersion = useOrganizationScopeVersion()

  const competitionId = searchParams.get('competitionId') ?? ''

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: '50',
      sortField: sorting[0]?.id || 'order',
      sortDir: sorting[0]?.desc ? 'desc' : 'asc',
    })
    if (competitionId) params.set('competitionId', competitionId)
    if (search) params.set('name', search)
    return params.toString()
  }, [page, sorting, search, competitionId])

  const columns = React.useMemo(() => buildColumns(t), [t])

  const { data, isLoading, error } = useQuery<TracksResponse>({
    queryKey: ['tracks', queryParams, scopeVersion],
    queryFn: async () => fetchCrudList<TrackRow>('tracks/tracks', Object.fromEntries(new URLSearchParams(queryParams))),
    enabled: !!competitionId,
  })

  const handleSortingChange = (newSorting: SortingState) => {
    setSorting(newSorting)
    setPage(1)
  }

  if (!competitionId) {
    return (
      <Page>
        <PageBody>
          <div className="flex flex-col gap-4">
            <h1 className="text-2xl font-bold">{t('tracks.table.title', 'Tracks')}</h1>
            <CompetitionPicker value="" />
            <p className="text-muted-foreground">
              {t('tracks.table.selectCompetition', 'Please select a competition to view its tracks.')}
            </p>
          </div>
        </PageBody>
      </Page>
    )
  }

  if (error) {
    return <div className="text-sm text-destructive">{t('tracks.table.error.generic', 'Failed to load tracks')}</div>
  }

  return (
    <Page>
      <PageBody>
        <div className="mb-4">
          <CompetitionPicker value={competitionId} />
        </div>
        <DataTable
          title={t('tracks.table.title', 'Tracks')}
          actions={(
            <Button asChild>
              <Link href={`/backend/tracks/create?competitionId=${competitionId}`}>
                {t('tracks.table.actions.create', 'New track')}
              </Link>
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
                {
                  label: t('tracks.table.actions.edit', 'Edit'),
                  href: `/backend/tracks/${row.id}/edit`,
                },
                {
                  label: t('tracks.table.actions.delete', 'Delete'),
                  destructive: true,
                  onSelect: async () => {
                    const confirmed = await confirm({
                      title: t('tracks.table.confirm.delete', 'Delete this track?'),
                      variant: 'destructive',
                    })
                    if (!confirmed) return
                    try {
                      await deleteCrud('tracks/tracks', row.id)
                      flash(t('tracks.flash.deleted', 'Track deleted'), 'success')
                      queryClient.invalidateQueries({ queryKey: ['tracks'] })
                    } catch (err) {
                      const message =
                        err instanceof Error && err.message
                          ? err.message
                          : t('tracks.table.error.delete', 'Failed to delete track')
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
          onRowClick={(row) => router.push(`/backend/tracks/${row.id}/edit`)}
        />
        {ConfirmDialogElement}
      </PageBody>
    </Page>
  )
}

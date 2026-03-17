"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { fetchCrudList, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useSearchParams } from 'next/navigation'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import Link from 'next/link'

type PrizeRow = {
  id: string
  competition_id: string
  name: string
  description: string | null
  category: string
  track_id: string | null
  sponsor_id: string | null
  value: string | null
  rank: number | null
  winning_project_id: string | null
  winning_team_id: string | null
  awarded_at: string | null
  order: number
  created_at: string
}

type PrizesResponse = {
  items: PrizeRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const CATEGORY_COLORS: Record<string, string> = {
  TRACK_PLACEMENT: 'bg-blue-100 text-blue-800',
  SPECIAL_AWARD: 'bg-purple-100 text-purple-800',
  SPONSOR_PRIZE: 'bg-amber-100 text-amber-800',
  PEOPLES_CHOICE: 'bg-pink-100 text-pink-800',
}

function CategoryBadge({ category }: { category: string }) {
  const colors = CATEGORY_COLORS[category] ?? 'bg-gray-100 text-gray-800'
  const labels: Record<string, string> = {
    TRACK_PLACEMENT: 'Track',
    SPECIAL_AWARD: 'Special',
    SPONSOR_PRIZE: 'Sponsor',
    PEOPLES_CHOICE: "People's Choice",
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}>
      {labels[category] ?? category}
    </span>
  )
}

function buildColumns(t: (key: string, fallback?: string) => string): ColumnDef<PrizeRow>[] {
  return [
    {
      accessorKey: 'name',
      header: t('sponsors.prizes.column.name', 'Prize'),
      meta: { priority: 1 },
      cell: ({ row }) => (
        <div>
          <span className="font-medium">{row.original.name}</span>
          {row.original.value && (
            <span className="ml-2 text-xs text-muted-foreground">({row.original.value})</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: t('sponsors.prizes.column.category', 'Category'),
      meta: { priority: 2 },
      cell: ({ getValue }) => <CategoryBadge category={getValue() as string} />,
    },
    {
      accessorKey: 'rank',
      header: t('sponsors.prizes.column.rank', 'Rank'),
      meta: { priority: 3 },
      cell: ({ getValue }) => {
        const val = getValue() as number | null
        return val != null ? `#${val}` : '-'
      },
    },
    {
      id: 'winner',
      header: t('sponsors.prizes.column.winner', 'Winner'),
      meta: { priority: 4 },
      cell: ({ row }) => {
        if (!row.original.winning_project_id) {
          return <span className="text-muted-foreground text-xs">Not assigned</span>
        }
        return (
          <span className="text-green-600 text-xs font-medium">Assigned</span>
        )
      },
    },
    {
      accessorKey: 'order',
      header: t('sponsors.prizes.column.order', 'Order'),
      meta: { priority: 5 },
    },
  ]
}

export default function PrizesPage() {
  const t = useT()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'order', desc: false }])
  const [page, setPage] = React.useState(1)
  const [categoryFilter, setCategoryFilter] = React.useState('')
  const scopeVersion = useOrganizationScopeVersion()

  // Create prize dialog state
  const [showCreateDialog, setShowCreateDialog] = React.useState(false)
  const [newName, setNewName] = React.useState('')
  const [newCategory, setNewCategory] = React.useState('SPECIAL_AWARD')
  const [newValue, setNewValue] = React.useState('')
  const [newRank, setNewRank] = React.useState('')
  const [newOrder, setNewOrder] = React.useState(0)
  const [creating, setCreating] = React.useState(false)

  const competitionId = searchParams.get('competitionId') ?? ''

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: '50',
      sortField: sorting[0]?.id || 'order',
      sortDir: sorting[0]?.desc ? 'desc' : 'asc',
    })
    if (competitionId) params.set('competitionId', competitionId)
    if (categoryFilter) params.set('category', categoryFilter)
    return params.toString()
  }, [page, sorting, competitionId, categoryFilter])

  const columns = React.useMemo(() => buildColumns(t), [t])

  const { data, isLoading } = useQuery<PrizesResponse>({
    queryKey: ['prizes', queryParams, scopeVersion],
    queryFn: async () => fetchCrudList<PrizeRow>('sponsors/prizes', Object.fromEntries(new URLSearchParams(queryParams))),
    enabled: !!competitionId,
  })

  const handleCreate = async () => {
    if (!newName.trim()) return
    setCreating(true)
    try {
      await apiCall('/api/sponsors/prizes', {
        method: 'POST',
        body: JSON.stringify({
          competitionId,
          name: newName.trim(),
          category: newCategory,
          value: newValue.trim() || null,
          rank: newRank ? Number(newRank) : null,
          order: newOrder,
        }),
      })
      flash(t('sponsors.prizes.flash.created', 'Prize created'), 'success')
      queryClient.invalidateQueries({ queryKey: ['prizes'] })
      setShowCreateDialog(false)
      setNewName('')
      setNewValue('')
      setNewRank('')
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to create prize', 'error')
    } finally {
      setCreating(false)
    }
  }

  if (!competitionId) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold">{t('sponsors.prizes.title', 'Prizes')}</h1>
        <p className="text-muted-foreground mt-2">
          {t('sponsors.prizes.selectCompetition', 'Please select a competition.')}
        </p>
      </div>
    )
  }

  return (
    <>
      <DataTable
        title={t('sponsors.prizes.title', 'Prizes')}
        actions={(
          <div className="flex items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => { setCategoryFilter(e.target.value); setPage(1) }}
              className="rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">{t('sponsors.prizes.filter.all', 'All categories')}</option>
              <option value="TRACK_PLACEMENT">Track Placement</option>
              <option value="SPECIAL_AWARD">Special Award</option>
              <option value="SPONSOR_PRIZE">Sponsor Prize</option>
              <option value="PEOPLES_CHOICE">People&apos;s Choice</option>
            </select>
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              {t('sponsors.prizes.actions.create', 'Add Prize')}
            </Button>
            <Link href={`/backend/sponsors?competitionId=${competitionId}`}>
              <Button size="sm" variant="outline">{t('sponsors.prizes.actions.backToSponsors', 'Sponsors')}</Button>
            </Link>
          </div>
        )}
        columns={columns}
        data={data?.items ?? []}
        sortable
        sorting={sorting}
        onSortingChange={(s) => { setSorting(s); setPage(1) }}
        rowActions={(row) => (
          <RowActions
            items={[
              {
                label: t('sponsors.prizes.actions.delete', 'Delete'),
                destructive: true,
                onSelect: async () => {
                  const confirmed = await confirm({
                    title: t('sponsors.prizes.confirm.delete', 'Delete this prize?'),
                    variant: 'destructive',
                  })
                  if (!confirmed) return
                  try {
                    await deleteCrud('sponsors/prizes', row.id)
                    flash(t('sponsors.prizes.flash.deleted', 'Prize deleted'), 'success')
                    queryClient.invalidateQueries({ queryKey: ['prizes'] })
                  } catch (err) {
                    flash(err instanceof Error ? err.message : 'Failed to delete', 'error')
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
      />

      {/* Inline Create Dialog */}
      {showCreateDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg border p-6 w-full max-w-md shadow-lg">
            <h2 className="text-lg font-semibold mb-4">{t('sponsors.prizes.dialog.title', 'Add Prize')}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Category *</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="TRACK_PLACEMENT">Track Placement</option>
                  <option value="SPECIAL_AWARD">Special Award</option>
                  <option value="SPONSOR_PRIZE">Sponsor Prize</option>
                  <option value="PEOPLES_CHOICE">People&apos;s Choice</option>
                </select>
              </div>
              <div className="grid gap-3 grid-cols-2">
                <div>
                  <label className="block text-sm font-medium mb-1">Value</label>
                  <input
                    type="text"
                    value={newValue}
                    onChange={(e) => setNewValue(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    placeholder="e.g. $500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Rank</label>
                  <input
                    type="number"
                    value={newRank}
                    onChange={(e) => setNewRank(e.target.value)}
                    className="w-full rounded-md border px-3 py-2 text-sm"
                    min={1}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Display Order</label>
                <input
                  type="number"
                  value={newOrder}
                  onChange={(e) => setNewOrder(Number(e.target.value))}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  min={0}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={creating || !newName.trim()}>
                {creating ? 'Creating...' : 'Create'}
              </Button>
            </div>
          </div>
        </div>
      )}
      {ConfirmDialogElement}
    </>
  )
}

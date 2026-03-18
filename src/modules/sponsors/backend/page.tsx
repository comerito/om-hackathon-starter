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
import { Button } from '@open-mercato/ui/primitives/button'
import Link from 'next/link'
import { CompetitionPicker } from '../../competitions/components/CompetitionPicker'

type SponsorRow = {
  id: string
  competition_id: string
  name: string
  tier: string
  logo_url: string
  website_url: string | null
  description: string | null
  challenge_title: string | null
  contact_name: string | null
  contact_email: string | null
  order: number
  is_visible: boolean
  is_active: boolean
  created_at: string
  updated_at: string
}

type SponsorsResponse = {
  items: SponsorRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const TIER_COLORS: Record<string, string> = {
  TITLE: 'bg-yellow-100 text-yellow-800',
  GOLD: 'bg-amber-100 text-amber-800',
  SILVER: 'bg-gray-200 text-gray-700',
  PARTNER: 'bg-blue-100 text-blue-800',
  IN_KIND: 'bg-green-100 text-green-800',
}

function TierBadge({ tier }: { tier: string }) {
  const colors = TIER_COLORS[tier] ?? 'bg-gray-100 text-gray-800'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}>
      {tier}
    </span>
  )
}

function buildColumns(t: (key: string, fallback?: string) => string): ColumnDef<SponsorRow>[] {
  return [
    {
      accessorKey: 'name',
      header: t('sponsors.table.column.name', 'Name'),
      meta: { priority: 1 },
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          {row.original.logo_url && (
            <img
              src={row.original.logo_url}
              alt=""
              className="size-8 rounded object-contain bg-white border"
            />
          )}
          <span className="font-medium">{row.original.name}</span>
        </div>
      ),
    },
    {
      accessorKey: 'tier',
      header: t('sponsors.table.column.tier', 'Tier'),
      meta: { priority: 2 },
      cell: ({ getValue }) => <TierBadge tier={getValue() as string} />,
    },
    {
      id: 'challenge',
      header: t('sponsors.table.column.challenge', 'Challenge'),
      meta: { priority: 3 },
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.challenge_title ?? '-'}
        </span>
      ),
    },
    {
      accessorKey: 'contact_name',
      header: t('sponsors.table.column.contact', 'Contact'),
      meta: { priority: 4 },
      cell: ({ row }) => (
        <span className="text-sm">
          {row.original.contact_name ?? '-'}
        </span>
      ),
    },
    {
      accessorKey: 'order',
      header: t('sponsors.table.column.order', 'Order'),
      meta: { priority: 5 },
    },
    {
      accessorKey: 'is_visible',
      header: t('sponsors.table.column.visible', 'Visible'),
      meta: { priority: 6 },
      cell: ({ getValue }) => {
        const val = getValue() as boolean
        return val
          ? <span className="text-green-600 text-xs font-medium">Yes</span>
          : <span className="text-muted-foreground text-xs">No</span>
      },
    },
  ]
}

export default function SponsorsPage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'order', desc: false }])
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState('')
  const [tierFilter, setTierFilter] = React.useState('')
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
    if (tierFilter) params.set('tier', tierFilter)
    return params.toString()
  }, [page, sorting, search, competitionId, tierFilter])

  const columns = React.useMemo(() => buildColumns(t), [t])

  const { data, isLoading, error } = useQuery<SponsorsResponse>({
    queryKey: ['sponsors', queryParams, scopeVersion],
    queryFn: async () => fetchCrudList<SponsorRow>('sponsors/sponsors', Object.fromEntries(new URLSearchParams(queryParams))),
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
            <h1 className="text-2xl font-bold">{t('sponsors.table.title', 'Sponsors & Prizes')}</h1>
            <CompetitionPicker value="" />
            <p className="text-muted-foreground">
              {t('sponsors.table.selectCompetition', 'Please select a competition to manage sponsors.')}
            </p>
          </div>
        </PageBody>
      </Page>
    )
  }

  if (error) {
    return <div className="text-sm text-destructive">{t('sponsors.table.error.generic', 'Failed to load sponsors')}</div>
  }

  return (
    <Page>
      <PageBody>
        <div className="mb-4">
          <CompetitionPicker value={competitionId} />
        </div>
        <DataTable
          title={t('sponsors.table.title', 'Sponsors')}
          actions={(
            <div className="flex items-center gap-2">
              <select
              value={tierFilter}
              onChange={(e) => { setTierFilter(e.target.value); setPage(1) }}
              className="rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">{t('sponsors.table.filter.allTiers', 'All tiers')}</option>
              <option value="TITLE">Title</option>
              <option value="GOLD">Gold</option>
              <option value="SILVER">Silver</option>
              <option value="PARTNER">Partner</option>
              <option value="IN_KIND">In-Kind</option>
            </select>
            <Link href={`/backend/sponsors/create?competitionId=${competitionId}`}>
              <Button size="sm">{t('sponsors.table.actions.create', 'Add Sponsor')}</Button>
            </Link>
            <Link href={`/backend/sponsors/prizes?competitionId=${competitionId}`}>
              <Button size="sm" variant="outline">{t('sponsors.table.actions.prizes', 'Manage Prizes')}</Button>
            </Link>
            <Link href={`/backend/sponsors/results?competitionId=${competitionId}`}>
              <Button size="sm" variant="outline">{t('sponsors.table.actions.results', 'Results')}</Button>
            </Link>
          </div>
        )}
        columns={columns}
        data={data?.items ?? []}
        searchValue={search}
        onSearchChange={(v) => { setSearch(v); setPage(1) }}
        searchAlign="right"
        sortable
        sorting={sorting}
        onSortingChange={handleSortingChange}
        rowActions={(row) => (
          <RowActions
            items={[
              {
                label: t('sponsors.table.actions.edit', 'Edit'),
                href: `/backend/sponsors/create?competitionId=${competitionId}&id=${row.id}`,
              },
              {
                label: t('sponsors.table.actions.delete', 'Delete'),
                destructive: true,
                onSelect: async () => {
                  const confirmed = await confirm({
                    title: t('sponsors.table.confirm.delete', 'Delete this sponsor?'),
                    variant: 'destructive',
                  })
                  if (!confirmed) return
                  try {
                    await deleteCrud('sponsors/sponsors', row.id)
                    flash(t('sponsors.flash.deleted', 'Sponsor deleted'), 'success')
                    queryClient.invalidateQueries({ queryKey: ['sponsors'] })
                  } catch (err) {
                    const message = err instanceof Error && err.message
                      ? err.message
                      : t('sponsors.table.error.delete', 'Failed to delete sponsor')
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
        />
        {ConfirmDialogElement}
      </PageBody>
    </Page>
  )
}

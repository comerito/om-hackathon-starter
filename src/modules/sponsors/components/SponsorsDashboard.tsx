"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { EnumBadge } from '@open-mercato/ui/backend/ValueIcons'
import { Button } from '@open-mercato/ui/primitives/button'
import { fetchCrudList, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

type SponsorRow = { id: string; name: string; tier: string; logo_url: string; is_visible: boolean; order: number; created_at: string }
type PrizeRow = { id: string; name: string; category: string; track_id: string | null; value: string | null; rank: number | null; winning_project_id: string | null; awarded_at: string | null; order: number }
type TallyEntry = { project_id: string; vote_count: number }

const tierPreset: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  title: { label: 'Title', variant: 'default' },
  gold: { label: 'Gold', variant: 'default' },
  silver: { label: 'Silver', variant: 'secondary' },
  partner: { label: 'Partner', variant: 'outline' },
  in_kind: { label: 'In-Kind', variant: 'outline' },
}

const categoryPreset: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  track_placement: { label: 'Track', variant: 'default' },
  special_award: { label: 'Special', variant: 'secondary' },
  sponsor_prize: { label: 'Sponsor', variant: 'outline' },
  peoples_choice: { label: "People's Choice", variant: 'default' },
}

export default function SponsorsDashboard() {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const scopeVersion = useOrganizationScopeVersion()
  const [tab, setTab] = React.useState<'sponsors' | 'prizes' | 'votes'>('sponsors')

  const { data: sponsorsData, isLoading: sponsorsLoading } = useQuery({
    queryKey: ['sponsors', scopeVersion],
    queryFn: () => fetchCrudList<SponsorRow>('sponsors/sponsors', { pageSize: '50', sortField: 'order', sortDir: 'asc' }),
    enabled: tab === 'sponsors',
  })

  const { data: prizesData, isLoading: prizesLoading } = useQuery({
    queryKey: ['prizes', scopeVersion],
    queryFn: () => fetchCrudList<PrizeRow>('sponsors/prizes', { pageSize: '50', sortField: 'order', sortDir: 'asc' }),
    enabled: tab === 'prizes',
  })

  const { data: tracksData } = useQuery({
    queryKey: ['tracks-lookup', scopeVersion],
    queryFn: () => fetchCrudList<{ id: string; name: string }>('tracks/tracks', { pageSize: '100' }),
    enabled: tab === 'prizes',
  })
  const trackMap = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const tr of tracksData?.items ?? []) map.set(tr.id, tr.name)
    return map
  }, [tracksData])

  const { data: tallyData, isLoading: tallyLoading } = useQuery({
    queryKey: ['vote-tally', scopeVersion],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ items: TallyEntry[]; total_votes: number }>('/api/sponsors/votes')
      return ok ? result : { items: [], total_votes: 0 }
    },
    enabled: tab === 'votes',
  })

  const sponsorColumns = React.useMemo<ColumnDef<SponsorRow>[]>(() => [
    { accessorKey: 'name', header: t('sponsors.table.name', 'Name'), meta: { priority: 1 } },
    { accessorKey: 'tier', header: t('sponsors.table.tier', 'Tier'), meta: { priority: 2 }, cell: ({ getValue }) => <EnumBadge value={String(getValue())} map={tierPreset} /> },
    { accessorKey: 'is_visible', header: t('sponsors.table.visible', 'Visible'), meta: { priority: 3 }, cell: ({ getValue }) => getValue() ? 'Yes' : 'No' },
    { accessorKey: 'order', header: t('sponsors.table.order', 'Order'), meta: { priority: 4 } },
  ], [t])

  const prizeColumns = React.useMemo<ColumnDef<PrizeRow>[]>(() => [
    { accessorKey: 'name', header: t('sponsors.table.name', 'Name'), meta: { priority: 1 } },
    { accessorKey: 'category', header: t('sponsors.table.category', 'Category'), meta: { priority: 2 }, cell: ({ getValue }) => <EnumBadge value={String(getValue())} map={categoryPreset} /> },
    { accessorKey: 'track_id', header: t('sponsors.table.track', 'Track'), meta: { priority: 3 }, cell: ({ getValue }) => { const id = getValue() as string | null; return id ? (trackMap.get(id) ?? '—') : '—' } },
    { accessorKey: 'value', header: t('sponsors.table.value', 'Value'), meta: { priority: 3 }, cell: ({ getValue }) => getValue() ?? '—' },
    { accessorKey: 'awarded_at', header: t('sponsors.table.awarded', 'Awarded'), meta: { priority: 2 },
      cell: ({ getValue }) => getValue() ? <span className="text-green-600 font-medium">Awarded</span> : <span className="text-muted-foreground">Pending</span> },
  ], [t, trackMap])

  const tabs = [
    { key: 'sponsors' as const, label: t('sponsors.tabs.sponsors', 'Sponsors') },
    { key: 'prizes' as const, label: t('sponsors.tabs.prizes', 'Prizes') },
    { key: 'votes' as const, label: t('sponsors.tabs.votes', 'Vote Tally') },
  ]

  return (
    <div className="space-y-4">
      <div className="flex gap-1 border-b">
        {tabs.map(tb => (
          <button key={tb.key} onClick={() => setTab(tb.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === tb.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >{tb.label}</button>
        ))}
      </div>

      {tab === 'sponsors' && (
        <DataTable title={t('sponsors.sponsors.title', 'Sponsors')}
          actions={<Button asChild><Link href="/backend/sponsors/create">{t('sponsors.sponsors.create', 'Add Sponsor')}</Link></Button>}
          columns={sponsorColumns} data={sponsorsData?.items ?? []} isLoading={sponsorsLoading}
          rowActions={(row) => (
            <RowActions items={[
              { id: 'edit', label: t('common.edit', 'Edit'), href: `/backend/sponsors/${row.id}/edit` },
              { id: 'delete', label: t('common.delete', 'Delete'), destructive: true, onSelect: async () => {
                if (!await confirm({ title: t('sponsors.confirmDelete', 'Delete this sponsor?'), variant: 'destructive' })) return
                await deleteCrud('sponsors/sponsors', row.id)
                flash(t('sponsors.flash.deleted', 'Sponsor deleted'), 'success')
                queryClient.invalidateQueries({ queryKey: ['sponsors'] })
              }},
            ]} />
          )}
          onRowClick={(row) => router.push(`/backend/sponsors/${row.id}/edit`)}
        />
      )}

      {tab === 'prizes' && (
        <DataTable title={t('sponsors.prizes.title', 'Prizes')}
          actions={<Button asChild><Link href="/backend/sponsors/prizes/create">{t('sponsors.prizes.create', 'Add Prize')}</Link></Button>}
          columns={prizeColumns} data={prizesData?.items ?? []} isLoading={prizesLoading}
          rowActions={(row) => (
            <RowActions items={[
              { id: 'edit', label: t('common.edit', 'Edit'), href: `/backend/prizes/${row.id}/edit` },
              { id: 'delete', label: t('common.delete', 'Delete'), destructive: true, onSelect: async () => {
                if (!await confirm({ title: t('sponsors.confirmDeletePrize', 'Delete this prize?'), variant: 'destructive' })) return
                await deleteCrud('sponsors/prizes', row.id)
                flash(t('sponsors.flash.prizeDeleted', 'Prize deleted'), 'success')
                queryClient.invalidateQueries({ queryKey: ['prizes'] })
              }},
            ]} />
          )}
        />
      )}

      {tab === 'votes' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">{t('sponsors.votes.title', 'People\'s Choice Tally')}</h3>
            <span className="text-sm text-muted-foreground">{tallyData?.total_votes ?? 0} {t('sponsors.votes.totalVotes', 'total votes')}</span>
          </div>
          {tallyLoading ? <div className="text-muted-foreground">{t('common.loading', 'Loading...')}</div> : (
            <div className="rounded-lg border">
              <table className="w-full text-sm">
                <thead><tr className="border-b bg-muted/50">
                  <th className="p-2 text-center w-12">#</th>
                  <th className="p-2 text-left">{t('sponsors.votes.project', 'Project')}</th>
                  <th className="p-2 text-right">{t('sponsors.votes.count', 'Votes')}</th>
                </tr></thead>
                <tbody>
                  {(tallyData?.items ?? []).map((entry, i) => (
                    <tr key={entry.project_id} className="border-b last:border-0">
                      <td className="p-2 text-center font-mono">{i + 1}</td>
                      <td className="p-2">{entry.project_id.substring(0, 8)}...</td>
                      <td className="p-2 text-right font-mono font-bold">{entry.vote_count}</td>
                    </tr>
                  ))}
                  {(tallyData?.items ?? []).length === 0 && (
                    <tr><td colSpan={3} className="p-4 text-center text-muted-foreground">{t('sponsors.votes.empty', 'No votes cast yet')}</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {ConfirmDialogElement}
    </div>
  )
}

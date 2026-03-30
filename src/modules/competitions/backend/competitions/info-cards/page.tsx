"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { Button } from '@open-mercato/ui/primitives/button'
import { fetchCrudList, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'

type CompetitionInfoCardRow = {
  id: string
  competition_id: string
  key: string
  icon: string | null
  label: string
  value: string
  sort_order: number
}

export default function CompetitionInfoCardsPage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'sort_order', desc: false }])
  const [page, setPage] = React.useState(1)
  const scopeVersion = useOrganizationScopeVersion()

  const competitionId = searchParams.get('competitionId') ?? ''

  const queryParams = React.useMemo(() => {
    const params: Record<string, string> = {
      page: page.toString(),
      pageSize: '50',
      sortField: sorting[0]?.id || 'sort_order',
      sortDir: sorting[0]?.desc ? 'desc' : 'asc',
    }
    if (competitionId) params.competition_id = competitionId
    return Object.fromEntries(new URLSearchParams(new URLSearchParams(params).toString()))
  }, [competitionId, page, sorting])

  const { data, isLoading } = useQuery({
    queryKey: ['competition-info-cards', queryParams, scopeVersion],
    queryFn: () => fetchCrudList<CompetitionInfoCardRow>('competitions/info-cards', queryParams),
  })

  const columns = React.useMemo<ColumnDef<CompetitionInfoCardRow>[]>(() => [
    { accessorKey: 'label', header: t('competitions.infoCards.label', 'Label'), meta: { priority: 1 } },
    { accessorKey: 'value', header: t('competitions.infoCards.value', 'Value'), meta: { priority: 2 } },
    { accessorKey: 'key', header: t('competitions.infoCards.key', 'Key'), meta: { priority: 3 } },
    { accessorKey: 'icon', header: t('competitions.infoCards.icon', 'Icon'), meta: { priority: 4 } },
  ], [t])

  const createHref = competitionId
    ? `/backend/competitions/info-cards/create?competitionId=${encodeURIComponent(competitionId)}`
    : '/backend/competitions/info-cards/create'

  return (
    <Page>
      <PageBody>
        <p className="mb-4 text-sm text-muted-foreground">
          {competitionId ? t('competitions.infoCards.pageDescription.filtered', 'Cards for the selected competition.') : t('competitions.infoCards.pageDescription', 'Manage localized competition facts shown in the portal.')}
        </p>
        <DataTable
          title={t('competitions.infoCards.pageTitle', 'Competition Info Cards')}
          actions={<Button asChild><Link href={createHref}>{t('competitions.infoCards.create', 'Add Info Card')}</Link></Button>}
          columns={columns}
          data={data?.items ?? []}
          sortable
          sorting={sorting}
          onSortingChange={(s) => { setSorting(s); setPage(1) }}
          rowActions={(row) => (
            <RowActions items={[
              { label: t('competitions.infoCards.edit', 'Edit'), href: `/backend/competitions/info-cards/${row.id}/edit` },
              {
                label: t('competitions.infoCards.delete', 'Delete'),
                destructive: true,
                onSelect: async () => {
                  if (!await confirm({ title: t('competitions.infoCards.confirmDelete', 'Delete this info card?'), variant: 'destructive' })) return
                  try {
                    await deleteCrud('competitions/info-cards', row.id)
                    flash(t('competitions.infoCards.flash.deleted', 'Info card deleted'), 'success')
                    queryClient.invalidateQueries({ queryKey: ['competition-info-cards'] })
                  } catch (err) {
                    flash(err instanceof Error ? err.message : t('competitions.infoCards.error.delete', 'Failed to delete info card'), 'error')
                  }
                },
              },
            ]} />
          )}
          pagination={{
            page,
            pageSize: 50,
            total: data?.total || 0,
            totalPages: data?.totalPages || 0,
            onPageChange: setPage,
          }}
          isLoading={isLoading}
          onRowClick={(row) => router.push(`/backend/competitions/info-cards/${row.id}/edit`)}
        />
        {ConfirmDialogElement}
      </PageBody>
    </Page>
  )
}

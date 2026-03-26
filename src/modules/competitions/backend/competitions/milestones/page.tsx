"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
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
import { BulkImportMilestonesDialog } from '../../../components/BulkImportMilestonesDialog'

type MilestoneRow = { id: string; name: string; due_date: string; status: string; competition_id: string; sort_order: number }

const statusPreset: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  upcoming: { label: 'Upcoming', variant: 'secondary' },
  active: { label: 'Active', variant: 'default' },
  completed: { label: 'Completed', variant: 'destructive' },
}

export default function MilestonesListPage() {
  const t = useT()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [showImport, setShowImport] = React.useState(false)
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'sort_order', desc: false }])
  const [page, setPage] = React.useState(1)
  const scopeVersion = useOrganizationScopeVersion()

  const queryParams = React.useMemo(() => new URLSearchParams({
    page: page.toString(), pageSize: '50',
    sortField: sorting[0]?.id || 'sort_order', sortDir: sorting[0]?.desc ? 'desc' : 'asc',
  }).toString(), [page, sorting])

  const { data, isLoading } = useQuery({
    queryKey: ['milestones', queryParams, scopeVersion],
    queryFn: () => fetchCrudList<MilestoneRow>('competitions/milestones', Object.fromEntries(new URLSearchParams(queryParams))),
  })

  const columns = React.useMemo<ColumnDef<MilestoneRow>[]>(() => [
    { accessorKey: 'name', header: t('competitions.milestones.name', 'Name'), meta: { priority: 1 } },
    {
      accessorKey: 'due_date', header: t('competitions.milestones.dueDate', 'Due Date'), meta: { priority: 2 },
      cell: ({ getValue }) => { const v = getValue(); return v ? new Date(v as string).toLocaleString() : '—' },
    },
    {
      accessorKey: 'status', header: t('competitions.milestones.status', 'Status'), meta: { priority: 3 },
      cell: ({ getValue }) => <EnumBadge value={String(getValue())} map={statusPreset} />,
    },
  ], [t])

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('competitions.milestones.pageTitle', 'Milestones')}
          actions={<div className="flex gap-2"><Button variant="outline" onClick={() => setShowImport(true)}>{t('competitions.milestones.import', 'Import CSV')}</Button><Button asChild><Link href="/backend/competitions/milestones/create">{t('competitions.milestones.create', 'New Milestone')}</Link></Button></div>}
          columns={columns} data={data?.items ?? []}
          sortable sorting={sorting} onSortingChange={(s) => { setSorting(s); setPage(1) }}
          rowActions={(row) => (
            <RowActions items={[
              {
                label: t('competitions.milestones.edit', 'Edit'),
                onSelect: () => { window.location.href = `/backend/competitions/milestones/${row.id}/edit` },
              },
              {
                label: t('competitions.milestones.delete', 'Delete'), destructive: true,
                onSelect: async () => {
                  if (!await confirm({ title: t('competitions.milestones.confirmDelete', 'Delete this milestone?'), variant: 'destructive' })) return
                  try { await deleteCrud('competitions/milestones', row.id); flash(t('competitions.milestones.flash.deleted', 'Milestone deleted'), 'success'); queryClient.invalidateQueries({ queryKey: ['milestones'] }) }
                  catch (err) { flash(err instanceof Error ? err.message : t('competitions.milestones.error.delete', 'Failed to delete'), 'error') }
                },
              },
            ]} />
          )}
          pagination={{ page, pageSize: 50, total: data?.total || 0, totalPages: data?.totalPages || 0, onPageChange: setPage }}
          isLoading={isLoading}
        />
        {ConfirmDialogElement}
        {showImport && <BulkImportMilestonesDialog onClose={() => { setShowImport(false); queryClient.invalidateQueries({ queryKey: ['milestones'] }) }} />}
      </PageBody>
    </Page>
  )
}

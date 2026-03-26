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
import { useRouter } from 'next/navigation'
import { BulkImportAgendaDialog } from '../../../components/BulkImportAgendaDialog'

type AgendaRow = { id: string; title: string; type: string; starts_at: string; ends_at: string; location: string | null; is_mandatory: boolean }

const typePreset: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  ceremony: { label: 'Ceremony', variant: 'default' },
  talk: { label: 'Talk', variant: 'default' },
  workshop: { label: 'Workshop', variant: 'secondary' },
  break: { label: 'Break', variant: 'outline' },
  meal: { label: 'Meal', variant: 'outline' },
  deadline: { label: 'Deadline', variant: 'default' },
  demo_session: { label: 'Demo', variant: 'default' },
  custom: { label: 'Custom', variant: 'secondary' },
}

export default function AgendaListPage() {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [showImport, setShowImport] = React.useState(false)
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'starts_at', desc: false }])
  const [page, setPage] = React.useState(1)
  const scopeVersion = useOrganizationScopeVersion()

  const queryParams = React.useMemo(() => new URLSearchParams({
    page: page.toString(), pageSize: '50',
    sortField: sorting[0]?.id || 'starts_at', sortDir: sorting[0]?.desc ? 'desc' : 'asc',
  }).toString(), [page, sorting])

  const { data, isLoading } = useQuery({
    queryKey: ['agenda', queryParams, scopeVersion],
    queryFn: () => fetchCrudList<AgendaRow>('competitions/agenda', Object.fromEntries(new URLSearchParams(queryParams))),
  })

  const columns = React.useMemo<ColumnDef<AgendaRow>[]>(() => [
    { accessorKey: 'title', header: t('competitions.agenda.title', 'Title'), meta: { priority: 1 } },
    {
      accessorKey: 'type', header: t('competitions.agenda.type', 'Type'), meta: { priority: 2 },
      cell: ({ getValue }) => <EnumBadge value={String(getValue())} map={typePreset} />,
    },
    {
      accessorKey: 'starts_at', header: t('competitions.agenda.startsAt', 'Start'), meta: { priority: 3 },
      cell: ({ getValue }) => { const v = getValue(); return v ? new Date(v as string).toLocaleString() : '—' },
    },
    { accessorKey: 'location', header: t('competitions.agenda.location', 'Location'), meta: { priority: 4 } },
  ], [t])

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('competitions.agenda.pageTitle', 'Agenda')}
          actions={<div className="flex gap-2"><Button variant="outline" onClick={() => setShowImport(true)}>{t('competitions.agenda.import', 'Import CSV')}</Button><Button asChild><Link href="/backend/competitions/agenda/create">{t('competitions.agenda.create', 'Add Item')}</Link></Button></div>}
          columns={columns} data={data?.items ?? []}
          sortable sorting={sorting} onSortingChange={(s) => { setSorting(s); setPage(1) }}
          rowActions={(row) => (
            <RowActions items={[
              { label: t('competitions.agenda.edit', 'Edit'), href: `/backend/competitions/agenda/${row.id}/edit` },
              {
                label: t('competitions.agenda.delete', 'Delete'), destructive: true,
                onSelect: async () => {
                  if (!await confirm({ title: t('competitions.agenda.confirmDelete', 'Delete this agenda item?'), variant: 'destructive' })) return
                  try { await deleteCrud('competitions/agenda', row.id); flash(t('competitions.agenda.flash.deleted', 'Agenda item deleted'), 'success'); queryClient.invalidateQueries({ queryKey: ['agenda'] }) }
                  catch (err) { flash(err instanceof Error ? err.message : t('competitions.agenda.error.delete', 'Failed to delete'), 'error') }
                },
              },
            ]} />
          )}
          pagination={{ page, pageSize: 50, total: data?.total || 0, totalPages: data?.totalPages || 0, onPageChange: setPage }}
          isLoading={isLoading}
          onRowClick={(row) => router.push(`/backend/competitions/agenda/${row.id}/edit`)}
        />
        {ConfirmDialogElement}
        {showImport && <BulkImportAgendaDialog onClose={() => { setShowImport(false); queryClient.invalidateQueries({ queryKey: ['agenda'] }) }} />}
      </PageBody>
    </Page>
  )
}

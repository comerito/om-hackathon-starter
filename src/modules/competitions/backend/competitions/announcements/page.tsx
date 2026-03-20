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

type AnnouncementRow = { id: string; title: string; priority: string; pinned: boolean; published_at: string }

const priorityPreset: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  info: { label: 'Info', variant: 'secondary' },
  warning: { label: 'Warning', variant: 'default' },
  urgent: { label: 'Urgent', variant: 'destructive' },
}

export default function AnnouncementsListPage() {
  const t = useT()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'created_at', desc: true }])
  const [page, setPage] = React.useState(1)
  const scopeVersion = useOrganizationScopeVersion()

  const queryParams = React.useMemo(() => new URLSearchParams({
    page: page.toString(), pageSize: '50',
    sortField: sorting[0]?.id || 'created_at', sortDir: sorting[0]?.desc ? 'desc' : 'asc',
  }).toString(), [page, sorting])

  const { data, isLoading } = useQuery({
    queryKey: ['announcements', queryParams, scopeVersion],
    queryFn: () => fetchCrudList<AnnouncementRow>('competitions/announcements', Object.fromEntries(new URLSearchParams(queryParams))),
  })

  const columns = React.useMemo<ColumnDef<AnnouncementRow>[]>(() => [
    { accessorKey: 'title', header: t('competitions.announcements.title', 'Title'), meta: { priority: 1 } },
    {
      accessorKey: 'priority', header: t('competitions.announcements.priority', 'Priority'), meta: { priority: 2 },
      cell: ({ getValue }) => <EnumBadge value={String(getValue())} map={priorityPreset} />,
    },
    {
      accessorKey: 'published_at', header: t('competitions.announcements.publishedAt', 'Published'), meta: { priority: 3 },
      cell: ({ getValue }) => { const v = getValue(); return v ? new Date(v as string).toLocaleString() : '—' },
    },
  ], [t])

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('competitions.announcements.pageTitle', 'Announcements')}
          actions={<Button asChild><Link href="/backend/competitions/announcements/create">{t('competitions.announcements.create', 'New Announcement')}</Link></Button>}
          columns={columns} data={data?.items ?? []}
          sortable sorting={sorting} onSortingChange={(s) => { setSorting(s); setPage(1) }}
          rowActions={(row) => (
            <RowActions items={[{
              label: t('competitions.announcements.delete', 'Delete'), destructive: true,
              onSelect: async () => {
                if (!await confirm({ title: t('competitions.announcements.confirmDelete', 'Delete this announcement?'), variant: 'destructive' })) return
                try { await deleteCrud('competitions/announcements', row.id); flash(t('competitions.announcements.flash.deleted', 'Announcement deleted'), 'success'); queryClient.invalidateQueries({ queryKey: ['announcements'] }) }
                catch (err) { flash(err instanceof Error ? err.message : t('competitions.announcements.error.delete', 'Failed to delete'), 'error') }
              },
            }]} />
          )}
          pagination={{ page, pageSize: 50, total: data?.total || 0, totalPages: data?.totalPages || 0, onPageChange: setPage }}
          isLoading={isLoading}
        />
        {ConfirmDialogElement}
      </PageBody>
    </Page>
  )
}

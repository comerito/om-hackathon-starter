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
import { useSearchParams } from 'next/navigation'

type AnnouncementRow = {
  id: string
  competition_id: string
  author_id: string
  title: string
  content: string
  priority: string
  target_roles: string[]
  target_track_ids: string[]
  pinned: boolean
  published_at: string
  created_at: string
}

type AnnouncementsResponse = {
  items: AnnouncementRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const PRIORITY_SEVERITY: Record<string, 'info' | 'warning' | 'success' | 'error' | 'neutral'> = {
  info: 'info',
  warning: 'warning',
  urgent: 'error',
}

function formatDateTime(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return dateStr
  }
}

function buildColumns(
  t: (key: string, fallback?: string) => string,
): ColumnDef<AnnouncementRow>[] {
  return [
    {
      accessorKey: 'title',
      header: t('competitions.announcements.table.column.title', 'Title'),
      meta: { priority: 1 },
    },
    {
      accessorKey: 'priority',
      header: t('competitions.announcements.table.column.priority', 'Priority'),
      meta: { priority: 2 },
      cell: ({ getValue }) => {
        const raw = getValue() as string
        return <EnumBadge value={raw} map={PRIORITY_SEVERITY} />
      },
    },
    {
      accessorKey: 'published_at',
      header: t('competitions.announcements.table.column.publishedAt', 'Published'),
      meta: { priority: 3 },
      cell: ({ getValue }) => formatDateTime(getValue() as string),
    },
    {
      accessorKey: 'pinned',
      header: t('competitions.announcements.table.column.pinned', 'Pinned'),
      meta: { priority: 4 },
      cell: ({ getValue }) => (getValue() as boolean) ? 'Yes' : 'No',
    },
  ]
}

export default function AnnouncementsPage() {
  const t = useT()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const searchParams = useSearchParams()
  const competitionId = searchParams.get('competitionId') ?? ''
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'published_at', desc: true }])
  const [page, setPage] = React.useState(1)
  const [priorityFilter, setPriorityFilter] = React.useState('')
  const [pinnedFilter, setPinnedFilter] = React.useState<string>('')
  const scopeVersion = useOrganizationScopeVersion()

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: '50',
      sortField: sorting[0]?.id || 'published_at',
      sortDir: sorting[0]?.desc ? 'desc' : 'asc',
    })
    if (competitionId) params.set('competitionId', competitionId)
    if (priorityFilter) params.set('priority', priorityFilter)
    if (pinnedFilter) params.set('pinned', pinnedFilter)
    return params.toString()
  }, [page, sorting, competitionId, priorityFilter, pinnedFilter])

  const columns = React.useMemo(() => buildColumns(t), [t])

  const { data, isLoading, error } = useQuery<AnnouncementsResponse>({
    queryKey: ['announcements', queryParams, scopeVersion],
    queryFn: async () => fetchCrudList<AnnouncementRow>('competitions/announcements', Object.fromEntries(new URLSearchParams(queryParams))),
  })

  const handleSortingChange = (newSorting: SortingState) => {
    setSorting(newSorting)
    setPage(1)
  }

  if (error) {
    return <div className="text-sm text-destructive">{t('competitions.announcements.table.error.generic', 'Failed to load announcements')}</div>
  }

  return (
    <>
      <DataTable
        title={t('competitions.announcements.table.title', 'Announcements')}
        actions={(
          <div className="flex gap-2">
            <Button variant="default" disabled>
              {t('competitions.announcements.table.actions.create', 'New announcement')}
            </Button>
          </div>
        )}
        columns={columns}
        data={data?.items ?? []}
        sortable
        sorting={sorting}
        onSortingChange={handleSortingChange}
        filters={[
          {
            id: 'priority',
            label: t('competitions.announcements.filter.priority', 'Priority'),
            type: 'select',
            options: [
              { label: t('competitions.announcements.filter.priority.all', 'All priorities'), value: '' },
              { label: 'Info', value: 'info' },
              { label: 'Warning', value: 'warning' },
              { label: 'Urgent', value: 'urgent' },
            ],
            value: priorityFilter,
            onChange: (v: string) => { setPriorityFilter(v); setPage(1) },
          },
          {
            id: 'pinned',
            label: t('competitions.announcements.filter.pinned', 'Pinned'),
            type: 'select',
            options: [
              { label: t('competitions.announcements.filter.all', 'All'), value: '' },
              { label: t('competitions.announcements.filter.yes', 'Yes'), value: 'true' },
              { label: t('competitions.announcements.filter.no', 'No'), value: 'false' },
            ],
            value: pinnedFilter,
            onChange: (v: string) => { setPinnedFilter(v); setPage(1) },
          },
        ]}
        rowActions={(row) => (
          <RowActions
            items={[
              {
                label: t('competitions.announcements.table.actions.delete', 'Delete'),
                destructive: true,
                onSelect: async () => {
                  const confirmed = await confirm({
                    title: t('competitions.announcements.confirm.delete', 'Delete this announcement?'),
                    variant: 'destructive',
                  })
                  if (!confirmed) return
                  try {
                    await deleteCrud('competitions/announcements', row.id)
                    flash(t('competitions.announcements.flash.deleted', 'Announcement deleted'), 'success')
                    queryClient.invalidateQueries({ queryKey: ['announcements'] })
                  } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : t('competitions.announcements.error.delete', 'Failed to delete announcement')
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
    </>
  )
}

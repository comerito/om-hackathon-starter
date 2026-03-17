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

type AgendaItemRow = {
  id: string
  competition_id: string
  title: string
  description?: string | null
  type: string
  starts_at: string
  ends_at: string
  location?: string | null
  speaker_name?: string | null
  is_mandatory: boolean
  order: number
  created_at?: string | null
}

type AgendaItemsResponse = {
  items: AgendaItemRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const TYPE_SEVERITY: Record<string, 'info' | 'warning' | 'success' | 'error' | 'neutral'> = {
  ceremony: 'success',
  talk: 'info',
  workshop: 'info',
  break: 'neutral',
  meal: 'neutral',
  deadline: 'error',
  demo_session: 'warning',
  custom: 'neutral',
}

function formatTime(dateStr: string): string {
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
): ColumnDef<AgendaItemRow>[] {
  return [
    {
      accessorKey: 'title',
      header: t('competitions.agenda.table.column.title', 'Title'),
      meta: { priority: 1 },
    },
    {
      accessorKey: 'type',
      header: t('competitions.agenda.table.column.type', 'Type'),
      meta: { priority: 2 },
      cell: ({ getValue }) => {
        const raw = getValue() as string
        return <EnumBadge value={raw} map={TYPE_SEVERITY} />
      },
    },
    {
      accessorKey: 'starts_at',
      header: t('competitions.agenda.table.column.startsAt', 'Starts'),
      meta: { priority: 3 },
      cell: ({ getValue }) => formatTime(getValue() as string),
    },
    {
      accessorKey: 'ends_at',
      header: t('competitions.agenda.table.column.endsAt', 'Ends'),
      meta: { priority: 4 },
      cell: ({ getValue }) => formatTime(getValue() as string),
    },
    {
      accessorKey: 'location',
      header: t('competitions.agenda.table.column.location', 'Location'),
      meta: { priority: 5 },
      cell: ({ getValue }) => (getValue() as string | null) ?? '\u2014',
    },
    {
      accessorKey: 'is_mandatory',
      header: t('competitions.agenda.table.column.isMandatory', 'Mandatory'),
      meta: { priority: 6 },
      cell: ({ getValue }) => (getValue() as boolean) ? 'Yes' : 'No',
    },
  ]
}

export default function AgendaPage() {
  const t = useT()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const searchParams = useSearchParams()
  const competitionId = searchParams.get('competitionId') ?? ''
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'starts_at', desc: false }])
  const [page, setPage] = React.useState(1)
  const [typeFilter, setTypeFilter] = React.useState('')
  const [mandatoryFilter, setMandatoryFilter] = React.useState<string>('')
  const scopeVersion = useOrganizationScopeVersion()

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: '50',
      sortField: sorting[0]?.id || 'starts_at',
      sortDir: sorting[0]?.desc ? 'desc' : 'asc',
    })
    if (competitionId) params.set('competitionId', competitionId)
    if (typeFilter) params.set('type', typeFilter)
    if (mandatoryFilter) params.set('isMandatory', mandatoryFilter)
    return params.toString()
  }, [page, sorting, competitionId, typeFilter, mandatoryFilter])

  const columns = React.useMemo(() => buildColumns(t), [t])

  const { data, isLoading, error } = useQuery<AgendaItemsResponse>({
    queryKey: ['agenda-items', queryParams, scopeVersion],
    queryFn: async () => fetchCrudList<AgendaItemRow>('competitions/agenda', Object.fromEntries(new URLSearchParams(queryParams))),
  })

  const handleSortingChange = (newSorting: SortingState) => {
    setSorting(newSorting)
    setPage(1)
  }

  if (error) {
    return <div className="text-sm text-destructive">{t('competitions.agenda.table.error.generic', 'Failed to load agenda items')}</div>
  }

  return (
    <>
      <DataTable
        title={t('competitions.agenda.table.title', 'Agenda')}
        actions={(
          <div className="flex gap-2">
            <Button variant="default" disabled>
              {t('competitions.agenda.table.actions.create', 'Add agenda item')}
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
            id: 'type',
            label: t('competitions.agenda.filter.type', 'Type'),
            type: 'select',
            options: [
              { label: t('competitions.agenda.filter.type.all', 'All types'), value: '' },
              { label: 'Ceremony', value: 'ceremony' },
              { label: 'Talk', value: 'talk' },
              { label: 'Workshop', value: 'workshop' },
              { label: 'Break', value: 'break' },
              { label: 'Meal', value: 'meal' },
              { label: 'Deadline', value: 'deadline' },
              { label: 'Demo Session', value: 'demo_session' },
              { label: 'Custom', value: 'custom' },
            ],
            value: typeFilter,
            onChange: (v: string) => { setTypeFilter(v); setPage(1) },
          },
          {
            id: 'isMandatory',
            label: t('competitions.agenda.filter.mandatory', 'Mandatory'),
            type: 'select',
            options: [
              { label: t('competitions.agenda.filter.all', 'All'), value: '' },
              { label: t('competitions.agenda.filter.yes', 'Yes'), value: 'true' },
              { label: t('competitions.agenda.filter.no', 'No'), value: 'false' },
            ],
            value: mandatoryFilter,
            onChange: (v: string) => { setMandatoryFilter(v); setPage(1) },
          },
        ]}
        rowActions={(row) => (
          <RowActions
            items={[
              {
                label: t('competitions.agenda.table.actions.delete', 'Delete'),
                destructive: true,
                onSelect: async () => {
                  const confirmed = await confirm({
                    title: t('competitions.agenda.confirm.delete', 'Delete this agenda item?'),
                    variant: 'destructive',
                  })
                  if (!confirmed) return
                  try {
                    await deleteCrud('competitions/agenda', row.id)
                    flash(t('competitions.agenda.flash.deleted', 'Agenda item deleted'), 'success')
                    queryClient.invalidateQueries({ queryKey: ['agenda-items'] })
                  } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : t('competitions.agenda.error.delete', 'Failed to delete agenda item')
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

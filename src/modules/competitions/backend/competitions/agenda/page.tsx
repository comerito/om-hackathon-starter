"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import type { FilterDef, FilterValues } from '@open-mercato/ui/backend/FilterBar'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { EnumBadge, BooleanIcon } from '@open-mercato/ui/backend/ValueIcons'
import { Button } from '@open-mercato/ui/primitives/button'
import { fetchCrudList, deleteCrud, buildCrudExportUrl } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BulkImportAgendaDialog } from '../../../components/BulkImportAgendaDialog'

type AgendaRow = {
  id: string
  title: string
  type: string
  starts_at: string
  ends_at: string
  location: string | null
  is_mandatory: boolean
  competition_id: string
}

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

// Maps client-side column ids back to the API's sortField values. "starts_at"/"ends_at"
// columns are deliberately given non-"_at" ids (see below) so DataTable's built-in
// "*_at columns get auto-formatted and lose their custom cell renderer" heuristic doesn't
// swallow our compact day/time rendering.
const SORT_FIELD_ALIASES: Record<string, string> = { when: 'starts_at', end: 'ends_at' }

function dayKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

export default function AgendaListPage() {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [showImport, setShowImport] = React.useState(false)
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'when', desc: false }])
  const [page, setPage] = React.useState(1)
  const [searchValue, setSearchValue] = React.useState('')
  const [filterValues, setFilterValues] = React.useState<FilterValues>({})
  const scopeVersion = useOrganizationScopeVersion()

  const sortField = SORT_FIELD_ALIASES[sorting[0]?.id ?? ''] ?? sorting[0]?.id ?? 'starts_at'
  const sortDir = sorting[0]?.desc ? 'desc' : 'asc'
  const dateRange = filterValues.starts_at as { from?: string; to?: string } | undefined

  const filterParams = React.useMemo(() => {
    const params: Record<string, string> = { sortField, sortDir }
    if (searchValue.trim()) params.title = searchValue.trim()
    if (typeof filterValues.competition_id === 'string' && filterValues.competition_id) params.competition_id = filterValues.competition_id
    if (typeof filterValues.type === 'string' && filterValues.type) params.type = filterValues.type
    if (dateRange?.from) params.starts_at_from = dateRange.from
    if (dateRange?.to) params.starts_at_to = dateRange.to
    return params
  }, [sortField, sortDir, searchValue, filterValues.competition_id, filterValues.type, dateRange])

  const queryParams = React.useMemo(() => new URLSearchParams({
    ...filterParams, page: page.toString(), pageSize: '100',
  }).toString(), [filterParams, page])

  const { data, isLoading } = useQuery({
    queryKey: ['agenda', queryParams, scopeVersion],
    queryFn: () => fetchCrudList<AgendaRow>('competitions/agenda', Object.fromEntries(new URLSearchParams(queryParams))),
  })

  // Loaded once (not paginated) to power the competition filter/column and, when the
  // org runs more than one competition, to disambiguate rows that would otherwise be
  // indistinguishable in a merged list.
  const { data: competitionsData } = useQuery({
    queryKey: ['agenda-competitions', scopeVersion],
    queryFn: async () => {
      const res = await fetchCrudList<{ id: string; name: string }>('competitions/competitions', { pageSize: '100' })
      return res?.items ?? []
    },
  })
  const competitionOptions = React.useMemo(
    () => (competitionsData ?? []).map((c) => ({ value: c.id, label: c.name })),
    [competitionsData],
  )
  const competitionNameMap = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const c of competitionsData ?? []) map.set(c.id, c.name)
    return map
  }, [competitionsData])
  const showCompetitionColumn = (competitionsData?.length ?? 0) > 1

  const items = React.useMemo(() => data?.items ?? [], [data])

  // Only compress consecutive same-day rows into a shared date label when the list is
  // actually in chronological order — otherwise (sorted by title/type/etc.) every row
  // gets its own date so the grouping never looks broken or misleading.
  const isChronological = (sorting[0]?.id ?? 'when') === 'when'
  const dayLabelRowIds = React.useMemo(() => {
    const ids = new Set<string>()
    if (!isChronological) return ids
    let lastKey: string | null = null
    for (const row of items) {
      const key = dayKey(row.starts_at)
      if (key !== lastKey) { ids.add(row.id); lastKey = key }
    }
    return ids
  }, [items, isChronological])

  const dateFormatter = React.useMemo(() => new Intl.DateTimeFormat(undefined, { weekday: 'short', day: '2-digit', month: 'short' }), [])
  const timeFormatter = React.useMemo(() => new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }), [])

  const columns = React.useMemo<ColumnDef<AgendaRow>[]>(() => {
    const cols: ColumnDef<AgendaRow>[] = [
      {
        accessorKey: 'title', header: t('competitions.agenda.title', 'Title'), meta: { priority: 1, maxWidth: '340px' },
        cell: ({ row, getValue }) => (
          <div className="flex items-center gap-2 min-w-0">
            <span className="truncate">{String(getValue())}</span>
            {row.original.is_mandatory && (
              <span className="shrink-0 text-[10px] uppercase tracking-wide rounded-full border px-1.5 py-0.5 text-muted-foreground">
                {t('competitions.agenda.mandatory', 'Required')}
              </span>
            )}
          </div>
        ),
      },
      {
        accessorKey: 'type', header: t('competitions.agenda.type', 'Type'), meta: { priority: 2 },
        cell: ({ getValue }) => <EnumBadge value={String(getValue())} map={typePreset} />,
      },
      {
        id: 'when', accessorFn: (row) => row.starts_at,
        header: t('competitions.agenda.startsAt', 'When'), meta: { priority: 3, truncate: false },
        cell: ({ row }) => {
          const v = row.original.starts_at
          if (!v) return <span className="text-muted-foreground">—</span>
          const d = new Date(v)
          const showDayLabel = dayLabelRowIds.has(row.original.id)
          return (
            <div className="leading-tight">
              {showDayLabel && <div className="text-[11px] font-medium">{dateFormatter.format(d)}</div>}
              <div className="text-sm tabular-nums text-muted-foreground">{timeFormatter.format(d)}</div>
            </div>
          )
        },
      },
      {
        id: 'end', accessorFn: (row) => row.ends_at,
        header: t('competitions.agenda.endsAt', 'End'), meta: { priority: 4, truncate: false },
        cell: ({ row }) => {
          const v = row.original.ends_at
          if (!v) return <span className="text-muted-foreground">—</span>
          const end = new Date(v)
          const start = new Date(row.original.starts_at)
          const sameDay = end.toDateString() === start.toDateString()
          return (
            <span className="text-sm tabular-nums text-muted-foreground">
              {sameDay ? timeFormatter.format(end) : `${dateFormatter.format(end)} ${timeFormatter.format(end)}`}
            </span>
          )
        },
      },
      {
        id: 'mandatory', header: t('competitions.agenda.isMandatory', 'Mandatory'), meta: { priority: 5 },
        cell: ({ row }) => (row.original.is_mandatory ? <BooleanIcon value /> : null),
      },
    ]
    if (showCompetitionColumn) {
      cols.push({
        id: 'competition', header: t('competitions.agenda.competition', 'Competition'), meta: { priority: 6, truncate: true, maxWidth: '180px' },
        cell: ({ row }) => competitionNameMap.get(row.original.competition_id) ?? '—',
      })
    }
    cols.push({
      accessorKey: 'location', header: t('competitions.agenda.location', 'Location'), meta: { priority: 7, maxWidth: '140px' },
      cell: ({ getValue }) => {
        const v = getValue() as string | null
        return v ? <span className="truncate">{v}</span> : <span className="text-muted-foreground">—</span>
      },
    })
    return cols
  }, [t, dayLabelRowIds, dateFormatter, timeFormatter, showCompetitionColumn, competitionNameMap])

  const filters = React.useMemo<FilterDef[]>(() => {
    const defs: FilterDef[] = [
      {
        id: 'type', label: t('competitions.agenda.type', 'Type'), type: 'select',
        options: Object.entries(typePreset).map(([value, cfg]) => ({ value, label: cfg.label })),
      },
      { id: 'starts_at', label: t('competitions.agenda.startsAt', 'When'), type: 'dateRange' },
    ]
    if (competitionOptions.length > 1) {
      defs.unshift({ id: 'competition_id', label: t('competitions.agenda.competition', 'Competition'), type: 'select', options: competitionOptions })
    }
    return defs
  }, [t, competitionOptions])

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('competitions.agenda.pageTitle', 'Agenda')}
          actions={<div className="flex gap-2"><Button variant="outline" onClick={() => setShowImport(true)}>{t('competitions.agenda.import', 'Import CSV')}</Button><Button asChild><Link href="/backend/competitions/agenda/create">{t('competitions.agenda.create', 'Add Item')}</Link></Button></div>}
          columns={columns} data={items}
          searchValue={searchValue}
          onSearchChange={(v) => { setSearchValue(v); setPage(1) }}
          searchPlaceholder={t('competitions.agenda.searchPlaceholder', 'Search by title…')}
          filters={filters}
          filterValues={filterValues}
          onFiltersApply={(vals) => { setFilterValues(vals); setPage(1) }}
          onFiltersClear={() => { setFilterValues({}); setPage(1) }}
          exporter={{
            formats: ['csv', 'json'],
            getUrl: (format) => buildCrudExportUrl('competitions/agenda', filterParams, format),
          }}
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
          pagination={{ page, pageSize: 100, total: data?.total || 0, totalPages: data?.totalPages || 0, onPageChange: setPage }}
          isLoading={isLoading}
          onRowClick={(row) => router.push(`/backend/competitions/agenda/${row.id}/edit`)}
        />
        {ConfirmDialogElement}
        {showImport && <BulkImportAgendaDialog onClose={() => { setShowImport(false); queryClient.invalidateQueries({ queryKey: ['agenda'] }) }} />}
      </PageBody>
    </Page>
  )
}

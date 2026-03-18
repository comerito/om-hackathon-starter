"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useSearchParams, useRouter } from 'next/navigation'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { useAppEvent } from '@open-mercato/ui/backend/injection/useAppEvent'

type IncidentRow = {
  id: string
  competition_id: string
  reporter_id: string | null
  reported_user_id: string | null
  description: string
  severity: string
  status: string
  admin_notes: string | null
  resolved_by: string | null
  resolution_description: string | null
  resolved_at: string | null
  created_at: string
  updated_at: string
}

type IncidentsResponse = {
  items: IncidentRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// ---------------------------------------------------------------------------
// Severity + Status badges
// ---------------------------------------------------------------------------

const SEVERITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  HIGH: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  CRITICAL: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

const STATUS_COLORS: Record<string, string> = {
  REPORTED: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  UNDER_REVIEW: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  RESOLVED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  DISMISSED: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

function SeverityBadge({ severity }: { severity: string }) {
  const colors = SEVERITY_COLORS[severity] ?? 'bg-gray-100 text-gray-800'
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}>
      {severity}
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800'
  const labels: Record<string, string> = {
    REPORTED: 'Reported',
    UNDER_REVIEW: 'Under Review',
    RESOLVED: 'Resolved',
    DISMISSED: 'Dismissed',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}>
      {labels[status] ?? status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

function buildColumns(t: (key: string, fallback?: string) => string): ColumnDef<IncidentRow>[] {
  return [
    {
      accessorKey: 'severity',
      header: t('incidents.column.severity', 'Severity'),
      meta: { priority: 1 },
      cell: ({ getValue }) => <SeverityBadge severity={getValue() as string} />,
    },
    {
      accessorKey: 'status',
      header: t('incidents.column.status', 'Status'),
      meta: { priority: 2 },
      cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
    },
    {
      accessorKey: 'description',
      header: t('incidents.column.description', 'Description'),
      meta: { priority: 3 },
      cell: ({ getValue }) => {
        const desc = getValue() as string
        return (
          <span className="line-clamp-2 max-w-[400px] text-sm">
            {desc.length > 120 ? desc.slice(0, 120) + '...' : desc}
          </span>
        )
      },
    },
    {
      accessorKey: 'reporter_id',
      header: t('incidents.column.reporter', 'Reporter'),
      meta: { priority: 4 },
      cell: ({ getValue }) => {
        const val = getValue() as string | null
        return val
          ? <span className="text-xs text-muted-foreground">{val.slice(0, 8)}...</span>
          : <span className="text-xs text-muted-foreground italic">Anonymous</span>
      },
    },
    {
      accessorKey: 'created_at',
      header: t('incidents.column.reported_at', 'Reported At'),
      meta: { priority: 5 },
      cell: ({ getValue }) => {
        const date = new Date(getValue() as string)
        return (
          <span className="text-xs text-muted-foreground">
            {date.toLocaleDateString()} {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        )
      },
    },
  ]
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function IncidentsPage() {
  const t = useT()
  const router = useRouter()
  const searchParams = useSearchParams()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'created_at', desc: true }])
  const [page, setPage] = React.useState(1)
  const [severityFilter, setSeverityFilter] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState('')
  const scopeVersion = useOrganizationScopeVersion()

  const competitionId = searchParams.get('competitionId') ?? ''

  // Live refresh via SSE events
  useAppEvent('incidents.report.*', () => {
    queryClient.invalidateQueries({ queryKey: ['incidents'] })
  }, [queryClient])

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: '50',
      sortField: sorting[0]?.id || 'created_at',
      sortDir: sorting[0]?.desc ? 'desc' : 'asc',
    })
    if (competitionId) params.set('competitionId', competitionId)
    if (severityFilter) params.set('severity', severityFilter)
    if (statusFilter) params.set('status', statusFilter)
    return params.toString()
  }, [page, sorting, competitionId, severityFilter, statusFilter])

  const columns = React.useMemo(() => buildColumns(t), [t])

  const { data, isLoading } = useQuery<IncidentsResponse>({
    queryKey: ['incidents', queryParams, scopeVersion],
    queryFn: async () => fetchCrudList<IncidentRow>('incidents/incidents', Object.fromEntries(new URLSearchParams(queryParams))),
  })

  // Inline resolve dialog
  const [resolvingId, setResolvingId] = React.useState<string | null>(null)
  const [resolutionDesc, setResolutionDesc] = React.useState('')
  const [resolveStatus, setResolveStatus] = React.useState<'RESOLVED' | 'DISMISSED'>('RESOLVED')
  const [resolving, setResolving] = React.useState(false)

  const handleResolve = async () => {
    if (!resolvingId || !resolutionDesc.trim()) return
    setResolving(true)
    try {
      await apiCall('/api/incidents/incidents/resolve', {
        method: 'POST',
        body: JSON.stringify({
          id: resolvingId,
          resolutionDescription: resolutionDesc.trim(),
          status: resolveStatus,
        }),
      })
      flash(t('incidents.flash.resolved', 'Incident resolved'), 'success')
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
      setResolvingId(null)
      setResolutionDesc('')
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to resolve incident', 'error')
    } finally {
      setResolving(false)
    }
  }

  // Count stats
  const totalOpen = data?.items?.filter((i) => i.status === 'REPORTED' || i.status === 'UNDER_REVIEW').length ?? 0
  const totalCritical = data?.items?.filter((i) => i.severity === 'CRITICAL' && i.status !== 'RESOLVED' && i.status !== 'DISMISSED').length ?? 0

  return (
    <Page>
      <PageBody>
      {/* Stats bar */}
      {data && (
        <div className="mb-4 flex gap-4 px-1">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t('incidents.stats.total', 'Total')}:</span>
            <span className="font-semibold">{data.total}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">{t('incidents.stats.open', 'Open')}:</span>
            <span className="font-semibold text-blue-600">{totalOpen}</span>
          </div>
          {totalCritical > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">{t('incidents.stats.critical', 'Critical')}:</span>
              <span className="font-semibold text-red-600">{totalCritical}</span>
            </div>
          )}
        </div>
      )}

      <DataTable
        title={t('incidents.title', 'Incidents')}
        actions={(
          <div className="flex items-center gap-2">
            <select
              value={severityFilter}
              onChange={(e) => { setSeverityFilter(e.target.value); setPage(1) }}
              className="rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">{t('incidents.filter.allSeverities', 'All severities')}</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setPage(1) }}
              className="rounded-md border px-2 py-1.5 text-sm"
            >
              <option value="">{t('incidents.filter.allStatuses', 'All statuses')}</option>
              <option value="REPORTED">Reported</option>
              <option value="UNDER_REVIEW">Under Review</option>
              <option value="RESOLVED">Resolved</option>
              <option value="DISMISSED">Dismissed</option>
            </select>
          </div>
        )}
        columns={columns}
        data={data?.items ?? []}
        sortable
        sorting={sorting}
        onSortingChange={(s) => { setSorting(s); setPage(1) }}
        onRowClick={(row) => {
          const params = competitionId ? `?competitionId=${competitionId}` : ''
          router.push(`/backend/incidents/${row.id}${params}`)
        }}
        rowActions={(row) => (
          <RowActions
            items={[
              {
                label: t('incidents.actions.view', 'View Details'),
                onSelect: () => {
                  const params = competitionId ? `?competitionId=${competitionId}` : ''
                  router.push(`/backend/incidents/${row.id}${params}`)
                },
              },
              ...(row.status === 'REPORTED' || row.status === 'UNDER_REVIEW'
                ? [{
                    label: t('incidents.actions.markUnderReview', 'Mark Under Review'),
                    onSelect: async () => {
                      try {
                        await apiCall('/api/incidents/incidents', {
                          method: 'PUT',
                          body: JSON.stringify({ id: row.id, status: 'UNDER_REVIEW' }),
                        })
                        flash('Status updated', 'success')
                        queryClient.invalidateQueries({ queryKey: ['incidents'] })
                      } catch (err) {
                        flash(err instanceof Error ? err.message : 'Failed', 'error')
                      }
                    },
                  }]
                : []),
              ...(row.status !== 'RESOLVED' && row.status !== 'DISMISSED'
                ? [{
                    label: t('incidents.actions.resolve', 'Resolve'),
                    onSelect: () => {
                      setResolvingId(row.id)
                      setResolutionDesc('')
                      setResolveStatus('RESOLVED')
                    },
                  }]
                : []),
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

      {/* Resolve Dialog */}
      {resolvingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-background rounded-lg border p-6 w-full max-w-md shadow-lg">
            <h2 className="text-lg font-semibold mb-4">
              {t('incidents.resolve.title', 'Resolve Incident')}
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('incidents.resolve.status', 'Resolution Status')}
                </label>
                <select
                  value={resolveStatus}
                  onChange={(e) => setResolveStatus(e.target.value as 'RESOLVED' | 'DISMISSED')}
                  className="w-full rounded-md border px-3 py-2 text-sm"
                >
                  <option value="RESOLVED">Resolved</option>
                  <option value="DISMISSED">Dismissed</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {t('incidents.resolve.description', 'Resolution Description')} *
                </label>
                <textarea
                  value={resolutionDesc}
                  onChange={(e) => setResolutionDesc(e.target.value)}
                  className="w-full rounded-md border px-3 py-2 text-sm min-h-[100px]"
                  placeholder={t('incidents.resolve.placeholder', 'Describe the resolution or reason for dismissal...')}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setResolvingId(null)}>
                {t('common.cancel', 'Cancel')}
              </Button>
              <Button onClick={handleResolve} disabled={resolving || !resolutionDesc.trim()}>
                {resolving ? t('common.saving', 'Saving...') : t('incidents.resolve.submit', 'Submit Resolution')}
              </Button>
            </div>
          </div>
        </div>
      )}
      {ConfirmDialogElement}
      </PageBody>
    </Page>
  )
}

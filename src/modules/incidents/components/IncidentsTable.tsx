"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { EnumBadge } from '@open-mercato/ui/backend/ValueIcons'
import { fetchCrudList, updateCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useRouter } from 'next/navigation'

type IncidentRow = {
  id: string; description: string; severity: string; status: string
  reporter_id: string | null; reported_user_id: string | null
  created_at: string; resolved_at: string | null
}

const severityPreset: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  low: { label: 'Low', variant: 'secondary' },
  medium: { label: 'Medium', variant: 'outline' },
  high: { label: 'High', variant: 'destructive' },
  critical: { label: 'Critical', variant: 'destructive' },
}

const statusPreset: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  reported: { label: 'Reported', variant: 'destructive' },
  under_review: { label: 'Under Review', variant: 'outline' },
  resolved: { label: 'Resolved', variant: 'default' },
  dismissed: { label: 'Dismissed', variant: 'secondary' },
}

export default function IncidentsTable() {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [page, setPage] = React.useState(1)
  const scopeVersion = useOrganizationScopeVersion()

  const { data, isLoading, error } = useQuery({
    queryKey: ['incidents', page, scopeVersion],
    queryFn: () => fetchCrudList<IncidentRow>('incidents/incidents', {
      page: String(page), pageSize: '50', sortField: 'created_at', sortDir: 'desc',
    }),
  })

  const columns = React.useMemo<ColumnDef<IncidentRow>[]>(() => [
    {
      accessorKey: 'description',
      header: t('incidents.table.description', 'Description'),
      meta: { priority: 1 },
      cell: ({ getValue }) => {
        const desc = String(getValue())
        return desc.length > 80 ? desc.substring(0, 80) + '...' : desc
      },
    },
    {
      accessorKey: 'severity',
      header: t('incidents.table.severity', 'Severity'),
      meta: { priority: 1 },
      cell: ({ getValue }) => <EnumBadge value={String(getValue())} map={severityPreset} />,
    },
    {
      accessorKey: 'status',
      header: t('incidents.table.status', 'Status'),
      meta: { priority: 2 },
      cell: ({ getValue }) => <EnumBadge value={String(getValue())} map={statusPreset} />,
    },
    {
      accessorKey: 'reporter_id',
      header: t('incidents.table.reporter', 'Reporter'),
      meta: { priority: 3 },
      cell: ({ getValue }) => getValue() ? String(getValue()).substring(0, 8) + '...' : <span className="italic text-muted-foreground">Anonymous</span>,
    },
    {
      accessorKey: 'created_at',
      header: t('incidents.table.createdAt', 'Reported'),
      meta: { priority: 2 },
      cell: ({ getValue }) => new Date(getValue() as string).toLocaleString(),
    },
  ], [t])

  if (error) return <div className="text-sm text-destructive">{t('incidents.table.error', 'Failed to load incidents')}</div>

  async function handleStatusChange(id: string, status: string) {
    try {
      await updateCrud('incidents/incidents', { id, status })
      flash(t('incidents.flash.updated', 'Incident updated'), 'success')
      queryClient.invalidateQueries({ queryKey: ['incidents'] })
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Error', 'error')
    }
  }

  return (
    <DataTable
      title={t('incidents.table.title', 'Incidents')}
      columns={columns}
      data={data?.items ?? []}
      isLoading={isLoading}
      rowActions={(row) => (
        <RowActions items={[
          { id: 'edit', label: t('incidents.table.manage', 'Manage'), href: `/backend/incidents/${row.id}/edit` },
          ...(row.status === 'reported' ? [{ id: 'review', label: t('incidents.table.startReview', 'Start Review'), onSelect: () => handleStatusChange(row.id, 'under_review') }] : []),
          ...(row.status !== 'resolved' && row.status !== 'dismissed' ? [
            { id: 'resolve', label: t('incidents.table.resolve', 'Resolve'), onSelect: () => handleStatusChange(row.id, 'resolved') },
            { id: 'dismiss', label: t('incidents.table.dismiss', 'Dismiss'), onSelect: () => handleStatusChange(row.id, 'dismissed') },
          ] : []),
        ]} />
      )}
      pagination={{
        page, pageSize: 50,
        total: data?.total || 0,
        totalPages: data?.totalPages || 0,
        onPageChange: setPage,
      }}
      onRowClick={(row) => router.push(`/backend/incidents/${row.id}/edit`)}
    />
  )
}

"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { EnumBadge } from '@open-mercato/ui/backend/ValueIcons'
import { Button } from '@open-mercato/ui/primitives/button'
import { fetchCrudList, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'

type ParticipationRow = {
  id: string
  competition_id: string
  customer_user_id: string
  role: string
  checked_in: boolean
  checked_in_at?: string | null
  badge_printed: boolean
  coc_accepted: boolean
  privacy_policy_accepted: boolean
  looking_for_team: boolean
  looking_for_team_description?: string | null
  profile_complete: boolean
  created_at?: string | null
}

type ParticipationsResponse = {
  items: ParticipationRow[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

const ROLE_SEVERITY: Record<string, 'info' | 'warning' | 'success' | 'error' | 'neutral'> = {
  participant: 'info',
  mentor: 'warning',
  judge: 'success',
}

function buildColumns(
  t: (key: string, fallback?: string) => string,
  onCheckin: (row: ParticipationRow) => void,
): ColumnDef<ParticipationRow>[] {
  return [
    {
      accessorKey: 'customer_user_id',
      header: t('competitions.participants.table.column.user', 'User ID'),
      meta: { priority: 1 },
    },
    {
      accessorKey: 'role',
      header: t('competitions.participants.table.column.role', 'Role'),
      meta: { priority: 2 },
      cell: ({ getValue }) => {
        const raw = getValue() as string
        return <EnumBadge value={raw} map={ROLE_SEVERITY} />
      },
    },
    {
      accessorKey: 'checked_in',
      header: t('competitions.participants.table.column.checkedIn', 'Checked In'),
      meta: { priority: 3 },
      cell: ({ getValue }) => {
        const val = getValue() as boolean
        return val ? '\u2705' : '\u2014'
      },
    },
    {
      accessorKey: 'coc_accepted',
      header: t('competitions.participants.table.column.cocAccepted', 'CoC Accepted'),
      meta: { priority: 4 },
      cell: ({ getValue }) => {
        const val = getValue() as boolean
        return val ? '\u2705' : '\u2014'
      },
    },
    {
      accessorKey: 'looking_for_team',
      header: t('competitions.participants.table.column.lookingForTeam', 'Looking for Team'),
      meta: { priority: 5 },
      cell: ({ getValue }) => {
        const val = getValue() as boolean
        return val ? 'Yes' : 'No'
      },
    },
    {
      accessorKey: 'created_at',
      header: t('competitions.participants.table.column.createdAt', 'Registered'),
      meta: { priority: 6 },
    },
  ]
}

export default function ParticipantsPage() {
  const t = useT()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const searchParams = useSearchParams()
  const competitionId = searchParams.get('competitionId') ?? ''
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'created_at', desc: true }])
  const [page, setPage] = React.useState(1)
  const [roleFilter, setRoleFilter] = React.useState('')
  const [checkedInFilter, setCheckedInFilter] = React.useState<string>('')
  const [cocFilter, setCocFilter] = React.useState<string>('')
  const scopeVersion = useOrganizationScopeVersion()

  const queryParams = React.useMemo(() => {
    const params = new URLSearchParams({
      page: page.toString(),
      pageSize: '50',
      sortField: sorting[0]?.id || 'created_at',
      sortDir: sorting[0]?.desc ? 'desc' : 'asc',
    })
    if (competitionId) params.set('competitionId', competitionId)
    if (roleFilter) params.set('role', roleFilter)
    if (checkedInFilter) params.set('checkedIn', checkedInFilter)
    if (cocFilter) params.set('cocAccepted', cocFilter)
    return params.toString()
  }, [page, sorting, competitionId, roleFilter, checkedInFilter, cocFilter])

  const handleCheckin = React.useCallback(async (row: ParticipationRow) => {
    try {
      await apiCall('/api/competitions/participations/checkin', {
        method: 'POST',
        body: JSON.stringify({ participationId: row.id }),
      })
      flash(t('competitions.participants.flash.checkedIn', 'Participant checked in'), 'success')
      queryClient.invalidateQueries({ queryKey: ['participations'] })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('competitions.participants.error.checkin', 'Failed to check in participant')
      flash(message, 'error')
    }
  }, [t, queryClient])

  const columns = React.useMemo(() => buildColumns(t, handleCheckin), [t, handleCheckin])

  const { data, isLoading, error } = useQuery<ParticipationsResponse>({
    queryKey: ['participations', queryParams, scopeVersion],
    queryFn: async () => fetchCrudList<ParticipationRow>('competitions/participations', Object.fromEntries(new URLSearchParams(queryParams))),
  })

  const handleSortingChange = (newSorting: SortingState) => {
    setSorting(newSorting)
    setPage(1)
  }

  if (error) {
    return <div className="text-sm text-destructive">{t('competitions.participants.table.error.generic', 'Failed to load participants')}</div>
  }

  const competitionParam = competitionId ? `?competitionId=${competitionId}` : ''

  return (
    <>
      <DataTable
        title={t('competitions.participants.table.title', 'Participants')}
        actions={(
          <div className="flex gap-2">
            <Button asChild>
              <Link href={`/backend/competitions/participants/create${competitionParam}`}>
                {t('competitions.participants.table.actions.create', 'Add participant')}
              </Link>
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
            id: 'role',
            label: t('competitions.participants.filter.role', 'Role'),
            type: 'select',
            options: [
              { label: t('competitions.participants.filter.role.all', 'All roles'), value: '' },
              { label: t('competitions.participants.filter.role.participant', 'Participant'), value: 'participant' },
              { label: t('competitions.participants.filter.role.mentor', 'Mentor'), value: 'mentor' },
              { label: t('competitions.participants.filter.role.judge', 'Judge'), value: 'judge' },
            ],
            value: roleFilter,
            onChange: (v: string) => { setRoleFilter(v); setPage(1) },
          },
          {
            id: 'checkedIn',
            label: t('competitions.participants.filter.checkedIn', 'Checked In'),
            type: 'select',
            options: [
              { label: t('competitions.participants.filter.all', 'All'), value: '' },
              { label: t('competitions.participants.filter.yes', 'Yes'), value: 'true' },
              { label: t('competitions.participants.filter.no', 'No'), value: 'false' },
            ],
            value: checkedInFilter,
            onChange: (v: string) => { setCheckedInFilter(v); setPage(1) },
          },
          {
            id: 'cocAccepted',
            label: t('competitions.participants.filter.cocAccepted', 'CoC Accepted'),
            type: 'select',
            options: [
              { label: t('competitions.participants.filter.all', 'All'), value: '' },
              { label: t('competitions.participants.filter.yes', 'Yes'), value: 'true' },
              { label: t('competitions.participants.filter.no', 'No'), value: 'false' },
            ],
            value: cocFilter,
            onChange: (v: string) => { setCocFilter(v); setPage(1) },
          },
        ]}
        rowActions={(row) => (
          <RowActions
            items={[
              ...(!row.checked_in
                ? [{
                    label: t('competitions.participants.table.actions.checkin', 'Check in'),
                    onSelect: async () => {
                      const confirmed = await confirm({
                        title: t('competitions.participants.confirm.checkin', 'Check in this participant?'),
                      })
                      if (confirmed) handleCheckin(row)
                    },
                  }]
                : []),
              {
                label: t('competitions.participants.table.actions.delete', 'Remove'),
                destructive: true,
                onSelect: async () => {
                  const confirmed = await confirm({
                    title: t('competitions.participants.confirm.delete', 'Remove this participant?'),
                    variant: 'destructive',
                  })
                  if (!confirmed) return
                  try {
                    await deleteCrud('competitions/participations', row.id)
                    flash(t('competitions.participants.flash.deleted', 'Participant removed'), 'success')
                    queryClient.invalidateQueries({ queryKey: ['participations'] })
                  } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : t('competitions.participants.error.delete', 'Failed to remove participant')
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

"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { DataTable } from '@open-mercato/ui/backend/DataTable'
import { RowActions } from '@open-mercato/ui/backend/RowActions'
import { BooleanIcon, EnumBadge } from '@open-mercato/ui/backend/ValueIcons'
import { Button } from '@open-mercato/ui/primitives/button'
import { fetchCrudList, deleteCrud } from '@open-mercato/ui/backend/utils/crud'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { FilterValues } from '@open-mercato/ui/backend/FilterBar'
import Link from 'next/link'

type ParticipationRow = {
  id: string
  competition_id: string
  customer_user_id: string
  role: string
  checked_in: boolean
  coc_accepted: boolean
  privacy_policy_accepted: boolean
  looking_for_team: boolean
  created_at: string
}

const rolePreset: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  participant: { label: 'Participant', variant: 'default' },
  mentor: { label: 'Mentor', variant: 'secondary' },
  judge: { label: 'Judge', variant: 'outline' },
}

export default function ParticipantsListPage() {
  const t = useT()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'created_at', desc: true }])
  const [page, setPage] = React.useState(1)
  const [filterValues, setFilterValues] = React.useState<FilterValues>({})
  const scopeVersion = useOrganizationScopeVersion()

  const queryParams = React.useMemo(() => {
    const params: Record<string, string> = {
      page: page.toString(),
      pageSize: '50',
      sortField: sorting[0]?.id || 'created_at',
      sortDir: sorting[0]?.desc ? 'desc' : 'asc',
    }
    if (filterValues.role && typeof filterValues.role === 'string') params.role = filterValues.role
    if (filterValues.checked_in === true || filterValues.checked_in === false) params.checked_in = String(filterValues.checked_in)
    return new URLSearchParams(params).toString()
  }, [page, sorting, filterValues])

  const { data, isLoading } = useQuery({
    queryKey: ['participations', queryParams, scopeVersion],
    queryFn: () => fetchCrudList<ParticipationRow>('competitions/participations', Object.fromEntries(new URLSearchParams(queryParams))),
  })

  const columns = React.useMemo<ColumnDef<ParticipationRow>[]>(() => [
    { accessorKey: 'customer_user_id', header: t('competitions.participants.userId', 'User ID'), meta: { priority: 1, truncate: true, maxWidth: 280 } },
    { accessorKey: 'competition_id', header: t('competitions.participants.competitionId', 'Competition'), meta: { priority: 5, truncate: true, maxWidth: 280 } },
    {
      accessorKey: 'role',
      header: t('competitions.participants.role', 'Role'),
      meta: { priority: 2 },
      cell: ({ getValue }) => <EnumBadge value={String(getValue())} map={rolePreset} />,
    },
    {
      accessorKey: 'checked_in',
      header: t('competitions.participants.checkedIn', 'Checked In'),
      meta: { priority: 3 },
      cell: ({ getValue }) => <BooleanIcon value={!!getValue()} />,
    },
    {
      accessorKey: 'coc_accepted',
      header: t('competitions.participants.cocAccepted', 'CoC'),
      meta: { priority: 4 },
      cell: ({ getValue }) => <BooleanIcon value={!!getValue()} />,
    },
  ], [t])

  return (
    <Page>
      <PageBody>
        <DataTable
          title={t('competitions.participants.title', 'Participants')}
          actions={
            <Button asChild>
              <Link href="/backend/competitions/participants/create">
                {t('competitions.participants.add', 'Add Participant')}
              </Link>
            </Button>
          }
          columns={columns}
          data={data?.items ?? []}
          sortable
          sorting={sorting}
          onSortingChange={(s) => { setSorting(s); setPage(1) }}
          filters={[
            {
              id: 'role',
              label: t('competitions.participants.filterRole', 'Role'),
              type: 'select',
              options: [
                { value: 'participant', label: 'Participant' },
                { value: 'mentor', label: 'Mentor' },
                { value: 'judge', label: 'Judge' },
              ],
            },
            { id: 'checked_in', label: t('competitions.participants.filterCheckedIn', 'Checked In'), type: 'checkbox' },
          ]}
          filterValues={filterValues}
          onFiltersApply={(vals: FilterValues) => { setFilterValues(vals); setPage(1) }}
          onFiltersClear={() => { setFilterValues({}); setPage(1) }}
          rowActions={(row) => (
            <RowActions
              items={[
                {
                  label: t('competitions.participants.remove', 'Remove'),
                  destructive: true,
                  onSelect: async () => {
                    const confirmed = await confirm({ title: t('competitions.participants.confirmRemove', 'Remove this participant?'), variant: 'destructive' })
                    if (!confirmed) return
                    try {
                      await deleteCrud('competitions/participations', row.id)
                      flash(t('competitions.participants.flash.removed', 'Participant removed'), 'success')
                      queryClient.invalidateQueries({ queryKey: ['participations'] })
                    } catch (err) {
                      flash(err instanceof Error ? err.message : t('competitions.participants.error.remove', 'Failed to remove participant'), 'error')
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
      </PageBody>
    </Page>
  )
}

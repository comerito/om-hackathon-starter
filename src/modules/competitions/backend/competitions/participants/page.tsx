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
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useOrganizationScopeVersion } from '@open-mercato/shared/lib/frontend/useOrganizationScope'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import type { FilterValues } from '@open-mercato/ui/backend/FilterBar'
import Link from 'next/link'
import { BulkInviteDialog } from '../../../components/BulkInviteDialog'

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

type InvitationRow = {
  id: string
  competition_id: string
  competition_name: string | null
  participation_role: string
  email: string
  display_name: string | null
  status: 'pending' | 'accepted' | 'expired' | 'cancelled'
  accepted_at: string | null
  expires_at: string | null
  created_at: string
}

const rolePreset: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  participant: { label: 'Participant', variant: 'default' },
  mentor: { label: 'Mentor', variant: 'secondary' },
  judge: { label: 'Judge', variant: 'outline' },
}

const invStatusPreset: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  pending: { label: 'Pending', variant: 'default' },
  accepted: { label: 'Accepted', variant: 'secondary' },
  expired: { label: 'Expired', variant: 'outline' },
  cancelled: { label: 'Cancelled', variant: 'destructive' },
}

export default function ParticipantsListPage() {
  const t = useT()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'role', desc: false }])
  const [page, setPage] = React.useState(1)
  const [filterValues, setFilterValues] = React.useState<FilterValues>({})
  const [showBulkInvite, setShowBulkInvite] = React.useState(false)
  const [tab, setTab] = React.useState<'participants' | 'invitations'>('participants')
  const scopeVersion = useOrganizationScopeVersion()

  const queryParams = React.useMemo(() => {
    const params: Record<string, string> = {
      page: page.toString(),
      pageSize: '50',
      sortField: sorting[0]?.id || 'role',
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

  // Resolve customer user display names
  const userIds = React.useMemo(() => {
    const ids = new Set<string>()
    for (const item of data?.items ?? []) ids.add(item.customer_user_id)
    return [...ids]
  }, [data])

  const { data: usersData } = useQuery({
    queryKey: ['customer-users-lookup', userIds],
    queryFn: async () => {
      if (userIds.length === 0) return new Map<string, string>()
      const { ok, result } = await apiCall<{ items: Array<{ id: string; display_name: string; email: string }> }>(
        `/api/customer_accounts/admin/users?pageSize=100&ids=${userIds.join(',')}`,
      )
      const map = new Map<string, string>()
      if (ok && result?.items) {
        for (const u of result.items) map.set(u.id, u.display_name || u.email || u.id.slice(0, 8))
      }
      return map
    },
    enabled: userIds.length > 0,
  })
  const userNameMap = usersData ?? new Map<string, string>()

  // Resolve competition names
  const competitionIds = React.useMemo(() => {
    const ids = new Set<string>()
    for (const item of data?.items ?? []) ids.add(item.competition_id)
    return [...ids]
  }, [data])

  const { data: competitionsData } = useQuery({
    queryKey: ['competitions-lookup', competitionIds],
    queryFn: async () => {
      const map = new Map<string, string>()
      for (const cid of competitionIds) {
        const res = await fetchCrudList<{ id: string; name: string }>('competitions/competitions', { id: cid, pageSize: '1' })
        const item = res?.items?.[0]
        if (item) map.set(item.id, item.name)
      }
      return map
    },
    enabled: competitionIds.length > 0,
  })
  const competitionNameMap = competitionsData ?? new Map<string, string>()

  // Invitations query
  const { data: invitationsData, isLoading: invitationsLoading } = useQuery({
    queryKey: ['competition-invitations-list', scopeVersion],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ items: InvitationRow[] }>(
        '/api/competitions/admin/invitations?status=all',
      )
      return ok ? result?.items ?? [] : []
    },
    enabled: tab === 'invitations',
  })

  const invitationColumns = React.useMemo<ColumnDef<InvitationRow>[]>(() => [
    { accessorKey: 'email', header: 'Email', meta: { priority: 1 } },
    { accessorKey: 'display_name', header: 'Name', meta: { priority: 2 }, cell: ({ getValue }) => getValue() || '—' },
    { accessorKey: 'competition_name', header: 'Competition', meta: { priority: 5 }, cell: ({ getValue }) => getValue() || '—' },
    { accessorKey: 'participation_role', header: 'Role', meta: { priority: 2 }, cell: ({ getValue }) => <EnumBadge value={String(getValue())} map={rolePreset} /> },
    { accessorKey: 'status', header: 'Status', meta: { priority: 1 }, cell: ({ getValue }) => <EnumBadge value={String(getValue())} map={invStatusPreset} /> },
    { accessorKey: 'created_at', header: 'Sent', meta: { priority: 3 }, cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString() },
  ], [])

  const columns = React.useMemo<ColumnDef<ParticipationRow>[]>(() => [
    {
      accessorKey: 'customer_user_id',
      header: t('competitions.participants.participant', 'Participant'),
      meta: { priority: 1 },
      cell: ({ getValue }) => {
        const id = String(getValue())
        const name = userNameMap.get(id)
        return name ?? id.slice(0, 12) + '...'
      },
    },
    {
      accessorKey: 'competition_id',
      header: t('competitions.participants.competition', 'Competition'),
      meta: { priority: 5 },
      cell: ({ getValue }) => {
        const id = String(getValue())
        return competitionNameMap.get(id) ?? id.slice(0, 12) + '...'
      },
    },
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
  ], [t, userNameMap, competitionNameMap])

  // Count pending invitations for tab badge
  const pendingCount = (invitationsData ?? []).filter(i => i.status === 'pending').length

  return (
    <Page>
      <PageBody>
        {/* Actions bar */}
        <div className="flex items-center justify-between mb-4">
          <div />
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/backend/competitions/email-preview">
                {t('competitions.participants.previewEmail', 'Preview Email')}
              </Link>
            </Button>
            <Button variant="outline" onClick={() => setShowBulkInvite(true)}>
              {t('competitions.participants.bulkInvite', 'Bulk Invite')}
            </Button>
            <Button asChild>
              <Link href="/backend/competitions/participants/create">
                {t('competitions.participants.add', 'Add Participant')}
              </Link>
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 border-b mb-4">
          <button
            onClick={() => setTab('participants')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'participants' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t('competitions.participants.tabParticipants', 'Participants')}
            {data?.total ? <span className="ml-1.5 text-xs text-muted-foreground">({data.total})</span> : null}
          </button>
          <button
            onClick={() => setTab('invitations')}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === 'invitations' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            {t('competitions.participants.tabInvitations', 'Invitations')}
            {pendingCount > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">{pendingCount}</span>
            )}
          </button>
        </div>

        {/* Participants tab */}
        {tab === 'participants' && (
          <DataTable
            title={t('competitions.participants.title', 'Participants')}
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
                    id: 'view',
                    label: t('common.view', 'View'),
                    onSelect: () => { window.location.href = `/backend/competitions/participants/${row.id}` },
                  },
                  {
                    id: 'remove',
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
        )}

        {/* Invitations tab */}
        {tab === 'invitations' && (
          <DataTable
            title={t('competitions.participants.invitationsTitle', 'Sent Invitations')}
            columns={invitationColumns}
            data={invitationsData ?? []}
            isLoading={invitationsLoading}
            rowActions={(row) => {
              const isPending = row.status === 'pending'
              const isExpired = row.status === 'expired'
              if (!isPending && !isExpired) return null
              return (
                <RowActions
                  items={[
                    {
                      id: 'resend',
                      label: isExpired ? 'Resend (New Token)' : 'Resend Email',
                      onSelect: async () => {
                        const { ok } = await apiCall('/api/competitions/admin/resend-invitation', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ competition_invitation_id: row.id }),
                        })
                        if (ok) {
                          flash(`Invitation resent to ${row.email}`, 'success')
                          queryClient.invalidateQueries({ queryKey: ['competition-invitations-list'] })
                        } else {
                          flash('Failed to resend', 'error')
                        }
                      },
                    },
                  ]}
                />
              )
            }}
          />
        )}

        {ConfirmDialogElement}
        {showBulkInvite && <BulkInviteDialog onClose={() => { setShowBulkInvite(false); queryClient.invalidateQueries({ queryKey: ['participations', 'competition-invitations-list'] }) }} />}
      </PageBody>
    </Page>
  )
}

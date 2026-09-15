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
import { useCompetitionScope } from '@/lib/competition-scope'
import { BulkInviteDialog } from '../../../components/BulkInviteDialog'
import { ManualInviteDialog } from '../../../components/ManualInviteDialog'
import {
  buildSandboxInvitePayload,
  formatSentMarker,
  prepareSandboxBulkInvite,
  sandboxInviteFlashKind,
  type SandboxInviteSummary,
} from '../../../lib/sandboxInvitations'

type ParticipationRow = {
  id: string
  competition_id: string
  customer_user_id: string
  role: string
  checked_in: boolean
  coc_accepted: boolean
  privacy_policy_accepted: boolean
  looking_for_team: boolean
  discord_nick: string | null
  mercato_sandboxes_invited_at: string | null
  organization_id: string
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

type InviteResponse = SandboxInviteSummary & {
  ok?: boolean
  error?: string
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
  const [showManualInvite, setShowManualInvite] = React.useState(false)
  const [tab, setTab] = React.useState<'participants' | 'invitations'>('participants')
  const [invFilterValues, setInvFilterValues] = React.useState<FilterValues>({})
  const scopeVersion = useOrganizationScopeVersion()
  const { competitionId: scopedCompetitionId, ready: scopeReady } = useCompetitionScope()

  const queryParams = React.useMemo(() => {
    const params: Record<string, string> = {
      page: page.toString(),
      pageSize: '50',
      sortField: sorting[0]?.id || 'role',
      sortDir: sorting[0]?.desc ? 'desc' : 'asc',
    }
    if (filterValues.role && typeof filterValues.role === 'string') params.role = filterValues.role
    // Global header scope wins over the per-page filter, which is hidden while scoped.
    if (scopedCompetitionId) params.competition_id = scopedCompetitionId
    else if (filterValues.competition_id && typeof filterValues.competition_id === 'string') params.competition_id = filterValues.competition_id
    if (filterValues.checked_in === true || filterValues.checked_in === false) params.checked_in = String(filterValues.checked_in)
    if (filterValues.coc_accepted === true || filterValues.coc_accepted === false) params.coc_accepted = String(filterValues.coc_accepted)
    if (filterValues.has_discord && typeof filterValues.has_discord === 'string') params.has_discord = filterValues.has_discord
    return new URLSearchParams(params).toString()
  }, [page, sorting, filterValues, scopedCompetitionId])

  const { data, isLoading } = useQuery({
    queryKey: ['participations', queryParams, scopeVersion],
    queryFn: () => fetchCrudList<ParticipationRow>('competitions/participations', Object.fromEntries(new URLSearchParams(queryParams))),
    enabled: scopeReady,
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
      if (userIds.length === 0) return new Map<string, { name: string | null; email: string }>()
      const { ok, result } = await apiCall<{ items: Array<{ id: string; displayName: string; email: string }> }>(
        `/api/competitions/admin/customer-users?ids=${userIds.join(',')}`,
      )
      const map = new Map<string, { name: string | null; email: string }>()
      if (ok && result?.items) {
        for (const u of result.items) map.set(u.id, { name: u.displayName || null, email: u.email })
      }
      return map
    },
    enabled: userIds.length > 0,
  })
  const userNameMap = usersData ?? new Map<string, { name: string | null; email: string }>()

  // Load all competitions (used for both name resolution and the filter dropdown)
  const { data: competitionsData } = useQuery({
    queryKey: ['competitions-all', scopeVersion],
    queryFn: async () => {
      const res = await fetchCrudList<{ id: string; name: string }>('competitions/competitions', { pageSize: '100' })
      const map = new Map<string, string>()
      for (const c of res?.items ?? []) map.set(c.id, c.name)
      return map
    },
  })
  const competitionNameMap = competitionsData ?? new Map<string, string>()
  const competitionOptions = React.useMemo(() =>
    [...competitionNameMap.entries()].map(([value, label]) => ({ value, label })),
    [competitionNameMap],
  )

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

  const filteredInvitations = React.useMemo(() => {
    let items = invitationsData ?? []
    if (scopedCompetitionId) items = items.filter(i => i.competition_id === scopedCompetitionId)
    if (invFilterValues.status && typeof invFilterValues.status === 'string') {
      items = items.filter(i => i.status === invFilterValues.status)
    }
    if (invFilterValues.competition_id && typeof invFilterValues.competition_id === 'string') {
      items = items.filter(i => i.competition_id === invFilterValues.competition_id)
    }
    if (invFilterValues.participation_role && typeof invFilterValues.participation_role === 'string') {
      items = items.filter(i => i.participation_role === invFilterValues.participation_role)
    }
    return items
  }, [invitationsData, invFilterValues, scopedCompetitionId])

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
        const user = userNameMap.get(id)
        return user?.email ?? id
      },
    },
    {
      id: 'name',
      header: t('competitions.participants.name', 'Name'),
      meta: { priority: 2 },
      cell: ({ row }) => {
        const user = userNameMap.get(row.original.customer_user_id)
        return user?.name ?? '—'
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
    {
      accessorKey: 'discord_nick',
      header: t('competitions.participants.discord', 'Discord'),
      meta: { priority: 4 },
      cell: ({ getValue }) => {
        const nick = getValue() as string | null
        return nick || <span className="text-muted-foreground">—</span>
      },
    },
    {
      accessorKey: 'mercato_sandboxes_invited_at',
      header: t('competitions.participants.sandboxInvite.column', 'Mercato Sandboxes'),
      meta: { priority: 3 },
      cell: ({ getValue }) => {
        const sent = formatSentMarker(getValue() as string | null)
        if (!sent) return <span className="text-muted-foreground">—</span>
        return t('competitions.participants.sandboxInvite.sent', 'Sent: {timestamp}', { timestamp: sent })
      },
    },
  ], [t, userNameMap, competitionNameMap])

  const handleSandboxBulkInvite = React.useCallback(async (selectedRows: ParticipationRow[]) => {
    const prepared = prepareSandboxBulkInvite(selectedRows)
    if (!prepared.ok) {
      if (prepared.reason === 'mixed-competition') {
        flash(
          t(
            'competitions.participants.sandboxInvite.mixedCompetition',
            'Select participants from one competition only.',
          ),
          'error',
        )
      } else if (prepared.reason === 'already-sent-only') {
        flash(
          t(
            'competitions.participants.sandboxInvite.alreadySent',
            'The selected participants were already invited.',
          ),
          'error',
        )
      }
      return false
    }

    const confirmed = await confirm({
      title: t(
        'competitions.participants.sandboxInvite.confirmTitle',
        'Invite selected participants to Mercato Sandboxes?',
      ),
      description: t(
        'competitions.participants.sandboxInvite.confirmText',
        'This sends {count} invitation(s) through Mercato Sandboxes. Already-sent rows in this selection are skipped.',
        { count: prepared.participationIds.length },
      ),
      confirmText: t('competitions.participants.sandboxInvite.confirmAction', 'Send invitations'),
    })
    if (!confirmed) return false

    const { ok, result } = await apiCall<InviteResponse>(
      '/api/competitions/admin/sandbox-invitations',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSandboxInvitePayload(prepared.competitionId, prepared.participationIds)),
      },
    )
    if (!ok || !result || typeof result.sent !== 'number') {
      flash(
        result?.error
          || t('competitions.participants.sandboxInvite.error', 'Failed to send Mercato Sandboxes invitations'),
        'error',
      )
      return false
    }

    const kind = sandboxInviteFlashKind(result)
    if (kind === 'success') {
      flash(
        t(
          'competitions.participants.sandboxInvite.flash.complete',
          'Sent {count} Mercato Sandboxes invitation(s)',
          { count: result.sent },
        ),
        'success',
      )
    } else if (kind === 'warning') {
      flash(
        t(
          'competitions.participants.sandboxInvite.flash.partial',
          'Sent {sent}, {conflicts} conflict(s), {failed} failed',
          { sent: result.sent, conflicts: result.conflicts, failed: result.failed },
        ),
        'warning',
      )
    } else {
      flash(
        t(
          'competitions.participants.sandboxInvite.flash.none',
          'No invitations were sent ({conflicts} conflict(s), {failed} failed)',
          { conflicts: result.conflicts, failed: result.failed },
        ),
        'error',
      )
    }
    await queryClient.invalidateQueries({ queryKey: ['participations'] })
  }, [confirm, queryClient, t])

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
            <Button variant="outline" onClick={() => setShowManualInvite(true)}>
              {t('competitions.participants.invite', 'Invite')}
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
            selectionScopeKey={
              scopedCompetitionId
              || (typeof filterValues.competition_id === 'string' ? filterValues.competition_id : 'all')
            }
            bulkActions={[
              {
                id: 'invite-mercato-sandboxes',
                label: t('competitions.participants.sandboxInvite.action', 'Invite to Mercato Sandboxes'),
                onExecute: handleSandboxBulkInvite,
              },
            ]}
            filters={[
              ...(scopedCompetitionId ? [] : [{
                id: 'competition_id',
                label: t('competitions.participants.filterCompetition', 'Competition'),
                type: 'select' as const,
                options: competitionOptions,
              }]),
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
              { id: 'coc_accepted', label: t('competitions.participants.filterCoC', 'CoC Accepted'), type: 'checkbox' },
              {
                id: 'has_discord',
                label: t('competitions.participants.filterDiscord', 'Discord'),
                type: 'select',
                options: [
                  { value: 'true', label: t('competitions.participants.filterDiscordSet', 'Has Discord') },
                  { value: 'false', label: t('competitions.participants.filterDiscordNotSet', 'No Discord') },
                ],
              },
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
            isLoading={isLoading || !scopeReady}
          />
        )}

        {/* Invitations tab */}
        {tab === 'invitations' && (
          <DataTable
            title={t('competitions.participants.invitationsTitle', 'Sent Invitations')}
            columns={invitationColumns}
            data={filteredInvitations}
            isLoading={invitationsLoading}
            filters={[
              {
                id: 'status',
                label: t('competitions.participants.filterInvStatus', 'Status'),
                type: 'select',
                options: [
                  { value: 'pending', label: 'Pending' },
                  { value: 'accepted', label: 'Accepted' },
                  { value: 'expired', label: 'Expired' },
                  { value: 'cancelled', label: 'Cancelled' },
                ],
              },
              ...(scopedCompetitionId ? [] : [{
                id: 'competition_id',
                label: t('competitions.participants.filterInvCompetition', 'Competition'),
                type: 'select' as const,
                options: competitionOptions,
              }]),
              {
                id: 'participation_role',
                label: t('competitions.participants.filterInvRole', 'Role'),
                type: 'select',
                options: [
                  { value: 'participant', label: 'Participant' },
                  { value: 'mentor', label: 'Mentor' },
                  { value: 'judge', label: 'Judge' },
                ],
              },
            ]}
            filterValues={invFilterValues}
            onFiltersApply={(vals: FilterValues) => setInvFilterValues(vals)}
            onFiltersClear={() => setInvFilterValues({})}
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
                        const { ok, result } = await apiCall<{ emailSent?: boolean; emailError?: string }>(
                          '/api/competitions/admin/resend-invitation',
                          {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ competition_invitation_id: row.id }),
                          },
                        )
                        if (ok && result?.emailSent === false) {
                          // The invitation was renewed and committed; only delivery failed.
                          flash(
                            t(
                              'competitions.participants.resend.emailFailed',
                              'Invitation for {email} was renewed, but the email could not be sent: {reason}',
                              { email: row.email ?? '', reason: result.emailError ?? '' },
                            ),
                            'warning',
                          )
                          queryClient.invalidateQueries({ queryKey: ['competition-invitations-list'] })
                        } else if (ok) {
                          flash(
                            t('competitions.participants.resend.sent', 'Invitation resent to {email}', { email: row.email ?? '' }),
                            'success',
                          )
                          queryClient.invalidateQueries({ queryKey: ['competition-invitations-list'] })
                        } else {
                          flash(t('competitions.participants.resend.failed', 'Failed to resend'), 'error')
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
        {showManualInvite && <ManualInviteDialog onClose={() => { setShowManualInvite(false); queryClient.invalidateQueries({ queryKey: ['participations', 'competition-invitations-list'] }) }} />}
      </PageBody>
    </Page>
  )
}

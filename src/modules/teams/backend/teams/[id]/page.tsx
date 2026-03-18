"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Button } from '@open-mercato/ui/primitives/button'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { useConfirmDialog } from '@open-mercato/ui/backend/confirm-dialog'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TeamRow = {
  id: string
  competition_id: string
  track_id: string | null
  name: string
  description: string | null
  avatar_url: string | null
  status: string
  is_finalist: boolean
  table_number: number | null
  table_location: string | null
  presentation_order: number | null
  is_active: boolean
  created_at: string
  updated_at: string
}

type MemberRow = {
  id: string
  teamId: string
  customerUserId: string
  role: string
  joinedAt: string
}

type InvitationRow = {
  id: string
  teamId: string
  inviterId: string
  inviteeId: string
  type: string
  status: string
  message: string | null
  createdAt: string
  expiresAt: string
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  DISQUALIFIED: 'bg-red-100 text-red-800',
  WITHDRAWN: 'bg-gray-100 text-gray-800',
}

function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-800'
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${colors}`}>
      {status}
    </span>
  )
}

const INVITATION_STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  DECLINED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-gray-100 text-gray-600',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function TeamDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const router = useRouter()
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialogElement } = useConfirmDialog()
  const id = params?.id

  // Fetch team
  const { data: teamData, isLoading: teamLoading } = useQuery({
    queryKey: ['team-detail', id],
    queryFn: async () => {
      const res = await fetchCrudList<TeamRow>('teams/teams', { id: id!, pageSize: '1' })
      return res?.items?.[0] ?? null
    },
    enabled: !!id,
  })

  // Fetch members
  const { data: membersData } = useQuery({
    queryKey: ['team-members', id],
    queryFn: async () => {
      const res = await apiCall(`/api/teams/invitations?teamId=${id}&pageSize=100`)
      // Members come from a different source — use knex query via API
      // For now, use invitations endpoint to show invitation data
      return (res?.data ?? []) as InvitationRow[]
    },
    enabled: !!id,
  })

  // Fetch invitations
  const { data: invitationsData } = useQuery({
    queryKey: ['team-invitations', id],
    queryFn: async () => {
      const res = await apiCall(`/api/teams/invitations?teamId=${id}&pageSize=100`)
      return (res?.data ?? []) as InvitationRow[]
    },
    enabled: !!id,
  })

  const team = teamData ?? null

  const handleDisqualify = async () => {
    if (!team) return
    const reason = window.prompt(t('teams.detail.prompt.disqualifyReason', 'Reason for disqualification:'))
    if (!reason) return
    try {
      await apiCall('/api/teams/teams/disqualify', {
        method: 'POST',
        body: JSON.stringify({ teamId: team.id, reason }),
      })
      flash(t('teams.flash.disqualified', 'Team disqualified'), 'success')
      queryClient.invalidateQueries({ queryKey: ['team-detail', id] })
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to disqualify', 'error')
    }
  }

  const handleReactivate = async () => {
    if (!team) return
    try {
      await apiCall('/api/teams/teams/reactivate', {
        method: 'POST',
        body: JSON.stringify({ teamId: team.id }),
      })
      flash(t('teams.flash.reactivated', 'Team reactivated'), 'success')
      queryClient.invalidateQueries({ queryKey: ['team-detail', id] })
    } catch (err) {
      flash(err instanceof Error ? err.message : 'Failed to reactivate', 'error')
    }
  }

  if (!id) return null

  if (teamLoading) {
    return (
      <Page>
        <PageBody>
          <div className="flex items-center justify-center py-20">
            <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
          </div>
        </PageBody>
      </Page>
    )
  }

  if (!team) {
    return (
      <Page>
        <PageBody>
          <div className="text-red-600">{t('teams.detail.notFound', 'Team not found')}</div>
        </PageBody>
      </Page>
    )
  }

  return (
    <Page>
      <PageBody>
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <Link href={`/backend/teams?competitionId=${team.competition_id}`} className="text-sm text-muted-foreground hover:underline">
                {t('teams.detail.backToTeams', 'Teams')}
              </Link>
            </div>
            <h1 className="text-2xl font-bold">{team.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <StatusBadge status={team.status} />
              {team.is_finalist && (
                <span className="inline-flex items-center rounded-full bg-yellow-100 text-yellow-800 px-2 py-0.5 text-xs font-medium">
                  Finalist
                </span>
              )}
              {team.table_number != null && (
                <span className="text-sm text-muted-foreground">Table #{team.table_number}</span>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            {team.status === 'ACTIVE' && (
              <Button variant="destructive" size="sm" onClick={handleDisqualify}>
                {t('teams.detail.actions.disqualify', 'Disqualify')}
              </Button>
            )}
            {team.status !== 'ACTIVE' && (
              <Button variant="outline" size="sm" onClick={handleReactivate}>
                {t('teams.detail.actions.reactivate', 'Reactivate')}
              </Button>
            )}
          </div>
        </div>

        {/* Description */}
        {team.description && (
          <div className="mb-6 rounded-lg border p-4">
            <h3 className="text-sm font-medium mb-1">{t('teams.detail.description', 'Description')}</h3>
            <p className="text-sm text-muted-foreground">{team.description}</p>
          </div>
        )}

        {/* Info grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground mb-1">{t('teams.detail.trackId', 'Track')}</div>
            <div className="text-sm font-medium">{team.track_id ? team.track_id.slice(0, 8) + '...' : '-'}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground mb-1">{t('teams.detail.tableLocation', 'Location')}</div>
            <div className="text-sm font-medium">{team.table_location ?? '-'}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground mb-1">{t('teams.detail.presentationOrder', 'Presentation Order')}</div>
            <div className="text-sm font-medium">{team.presentation_order ?? '-'}</div>
          </div>
          <div className="rounded-lg border p-4">
            <div className="text-xs text-muted-foreground mb-1">{t('teams.detail.created', 'Created')}</div>
            <div className="text-sm font-medium">{new Date(team.created_at).toLocaleDateString()}</div>
          </div>
        </div>

        {/* Invitations */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">{t('teams.detail.invitations', 'Invitations')}</h2>
          {invitationsData && invitationsData.length > 0 ? (
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">{t('teams.detail.invitation.type', 'Type')}</th>
                    <th className="px-4 py-2 text-left font-medium">{t('teams.detail.invitation.invitee', 'Invitee')}</th>
                    <th className="px-4 py-2 text-left font-medium">{t('teams.detail.invitation.status', 'Status')}</th>
                    <th className="px-4 py-2 text-left font-medium">{t('teams.detail.invitation.created', 'Created')}</th>
                    <th className="px-4 py-2 text-left font-medium">{t('teams.detail.invitation.expires', 'Expires')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {invitationsData.map((inv) => (
                    <tr key={inv.id}>
                      <td className="px-4 py-2">
                        <span className="text-xs font-medium">{inv.type}</span>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">{inv.inviteeId.slice(0, 8)}...</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${INVITATION_STATUS_COLORS[inv.status] ?? 'bg-gray-100'}`}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-xs">{new Date(inv.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-2 text-xs">{new Date(inv.expiresAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('teams.detail.noInvitations', 'No invitations')}</p>
          )}
        </div>

        {ConfirmDialogElement}
      </PageBody>
    </Page>
  )
}

"use client"
import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Page, PageBody } from '@open-mercato/ui/backend/Page'
import { Button } from '@open-mercato/ui/primitives/button'
import { EnumBadge, BooleanIcon } from '@open-mercato/ui/backend/ValueIcons'
import { fetchCrudList } from '@open-mercato/ui/backend/utils/crud'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import Link from 'next/link'

const rolePreset: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  participant: { label: 'Participant', variant: 'default' },
  mentor: { label: 'Mentor', variant: 'secondary' },
  judge: { label: 'Judge', variant: 'outline' },
}

type Participation = {
  id: string; competition_id: string; customer_user_id: string; role: string
  checked_in: boolean; checked_in_at: string | null; coc_accepted: boolean
  privacy_policy_accepted: boolean; profile_complete: boolean; looking_for_team: boolean
  created_at: string
}

type CompetitionInvite = {
  id: string; customer_invitation_id: string; competition_id: string
  participation_role: string; created_at: string
  _invitation?: {
    email: string; display_name: string | null
    accepted_at: string | null; cancelled_at: string | null; expires_at: string
  }
}

export default function ParticipantDetailPage({ params }: { params?: { id?: string } }) {
  const t = useT()
  const queryClient = useQueryClient()
  const id = params?.id

  // Fetch participation
  const { data: participationData, isLoading } = useQuery({
    queryKey: ['participation-detail', id],
    queryFn: async () => {
      if (!id) return null
      const res = await fetchCrudList<Participation>('competitions/participations', { id, pageSize: '1' })
      return res?.items?.[0] ?? null
    },
    enabled: !!id,
  })

  // Fetch user display name
  const userId = participationData?.customer_user_id
  const { data: userData } = useQuery({
    queryKey: ['customer-user-detail', userId],
    queryFn: async () => {
      if (!userId) return null
      const { ok, result } = await apiCall<{ items: Array<{ id: string; display_name: string; email: string }> }>(
        `/api/customer_accounts/admin/users?ids=${userId}&pageSize=1`,
      )
      return ok ? result?.items?.[0] ?? null : null
    },
    enabled: !!userId,
  })

  // Fetch competition name
  const competitionId = participationData?.competition_id
  const { data: competitionData } = useQuery({
    queryKey: ['competition-detail', competitionId],
    queryFn: async () => {
      if (!competitionId) return null
      const res = await fetchCrudList<{ id: string; name: string }>('competitions/competitions', { id: competitionId, pageSize: '1' })
      return res?.items?.[0] ?? null
    },
    enabled: !!competitionId,
  })

  // Fetch competition invitations for this user
  const { data: invitationsData, isLoading: invitationsLoading } = useQuery({
    queryKey: ['competition-invitations', userId, competitionId],
    queryFn: async () => {
      if (!userId || !competitionId) return []
      const { ok, result } = await apiCall<{ items: CompetitionInvite[] }>(
        `/api/competitions/admin/participant-invitations?customer_user_id=${userId}&competition_id=${competitionId}`,
      )
      return ok ? result?.items ?? [] : []
    },
    enabled: !!userId && !!competitionId,
  })

  const [resending, setResending] = React.useState<string | null>(null)

  async function handleResend(invitationId: string, email: string) {
    setResending(invitationId)
    const { ok } = await apiCall('/api/competitions/admin/resend-invitation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ competition_invitation_id: invitationId }),
    })
    setResending(null)
    if (ok) {
      flash(`Invitation resent to ${email}`, 'success')
    } else {
      flash('Failed to resend invitation', 'error')
    }
  }

  if (!id) return null

  if (isLoading) {
    return <Page><PageBody><p className="text-sm text-muted-foreground">Loading...</p></PageBody></Page>
  }

  if (!participationData) {
    return <Page><PageBody><p className="text-sm text-portal-danger">Participation not found</p></PageBody></Page>
  }

  const displayName = userData?.display_name || userData?.email || participationData.customer_user_id.slice(0, 12)

  return (
    <Page>
      <PageBody>
        {/* Header */}
        <div className="mb-6">
          <Link href="/backend/competitions/participants" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            &larr; Back to Participants
          </Link>
          <div className="mt-3 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
              {displayName.split(/\s+/).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold">{displayName}</h1>
              {userData?.email && <p className="text-sm text-muted-foreground">{userData.email}</p>}
            </div>
            <EnumBadge value={participationData.role} map={rolePreset} />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Participation Info */}
          <div className="rounded-lg border bg-background p-5 space-y-4">
            <h3 className="text-sm font-semibold">Participation Details</h3>
            <div className="divide-y text-sm">
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Competition</span>
                <span className="font-medium">{competitionData?.name ?? participationData.competition_id.slice(0, 12)}</span>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Role</span>
                <EnumBadge value={participationData.role} map={rolePreset} />
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Checked In</span>
                <BooleanIcon value={participationData.checked_in} />
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Code of Conduct</span>
                <BooleanIcon value={participationData.coc_accepted} />
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Privacy Policy</span>
                <BooleanIcon value={participationData.privacy_policy_accepted} />
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Looking for Team</span>
                <BooleanIcon value={participationData.looking_for_team} />
              </div>
              <div className="flex items-center justify-between py-2.5">
                <span className="text-muted-foreground">Joined</span>
                <span className="text-xs">{new Date(participationData.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Invitations */}
          <div className="rounded-lg border bg-background p-5 space-y-4">
            <h3 className="text-sm font-semibold">Invitations</h3>
            {invitationsLoading ? (
              <p className="text-sm text-muted-foreground">Loading invitations...</p>
            ) : !invitationsData || invitationsData.length === 0 ? (
              <p className="text-sm text-muted-foreground">No invitations found for this participant. They may have registered directly.</p>
            ) : (
              <div className="space-y-3">
                {invitationsData.map((inv) => {
                  const invitation = inv._invitation
                  const isAccepted = !!invitation?.accepted_at
                  const isCancelled = !!invitation?.cancelled_at
                  const isExpired = invitation?.expires_at ? new Date(invitation.expires_at).getTime() < Date.now() : false
                  const isPending = !isAccepted && !isCancelled && !isExpired

                  let statusLabel = 'Unknown'
                  let statusColor = 'bg-gray-100 text-gray-600'
                  if (isAccepted) { statusLabel = 'Accepted'; statusColor = 'bg-portal-success/10 text-portal-success' }
                  else if (isCancelled) { statusLabel = 'Cancelled'; statusColor = 'bg-gray-100 text-gray-500' }
                  else if (isExpired) { statusLabel = 'Expired'; statusColor = 'bg-amber-50 text-amber-700' }
                  else if (isPending) { statusLabel = 'Pending'; statusColor = 'bg-blue-50 text-blue-700' }

                  return (
                    <div key={inv.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{invitation?.email ?? 'Unknown email'}</span>
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${statusColor}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <EnumBadge value={inv.participation_role} map={rolePreset} />
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>Sent: {new Date(inv.created_at).toLocaleString()}</span>
                        {invitation?.expires_at && (
                          <span>Expires: {new Date(invitation.expires_at).toLocaleString()}</span>
                        )}
                        {invitation?.accepted_at && (
                          <span>Accepted: {new Date(invitation.accepted_at).toLocaleString()}</span>
                        )}
                      </div>
                      {(isPending || isExpired) && (
                        <div className="pt-1">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={resending === inv.id}
                            onClick={() => handleResend(inv.id, invitation?.email ?? '')}
                          >
                            {resending === inv.id ? 'Resending...' : isExpired ? 'Resend (New Token)' : 'Resend Email'}
                          </Button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </PageBody>
    </Page>
  )
}

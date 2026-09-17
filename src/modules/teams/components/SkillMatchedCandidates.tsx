"use client"
import * as React from 'react'
import Link from 'next/link'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'
import { flash } from '@open-mercato/ui/backend/FlashMessages'
import { UserPlus } from 'lucide-react'
import { skillOverlap } from '../lib/recruitment'

type DirectoryParticipant = {
  customer_user_id: string
  display_name: string
  role: string
  skills: string[] | null
  has_team: boolean
  looking_for_team: boolean
  specialty: string | null
}

export type SkillMatch = DirectoryParticipant & { matched: string[] }

/** How many suggestions are worth showing before the list stops being a shortlist. */
const MAX_SUGGESTIONS = 5

/**
 * Rank the directory against what the team asked for.
 *
 * Exported so the ordering is unit-testable without a browser: more matched skills first, then
 * people who said they are looking for a team, then alphabetically so the list is stable across
 * renders. People already on a team are never suggested — the invite would be refused anyway —
 * and neither are mentors or judges.
 */
export function rankSkillMatches(
  participants: DirectoryParticipant[],
  neededSkills: string[],
): SkillMatch[] {
  return participants
    .filter((person) => !person.has_team && person.role === 'participant')
    .map((person) => ({ ...person, matched: skillOverlap(neededSkills, person.skills) }))
    .filter((person) => person.matched.length > 0)
    .sort((a, b) => {
      if (b.matched.length !== a.matched.length) return b.matched.length - a.matched.length
      if (a.looking_for_team !== b.looking_for_team) return a.looking_for_team ? -1 : 1
      return a.display_name.localeCompare(b.display_name, undefined, { sensitivity: 'base' })
    })
}

/**
 * The answer to "inviting someone by name only isn't great": once the team says which skills it
 * needs, this is the shortlist of teamless participants who have them, each invitable in one
 * click.
 */
export function SkillMatchedCandidates({
  teamId,
  competitionId,
  neededSkills,
  participantsHref,
}: {
  teamId: string
  competitionId: string
  neededSkills: string[]
  participantsHref: string
}) {
  const t = useT()
  const queryClient = useQueryClient()
  const [invitingId, setInvitingId] = React.useState<string | null>(null)
  const [invitedIds, setInvitedIds] = React.useState<string[]>([])

  const { data, isLoading } = useQuery({
    queryKey: ['portal-participants', competitionId],
    queryFn: async () => {
      const { ok, result } = await apiCall<{ items: DirectoryParticipant[] }>(
        `/api/competitions/portal/participants?competition_id=${competitionId}`,
      )
      return ok && result ? result.items : []
    },
    enabled: neededSkills.length > 0,
  })

  const matches = React.useMemo(
    () => rankSkillMatches(data ?? [], neededSkills).slice(0, MAX_SUGGESTIONS),
    [data, neededSkills],
  )

  if (neededSkills.length === 0) return null

  async function invite(userId: string) {
    setInvitingId(userId)
    try {
      const { ok, result } = await apiCall<{ ok?: boolean; error?: string }>('/api/teams/portal/invite-member', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ team_id: teamId, invitee_id: userId }),
      })
      if (ok) {
        flash(t('teams.portal.myTeam.inviteSent', 'Invitation sent!'), 'success')
        setInvitedIds((current) => [...current, userId])
        queryClient.invalidateQueries({ queryKey: ['portal-invitations'] })
      } else {
        flash(result?.error ?? t('teams.portal.myTeam.inviteFailed', 'Failed to send invitation'), 'error')
      }
    } finally {
      setInvitingId(null)
    }
  }

  return (
    <div className="mb-3 rounded-xl border border-dashed border-gray-200 p-3 dark:border-white/10">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-foreground">
          {t('teams.portal.recruitment.matchesTitle', 'People with the skills you need')}
        </p>
        <Link href={participantsHref} className="text-[11px] font-medium text-portal-primary hover:underline">
          {t('teams.portal.recruitment.browseAll', 'Browse everyone')}
        </Link>
      </div>

      {isLoading ? (
        <p className="text-xs text-portal-secondary">{t('common.loading', 'Loading...')}</p>
      ) : matches.length === 0 ? (
        <p className="text-xs text-portal-secondary">
          {t('teams.portal.recruitment.matchesEmpty', 'Nobody without a team lists these skills yet. Your posting stays visible on the Teams page.')}
        </p>
      ) : (
        <ul className="space-y-2">
          {matches.map((person) => {
            const invited = invitedIds.includes(person.customer_user_id)
            return (
              <li key={person.customer_user_id} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{person.display_name}</p>
                  <p className="truncate text-[11px] text-portal-secondary">
                    {person.matched.join(' · ')}
                    {person.looking_for_team && ` — ${t('teams.portal.recruitment.isLookingForTeam', 'looking for a team')}`}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={invited ? 'outline' : 'default'}
                  disabled={invited || invitingId === person.customer_user_id}
                  onClick={() => void invite(person.customer_user_id)}
                  className={invited ? '' : 'bg-portal-primary hover:bg-portal-primary/90'}
                >
                  <UserPlus className="size-3.5" />
                  {invited
                    ? t('teams.portal.recruitment.invited', 'Invited')
                    : t('teams.portal.myTeam.sendInvite', 'Send Invite')}
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

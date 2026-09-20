"use client"
import * as React from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { Badge } from '@open-mercato/ui/primitives/badge'

/* Members and selected tracks of a team, as carried by the `teams.team-member-count` enricher. */

export type TeamMemberSummary = {
  id: string
  customerUserId: string
  name: string
  email: string | null
  role: string
  joinedAt: string | null
}

export type TeamTrackSummary = { id: string; name: string; color: string | null }

export type TeamSummary = { memberCount: number; members: TeamMemberSummary[]; tracks: TeamTrackSummary[] }

export function TeamTrackBadges({ tracks }: { tracks: readonly TeamTrackSummary[] | undefined }) {
  if (!tracks?.length) return <span className="text-muted-foreground">{'—'}</span>
  return (
    <div className="flex flex-wrap gap-1">
      {tracks.map((track) => (
        <Badge key={track.id} variant="outline" className="gap-1.5 font-normal">
          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: track.color ?? 'currentColor' }} aria-hidden="true" />
          {track.name}
        </Badge>
      ))}
    </div>
  )
}

/** Compact one-cell member list: owner first, every name visible. */
export function TeamMemberNames({ members }: { members: readonly TeamMemberSummary[] | undefined }) {
  const t = useT()
  if (!members?.length) return <span className="text-muted-foreground">{'—'}</span>
  return (
    <div className="flex flex-col gap-0.5">
      {members.map((member) => (
        <span key={member.id} className="whitespace-nowrap" title={member.email ?? undefined}>
          {member.name}
          {member.role === 'owner' && (
            <span className="ml-1.5 text-xs text-muted-foreground">({t('teams.roster.owner', 'owner')})</span>
          )}
        </span>
      ))}
    </div>
  )
}

/** Full roster card for the team edit page. */
export function TeamRosterCard({ summary, tracksSlot }: { summary: TeamSummary | null | undefined; tracksSlot?: React.ReactNode }) {
  const t = useT()
  if (!summary) return null

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <div className="rounded-lg border bg-card p-4">
        <h3 className="mb-3 text-base font-semibold">
          {t('teams.roster.members', 'Members')} ({summary.memberCount})
        </h3>
        {summary.members.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('teams.roster.noMembers', 'This team has no members.')}</p>
        ) : (
          <ul className="divide-y">
            {summary.members.map((member) => (
              <li key={member.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{member.name}</p>
                  {member.email && <p className="truncate text-xs text-muted-foreground">{member.email}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {member.joinedAt && (
                    <span className="text-xs text-muted-foreground">{new Date(member.joinedAt).toLocaleDateString()}</span>
                  )}
                  <Badge variant={member.role === 'owner' ? 'default' : 'secondary'}>
                    {member.role === 'owner' ? t('teams.roster.owner', 'owner') : t('teams.roster.member', 'member')}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {tracksSlot ?? (
        <div className="rounded-lg border bg-card p-4">
          <h3 className="mb-3 text-base font-semibold">
            {t('teams.roster.tracks', 'Selected tracks')} ({summary.tracks.length})
          </h3>
          {summary.tracks.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('teams.roster.noTracks', 'This team has not selected a track yet.')}</p>
          ) : (
            <TeamTrackBadges tracks={summary.tracks} />
          )}
        </div>
      )}
    </div>
  )
}

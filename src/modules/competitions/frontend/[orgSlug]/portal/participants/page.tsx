'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useT } from '@open-mercato/shared/lib/i18n/context'
import { usePortalContext } from '@open-mercato/ui/portal/PortalContext'
import { PortalPageHeader } from '@open-mercato/ui/portal/components/PortalPageHeader'
import { PortalCard } from '@open-mercato/ui/portal/components/PortalCard'
import { PortalEmptyState } from '@open-mercato/ui/portal/components/PortalEmptyState'
import { Button } from '@open-mercato/ui/primitives/button'
import { apiCall } from '@open-mercato/ui/backend/utils/apiCall'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Competition {
  id: string
  name: string
  stage: string
}

interface Participant {
  id: string
  customerUserId: string
  competitionId: string
  lookingForTeam: boolean
  lookingForTeamDescription: string | null
  teamId: string | null
  profileComplete: boolean
}

interface ParticipantProfile {
  id: string
  customerUserId: string
  bio: string | null
  organization: string | null
  skills: string[]
  socialLinks: Record<string, string>
}

interface Team {
  id: string
  leaderId: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ParticipantsPage({ params }: { params: { orgSlug: string } }) {
  const t = useT()
  const { auth } = usePortalContext()
  const { user, loading: authLoading } = auth

  const [competition, setCompetition] = useState<Competition | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [profiles, setProfiles] = useState<ParticipantProfile[]>([])
  const [myTeam, setMyTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  // Filters
  const [searchFilter, setSearchFilter] = useState('')
  const [skillFilter, setSkillFilter] = useState('')
  const [orgFilter, setOrgFilter] = useState('')
  const [lookingOnlyFilter, setLookingOnlyFilter] = useState(false)

  const fetchData = useCallback(async () => {
    if (!user) return
    try {
      const compRes = await apiCall('/api/competitions/portal/active')
      const comp = compRes?.data?.[0] ?? null
      setCompetition(comp)

      if (!comp) {
        setParticipants([])
        setProfiles([])
        return
      }

      // Fetch participants
      const participantsRes = await apiCall(
        `/api/competitions/participations?competitionId=${comp.id}&pageSize=100`,
      )
      const parts: Participant[] = participantsRes?.data ?? []
      setParticipants(parts)

      // Fetch participant profiles
      const profilesRes = await apiCall('/api/competitions/participant-profiles?pageSize=500')
      setProfiles(profilesRes?.data ?? [])

      // Fetch user's own team (to check if they're a team leader)
      try {
        const teamsRes = await apiCall(
          `/api/teams/teams?competitionId=${comp.id}&leaderId=${user.id}&pageSize=1`,
        )
        setMyTeam(teamsRes?.data?.[0] ?? null)
      } catch {
        setMyTeam(null)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) fetchData()
  }, [user, fetchData])

  // Build profile map for quick lookup
  const profileMap = useMemo(() => {
    const map: Record<string, ParticipantProfile> = {}
    profiles.forEach((p) => {
      map[p.customerUserId] = p
    })
    return map
  }, [profiles])

  // Gather all unique skills and organizations for filter dropdowns
  const allSkills = useMemo(() => {
    const skills = new Set<string>()
    profiles.forEach((p) => {
      p.skills.forEach((s) => skills.add(s))
    })
    return Array.from(skills).sort()
  }, [profiles])

  const allOrganizations = useMemo(() => {
    const orgs = new Set<string>()
    profiles.forEach((p) => {
      if (p.organization) orgs.add(p.organization)
    })
    return Array.from(orgs).sort()
  }, [profiles])

  // Filter participants
  const filteredParticipants = useMemo(() => {
    return participants.filter((part) => {
      const profile = profileMap[part.customerUserId]

      // Looking for team filter
      if (lookingOnlyFilter && !part.lookingForTeam) return false

      // Skill filter
      if (skillFilter && profile) {
        if (!profile.skills.some((s) => s.toLowerCase() === skillFilter.toLowerCase())) return false
      }

      // Organization filter
      if (orgFilter && profile) {
        if (profile.organization !== orgFilter) return false
      }

      // Search filter (match name/bio/organization/skills)
      if (searchFilter) {
        const lower = searchFilter.toLowerCase()
        const searchableText = [
          profile?.bio ?? '',
          profile?.organization ?? '',
          ...(profile?.skills ?? []),
          part.customerUserId,
        ]
          .join(' ')
          .toLowerCase()
        if (!searchableText.includes(lower)) return false
      }

      return true
    })
  }, [participants, profileMap, searchFilter, skillFilter, orgFilter, lookingOnlyFilter])

  const handleInvite = async (participantUserId: string) => {
    if (!competition || !myTeam) return
    setActionLoading(participantUserId)
    try {
      await apiCall('/api/teams/invitations', {
        method: 'POST',
        body: JSON.stringify({
          teamId: myTeam.id,
          inviteeId: participantUserId,
          type: 'INVITATION',
          competitionId: competition.id,
        }),
      })
      alert(t('competitions.portal.participants.inviteSent', 'Invitation sent!'))
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to send invitation')
    } finally {
      setActionLoading(null)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="size-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
      </div>
    )
  }

  if (!competition) {
    return (
      <div className="flex flex-col gap-8">
        <PortalPageHeader title={t('competitions.portal.participants.title', 'Participants')} />
        <PortalEmptyState
          title={t('competitions.portal.participants.noCompetition', 'No active competition')}
          description={t(
            'competitions.portal.participants.noCompetitionDesc',
            'There is no active competition at this time.',
          )}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <PortalPageHeader
        title={t('competitions.portal.participants.title', 'Participants')}
        subtitle={t('competitions.portal.participants.subtitle', '{{count}} participants', {
          count: String(filteredParticipants.length),
        })}
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <input
          type="text"
          value={searchFilter}
          onChange={(e) => setSearchFilter(e.target.value)}
          placeholder={t('competitions.portal.participants.searchPlaceholder', 'Search participants...')}
          className="rounded-md border px-3 py-1.5 text-sm flex-1 min-w-[200px]"
        />

        {allSkills.length > 0 && (
          <select
            value={skillFilter}
            onChange={(e) => setSkillFilter(e.target.value)}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            <option value="">{t('competitions.portal.participants.allSkills', 'All skills')}</option>
            {allSkills.map((skill) => (
              <option key={skill} value={skill}>
                {skill}
              </option>
            ))}
          </select>
        )}

        {allOrganizations.length > 0 && (
          <select
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            <option value="">
              {t('competitions.portal.participants.allOrganizations', 'All organizations')}
            </option>
            {allOrganizations.map((org) => (
              <option key={org} value={org}>
                {org}
              </option>
            ))}
          </select>
        )}

        <label className="flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={lookingOnlyFilter}
            onChange={(e) => setLookingOnlyFilter(e.target.checked)}
          />
          {t('competitions.portal.participants.lookingForTeam', 'Looking for team')}
        </label>
      </div>

      {/* Participant cards */}
      {filteredParticipants.length === 0 ? (
        <PortalEmptyState
          title={t('competitions.portal.participants.empty', 'No participants found')}
          description={t(
            'competitions.portal.participants.emptyDesc',
            'Try adjusting your filters.',
          )}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredParticipants.map((part) => {
            const profile = profileMap[part.customerUserId]
            return (
              <PortalCard key={part.id}>
                <div className="flex flex-col gap-3">
                  {/* Header: avatar + name */}
                  <div className="flex items-start gap-3">
                    <div className="size-10 shrink-0 rounded-full bg-muted flex items-center justify-center">
                      <svg
                        className="size-5 text-muted-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {profile?.bio
                          ? profile.bio.slice(0, 40) + (profile.bio.length > 40 ? '...' : '')
                          : part.customerUserId.slice(0, 12) + '...'}
                      </p>
                      {profile?.organization && (
                        <p className="text-xs text-muted-foreground truncate">
                          {profile.organization}
                        </p>
                      )}
                    </div>

                    {/* Looking for team badge */}
                    {part.lookingForTeam && (
                      <span className="shrink-0 inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        {t(
                          'competitions.portal.participants.lookingBadge',
                          'Looking for team',
                        )}
                      </span>
                    )}
                  </div>

                  {/* Skills */}
                  {profile && profile.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {profile.skills.slice(0, 6).map((skill) => (
                        <span
                          key={skill}
                          className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs"
                        >
                          {skill}
                        </span>
                      ))}
                      {profile.skills.length > 6 && (
                        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                          +{profile.skills.length - 6}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Action: Invite to team (only if current user is a team leader and participant has no team) */}
                  {myTeam && !part.teamId && part.customerUserId !== user?.id && (
                    <div className="border-t pt-3 mt-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleInvite(part.customerUserId)}
                        disabled={actionLoading === part.customerUserId}
                        className="w-full"
                      >
                        {actionLoading === part.customerUserId
                          ? t('competitions.portal.participants.inviting', 'Sending...')
                          : t('competitions.portal.participants.inviteToTeam', 'Invite to Team')}
                      </Button>
                    </div>
                  )}
                </div>
              </PortalCard>
            )
          })}
        </div>
      )}
    </div>
  )
}

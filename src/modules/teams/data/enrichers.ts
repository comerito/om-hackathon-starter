import type { ResponseEnricher } from '@open-mercato/shared/lib/crud/response-enricher'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { CustomerUser } from '@open-mercato/core/modules/customer_accounts/data/entities'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { Track } from '../../tracks/data/entities'
import { TeamMember, TeamRole, TeamTrack } from './entities'

type TeamRecord = Record<string, unknown> & { id: string; track_id?: string | null }

export type TeamMemberSummary = {
  id: string
  customerUserId: string
  name: string
  email: string | null
  role: string
  joinedAt: string | null
}

export type TeamTrackSummary = { id: string; name: string; color: string | null }

type TeamEnrichment = {
  _teams: { memberCount: number; members: TeamMemberSummary[]; tracks: TeamTrackSummary[] }
}

const EMPTY: TeamEnrichment = { _teams: { memberCount: 0, members: [], tracks: [] } }

/**
 * Members (with names) and every selected track (with names) for a batch of teams.
 * A team's tracks live in the `teams_team_track` junction; `track_id` on the team is the
 * primary one and is merged in so a team created before multi-track still shows its track.
 */
async function summarizeTeams(
  records: readonly TeamRecord[],
  context: { em: unknown; tenantId: string; organizationId: string },
): Promise<Map<string, TeamEnrichment['_teams']>> {
  const result = new Map<string, TeamEnrichment['_teams']>()
  const teamIds = records.map((record) => record.id)
  if (teamIds.length === 0) return result

  const em = (context.em as EntityManager).fork()
  const scope = { tenantId: context.tenantId, organizationId: context.organizationId }

  const [members, teamTracks] = await Promise.all([
    em.find(TeamMember, { teamId: { $in: teamIds }, deletedAt: null, ...scope } as FilterQuery<TeamMember>, {
      orderBy: { joinedAt: 'asc' },
    }),
    em.find(TeamTrack, { teamId: { $in: teamIds }, ...scope } as FilterQuery<TeamTrack>, {
      orderBy: { createdAt: 'asc' },
    }),
  ])

  // display_name / email are encryptable on customer_users: a raw select would hand back
  // ciphertext once a tenant has encryption seeded.
  const userIds = [...new Set(members.map((member) => member.customerUserId))]
  const users = userIds.length > 0
    ? await findWithDecryption(
        em,
        CustomerUser,
        { id: { $in: userIds }, tenantId: context.tenantId } as FilterQuery<CustomerUser>,
        undefined,
        { tenantId: context.tenantId, organizationId: context.organizationId },
      )
    : []
  const usersById = new Map(users.map((user) => [user.id, user]))

  const trackIdsByTeam = new Map<string, string[]>()
  for (const record of records) {
    trackIdsByTeam.set(record.id, typeof record.track_id === 'string' && record.track_id ? [record.track_id] : [])
  }
  for (const teamTrack of teamTracks) {
    const list = trackIdsByTeam.get(teamTrack.teamId)
    if (list && !list.includes(teamTrack.trackId)) list.push(teamTrack.trackId)
  }

  const trackIds = [...new Set([...trackIdsByTeam.values()].flat())]
  const tracks = trackIds.length > 0
    ? await em.find(Track, { id: { $in: trackIds }, ...scope } as FilterQuery<Track>)
    : []
  const tracksById = new Map(tracks.map((track) => [track.id, track]))

  const membersByTeam = new Map<string, TeamMemberSummary[]>()
  for (const member of members) {
    const user = usersById.get(member.customerUserId)
    const list = membersByTeam.get(member.teamId) ?? []
    list.push({
      id: member.id,
      customerUserId: member.customerUserId,
      name: user?.displayName || user?.email || member.customerUserId.slice(0, 8),
      email: user?.email ?? null,
      role: member.role,
      joinedAt: member.joinedAt ? member.joinedAt.toISOString() : null,
    })
    membersByTeam.set(member.teamId, list)
  }

  for (const record of records) {
    const teamMembers = (membersByTeam.get(record.id) ?? []).sort(
      (a, b) => Number(b.role === TeamRole.OWNER) - Number(a.role === TeamRole.OWNER),
    )
    result.set(record.id, {
      memberCount: teamMembers.length,
      members: teamMembers,
      tracks: (trackIdsByTeam.get(record.id) ?? [])
        .map((trackId) => tracksById.get(trackId))
        .filter((track): track is Track => Boolean(track))
        .map((track) => ({ id: track.id, name: track.name, color: track.color ?? null })),
    })
  }

  return result
}

const teamSummaryEnricher: ResponseEnricher<TeamRecord, TeamEnrichment> = {
  // Id kept from when this only counted members — enricher ids are referenced by config.
  id: 'teams.team-member-count',
  targetEntity: 'teams:team',
  priority: 10,
  timeout: 2000,
  fallback: EMPTY,

  async enrichOne(record, context) {
    const summary = await summarizeTeams([record], context)
    return { ...record, _teams: summary.get(record.id) ?? EMPTY._teams }
  },

  async enrichMany(records, context) {
    const summary = await summarizeTeams(records, context)
    return records.map((record) => ({ ...record, _teams: summary.get(record.id) ?? EMPTY._teams }))
  },
}

export const enrichers: ResponseEnricher[] = [teamSummaryEnricher]

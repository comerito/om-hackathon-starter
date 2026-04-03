import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import { CompetitionParticipation, ParticipantProfile } from '../../../data/entities'
import { TeamMember } from '../../../../teams/data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  GET: { requireCustomerAuth: true },
}

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const url = new URL(req.url)
    const competitionId = url.searchParams.get('competition_id')
    const search = url.searchParams.get('search') ?? ''
    const specialty = url.searchParams.get('specialty') ?? ''

    if (!competitionId) {
      return NextResponse.json({ error: 'competition_id is required' }, { status: 400 })
    }

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // Verify the user participates in this competition
    const myParticipation = await em.findOne(CompetitionParticipation, {
      competitionId,
      customerUserId: auth.sub,
      tenantId: auth.tenantId,
      deletedAt: null,
    })
    if (!myParticipation) {
      return NextResponse.json({ error: 'Not a participant in this competition' }, { status: 403 })
    }

    // Find all participations for this competition
    const participations = await em.find(CompetitionParticipation, {
      competitionId,
      tenantId: auth.tenantId,
      deletedAt: null,
    })

    if (participations.length === 0) {
      return NextResponse.json({ items: [] })
    }

    const participantUserIds = participations.map(p => p.customerUserId)

    const teamMembers = await em.find(TeamMember, {
      competitionId,
      customerUserId: { $in: participantUserIds },
      tenantId: auth.tenantId,
      deletedAt: null,
    })
    const teamMemberIds = new Set(teamMembers.map(member => member.customerUserId))

    // Load profiles for all participants
    const profiles = await em.find(ParticipantProfile, {
      customerUserId: { $in: participantUserIds },
      tenantId: auth.tenantId,
    })
    const profileMap = new Map(profiles.map(p => [p.customerUserId, p]))

    // If specialty filter is provided, narrow down to matching user IDs
    let filteredUserIds = participantUserIds
    if (specialty) {
      filteredUserIds = participantUserIds.filter(uid => {
        const profile = profileMap.get(uid)
        return profile?.specialty?.toLowerCase() === specialty.toLowerCase()
      })
      if (filteredUserIds.length === 0) {
        return NextResponse.json({ items: [] })
      }
    }

    // Load customer_users for display names and emails
    const knex = (em as any).getConnection().getKnex()

    let usersQuery = knex('customer_users')
      .select('id', 'display_name', 'email')
      .whereIn('id', filteredUserIds)

    if (search.length >= 2) {
      const searchPattern = `%${search}%`
      usersQuery = usersQuery.andWhere(function (this: any) {
        this.whereILike('display_name', searchPattern)
          .orWhereILike('email', searchPattern)
      })
    }

    const userRows = await usersQuery.limit(100)

    const userMap = new Map<string, { display_name: string; email: string }>(
      userRows.map((row: any) => [row.id, {
        display_name: row.display_name || row.email?.split('@')[0] || 'Unknown',
        email: row.email || '',
      }]),
    )

    // Build participation map by customer_user_id
    const participationMap = new Map(participations.map(p => [p.customerUserId, p]))

    // Build response items -- only include users that matched the search
    const matchedUserIds = search.length >= 2
      ? userRows.map((row: any) => row.id as string)
      : filteredUserIds

    const items = matchedUserIds.map((userId: string) => {
      const participation = participationMap.get(userId)
      const profile = profileMap.get(userId)
      const user = userMap.get(userId)

      return {
        customer_user_id: userId,
        display_name: user?.display_name ?? userId.slice(0, 8) + '...',
        email: user?.email ?? '',
        role: participation?.role ?? 'participant',
        specialty: profile?.specialty ?? null,
        organization: profile?.organization ?? null,
        skills: profile?.skills ?? [],
        looking_for_team: participation?.lookingForTeam ?? false,
        has_team: teamMemberIds.has(userId),
        bio: profile?.bio ?? null,
        avatar_url: profile?.avatarUrl ?? null,
        portfolio_url: profile?.portfolioUrl ?? null,
        office_hours_url: profile?.officeHoursUrl ?? null,
      }
    })

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[portal/participants] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Participants directory',
  methods: {
    GET: { summary: 'List all participants for a competition with profiles and display names' },
  },
}

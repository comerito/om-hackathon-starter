import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { CompetitionParticipation, ParticipantProfile } from '../../../data/entities'
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
    if (!competitionId) {
      return NextResponse.json({ error: 'competition_id is required' }, { status: 400 })
    }

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // Verify caller is a participant
    const myParticipation = await em.findOne(CompetitionParticipation, {
      customerUserId: auth.sub,
      competitionId,
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<CompetitionParticipation>)
    if (!myParticipation) {
      return NextResponse.json({ error: 'Not a participant' }, { status: 403 })
    }

    // Fetch participants looking for team
    const lookingParticipations = await em.find(CompetitionParticipation, {
      competitionId,
      lookingForTeam: true,
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<CompetitionParticipation>)

    // Fetch their profiles
    const userIds = lookingParticipations.map(p => p.customerUserId)
    const profiles = userIds.length > 0
      ? await em.find(ParticipantProfile, {
          customerUserId: { $in: userIds },
          tenantId: auth.tenantId,
        } as FilterQuery<ParticipantProfile>)
      : []
    const profileMap = new Map(profiles.map(p => [p.customerUserId, p]))

    const items = lookingParticipations.map(p => {
      const profile = profileMap.get(p.customerUserId)
      return {
        customer_user_id: p.customerUserId,
        role: p.role,
        looking_for_team_description: p.lookingForTeamDescription,
        bio: profile?.bio ?? null,
        organization: profile?.organization ?? null,
        skills: profile?.skills ?? [],
      }
    })

    return NextResponse.json({ items })
  } catch (error) {
    console.error('[portal/looking-for-team] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'People looking for teams',
  methods: { GET: { summary: 'List participants looking for a team in a competition' } },
}

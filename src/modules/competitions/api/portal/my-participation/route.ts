import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { CompetitionParticipation, Competition } from '../../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { applyPortalTranslationOverlays, resolvePortalLocale } from '@/lib/portal-translations'

export const metadata = { GET: { requireCustomerAuth: true } }

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    const url = new URL(req.url)
    const competitionId = url.searchParams.get('competition_id')
    if (!competitionId) return NextResponse.json({ error: 'competition_id required' }, { status: 400 })

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const locale = await resolvePortalLocale(req, { auth, container })

    const participation = await em.findOne(CompetitionParticipation, {
      customerUserId: auth.sub, competitionId, deletedAt: null,
    } as FilterQuery<CompetitionParticipation>)
    if (!participation) return NextResponse.json({ error: 'Not a participant' }, { status: 404 })

    const competition = await em.findOne(Competition, { id: competitionId } as FilterQuery<Competition>)
    const [translatedCompetition] = competition ? await applyPortalTranslationOverlays([{
      id: competition.id,
      name: competition.name,
    }], {
      entityType: 'competitions:competition',
      locale,
      tenantId: auth.tenantId,
      organizationId: auth.orgId,
      container,
    }) : []

    return NextResponse.json({
      id: participation.id,
      cocAccepted: participation.cocAccepted,
      cocAcceptedAt: participation.cocAcceptedAt,
      privacyPolicyAccepted: participation.privacyPolicyAccepted,
      privacyPolicyAcceptedAt: participation.privacyPolicyAcceptedAt,
      cocUrl: competition?.codeOfConductUrl ?? null,
      privacyPolicyUrl: competition?.privacyPolicyUrl ?? null,
      competitionName: translatedCompetition?.name ?? competition?.name ?? null,
    })
  } catch (error) {
    console.error('[portal/my-participation] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'My participation status',
  methods: { GET: { summary: 'Get CoC and privacy policy acceptance status' } },
}

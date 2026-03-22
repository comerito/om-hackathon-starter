import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { CompetitionParticipation } from '../../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const acceptSchema = z.object({
  competition_id: z.string().uuid(),
  accept_coc: z.boolean().optional(),
  accept_privacy: z.boolean().optional(),
})

export const metadata = { PUT: { requireCustomerAuth: true } }

export async function PUT(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Auth required' }, { status: 401 })

    const body = await req.json()
    const parsed = acceptSchema.parse(body)

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    const participation = await em.findOne(CompetitionParticipation, {
      customerUserId: auth.sub, competitionId: parsed.competition_id, deletedAt: null,
    } as FilterQuery<CompetitionParticipation>)
    if (!participation) return NextResponse.json({ error: 'Not a participant' }, { status: 404 })

    if (parsed.accept_coc) {
      participation.cocAccepted = true
      participation.cocAcceptedAt = new Date()
    }
    if (parsed.accept_privacy) {
      participation.privacyPolicyAccepted = true
      participation.privacyPolicyAcceptedAt = new Date()
    }

    await em.persistAndFlush(participation)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: 'Validation failed' }, { status: 422 })
    console.error('[portal/accept-terms] PUT error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Accept terms',
  methods: { PUT: { summary: 'Accept Code of Conduct and/or Privacy Policy' } },
}

import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { Competition } from '../../../data/entities'
import { applyPortalTranslationOverlays, resolvePortalLocale } from '@/lib/portal-translations'

const querySchema = z.object({
  competition_id: z.string().uuid(),
  document: z.enum(['code_of_conduct', 'rules', 'privacy_policy']),
})

export const metadata = {
  GET: { requireCustomerAuth: true },
}

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const url = new URL(req.url)
    const parsed = querySchema.safeParse({
      competition_id: url.searchParams.get('competition_id'),
      document: url.searchParams.get('document'),
    })
    if (!parsed.success) return NextResponse.json({ error: 'Invalid query parameters' }, { status: 400 })

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const locale = await resolvePortalLocale(req, { auth, container })

    const competition = await em.findOne(Competition, {
      id: parsed.data.competition_id,
      tenantId: auth.tenantId,
      organizationId: auth.orgId,
      deletedAt: null,
      isActive: true,
    } as FilterQuery<Competition>)
    if (!competition) return NextResponse.json({ error: 'Competition not found' }, { status: 404 })

    const [translatedCompetition] = await applyPortalTranslationOverlays([{
      id: competition.id,
      name: competition.name,
      code_of_conduct_content: competition.codeOfConductContent ?? null,
      rules_content: competition.rulesContent ?? null,
      privacy_policy_content: competition.privacyPolicyContent ?? null,
    }], {
      entityType: 'competitions:competition',
      locale,
      tenantId: auth.tenantId,
      organizationId: auth.orgId,
      container,
    })

    const documents = {
      code_of_conduct: {
        content: translatedCompetition?.code_of_conduct_content ?? competition.codeOfConductContent ?? null,
        external_url: competition.codeOfConductUrl ?? null,
      },
      rules: {
        content: translatedCompetition?.rules_content ?? competition.rulesContent ?? null,
        external_url: competition.rulesUrl ?? null,
      },
      privacy_policy: {
        content: translatedCompetition?.privacy_policy_content ?? competition.privacyPolicyContent ?? null,
        external_url: competition.privacyPolicyUrl ?? null,
      },
    } as const

    const selectedDocument = documents[parsed.data.document]

    return NextResponse.json({
      competition_name: translatedCompetition?.name ?? competition.name,
      document: parsed.data.document,
      content: selectedDocument.content,
      external_url: selectedDocument.external_url,
    })
  } catch (error) {
    console.error('[portal/legal-document] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Portal',
  summary: 'Competition legal document',
  methods: {
    GET: { summary: 'Get a localized legal document for the active competition' },
  },
}

import { NextResponse } from 'next/server'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { z } from 'zod'
import { JudgingCriterion } from '../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const copyCriteriaSchema = z.object({
  competition_id: z.string().uuid(),
  source_track_id: z.string().uuid().nullable(),
  target_track_id: z.string().uuid(),
})

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['judging.criteria.manage'] },
}

export async function POST(req: Request) {
  try {
    const auth = await getAuthFromRequest(req)
    if (!auth?.tenantId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const body = await req.json()
    const parsed = copyCriteriaSchema.parse(body)
    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    const organizationId = auth.orgId
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization context is required' }, { status: 400 })
    }

    // Load source criteria
    const sourceFilter: FilterQuery<JudgingCriterion> = {
      competitionId: parsed.competition_id,
      trackId: parsed.source_track_id,
      deletedAt: null,
      tenantId: auth.tenantId,
    } as FilterQuery<JudgingCriterion>

    const sourceCriteria = await em.find(JudgingCriterion, sourceFilter, { orderBy: { order: 'ASC' } })

    if (sourceCriteria.length === 0) {
      return NextResponse.json({ ok: true, count: 0 })
    }

    // Clone each criterion with the target track
    for (const criterion of sourceCriteria) {
      const clone = em.create(JudgingCriterion, {
        competitionId: criterion.competitionId,
        trackId: parsed.target_track_id,
        round: criterion.round,
        name: criterion.name,
        description: criterion.description,
        maxScore: criterion.maxScore,
        weight: criterion.weight,
        order: criterion.order,
        tenantId: criterion.tenantId,
        organizationId: criterion.organizationId,
      })
      em.persist(clone)
    }

    await em.flush()

    return NextResponse.json({ ok: true, count: sourceCriteria.length })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[copy-criteria] POST error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Judging',
  summary: 'Copy criteria between tracks',
  methods: { POST: { summary: 'Clone criteria from one track to another' } },
}

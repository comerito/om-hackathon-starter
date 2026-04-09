import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import { z } from 'zod'
import { SplitDetectionService } from '../../../../services/SplitDetectionService'
import { ungroupSplitSchema } from '../../../../data/validators'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { EntityManager } from '@mikro-orm/postgresql'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['bounties.judge'] },
}

export async function POST(request: Request, { params }: { params: Promise<{ groupId: string }> }) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromCookies()
    if (!auth?.tenantId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }

    const { groupId } = await params
    const body = await request.json()
    const parsed = ungroupSplitSchema.parse(body)

    const em = container.resolve('em') as EntityManager
    const splitService = new SplitDetectionService()

    await splitService.ungroupSplit(em, groupId, auth.userId ?? auth.sub ?? null, parsed.reason)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: 'Validation failed', details: error.issues }), { status: 422, headers: { 'content-type': 'application/json' } })
    }
    console.error('[bounties/splits/ungroup] POST error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties',
  summary: 'Ungroup split PRs',
  methods: { POST: { summary: 'Ungroup a split PR group and restore individual scoring' } },
}

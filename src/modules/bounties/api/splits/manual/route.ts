import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import crypto from 'crypto'
import { z } from 'zod'
import { BountyPullRequest, BountyActivityType, BountyActivityLog, BOUNTY_POINTS } from '../../../data/entities'
import type { BountyClassification, BountyCategory } from '../../../data/entities'
import { manualSplitGroupSchema } from '../../../data/validators'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['bounties.judge'] },
}

export async function POST(request: Request) {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromCookies()
    if (!auth?.tenantId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }

    const body = await request.json()
    const parsed = manualSplitGroupSchema.parse(body)
    const em = container.resolve('em') as EntityManager

    // Verify all PRs exist and belong to this tenant
    const prs = await em.find(BountyPullRequest, {
      id: { $in: parsed.pr_ids },
      tenantId: auth.tenantId,
      deletedAt: null,
    } as FilterQuery<BountyPullRequest>)

    if (prs.length !== parsed.pr_ids.length) {
      return new Response(JSON.stringify({ error: 'One or more PRs not found' }), { status: 404, headers: { 'content-type': 'application/json' } })
    }

    const primaryPR = prs.find(p => p.id === parsed.primary_pr_id)
    if (!primaryPR) {
      return new Response(JSON.stringify({ error: 'Primary PR not found in the provided list' }), { status: 400, headers: { 'content-type': 'application/json' } })
    }

    const groupId = crypto.randomUUID()

    for (const pr of prs) {
      // Clear any existing split group membership
      pr.splitGroupId = groupId
      if (pr.id === parsed.primary_pr_id) {
        pr.isSplitChild = false
      } else {
        pr.isSplitChild = true
        pr.totalPoints = 0
      }
    }

    const activity = em.create(BountyActivityLog, {
      tenantId: auth.tenantId,
      organizationId: auth.orgId!,
      type: BountyActivityType.PR_SPLIT_DETECTED,
      pullRequestId: primaryPR.id,
      actorUserId: auth.userId ?? auth.sub ?? null,
      message: `Manual split grouping: ${prs.length} PRs grouped by judge. Primary: PR #${primaryPR.githubPrNumber}${parsed.reason ? `. Reason: ${parsed.reason}` : ''}`,
      metadata: { groupId, prNumbers: prs.map(p => p.githubPrNumber), manual: true },
      createdAt: new Date(),
    })

    em.persist([...prs, activity])
    await em.flush()

    return new Response(JSON.stringify({ ok: true, group_id: groupId }), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return new Response(JSON.stringify({ error: 'Validation failed', details: error.issues }), { status: 422, headers: { 'content-type': 'application/json' } })
    }
    console.error('[bounties/splits/manual] POST error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties',
  summary: 'Manual split grouping',
  methods: { POST: { summary: 'Manually group PRs as a split submission' } },
}

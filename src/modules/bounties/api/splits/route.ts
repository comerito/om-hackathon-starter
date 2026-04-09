import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import { getAuthFromCookies } from '@open-mercato/shared/lib/auth/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { BountyPullRequest } from '../../data/entities'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

export const metadata = {
  GET: { requireAuth: true, requireFeatures: ['bounties.judge'] },
}

export async function GET() {
  try {
    const container = await createRequestContainer()
    const auth = await getAuthFromCookies()
    if (!auth?.tenantId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } })
    }

    const em = container.resolve('em') as EntityManager

    // Find all PRs that belong to a split group
    const splitPRs = await em.find(BountyPullRequest, {
      splitGroupId: { $ne: null },
      tenantId: auth.tenantId,
      organizationId: auth.orgId,
      deletedAt: null,
    }, {
      orderBy: { splitGroupId: 'ASC', githubCreatedAt: 'ASC' },
    })

    // Group by splitGroupId
    const groups = new Map<string, typeof splitPRs>()
    for (const pr of splitPRs) {
      const gid = pr.splitGroupId!
      if (!groups.has(gid)) groups.set(gid, [])
      groups.get(gid)!.push(pr)
    }

    const result = Array.from(groups.entries()).map(([groupId, prs]) => ({
      group_id: groupId,
      primary_pr: prs.find(p => !p.isSplitChild) ? {
        id: prs.find(p => !p.isSplitChild)!.id,
        github_pr_number: prs.find(p => !p.isSplitChild)!.githubPrNumber,
        title: prs.find(p => !p.isSplitChild)!.title,
        total_points: prs.find(p => !p.isSplitChild)!.totalPoints,
      } : null,
      children: prs.filter(p => p.isSplitChild).map(p => ({
        id: p.id,
        github_pr_number: p.githubPrNumber,
        title: p.title,
      })),
      author: prs[0].githubAuthor,
      pr_count: prs.length,
    }))

    return new Response(JSON.stringify({ ok: true, groups: result }), {
      headers: { 'content-type': 'application/json' },
    })
  } catch (error) {
    console.error('[bounties/splits] GET error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'content-type': 'application/json' } })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties',
  summary: 'List split groups',
  methods: { GET: { summary: 'List all detected PR split groups' } },
}

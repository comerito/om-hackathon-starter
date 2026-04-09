import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { ModuleConfigService } from '@open-mercato/core/modules/configs/lib/module-config-service'
import { z } from 'zod'
import { BountyPullRequest } from '../../../../data/entities'
import { verifyBountyJudge } from '../../../../lib/portalJudgeAuth'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const querySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  status: z.string().optional(),
  sortField: z.string().optional().default('created_at'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
})

export const metadata = {
  GET: { requireCustomerAuth: true },
}

export async function GET(req: Request) {
  try {
    const auth = await getCustomerAuthFromRequest(req)
    if (!auth?.sub) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager
    const configService = container.resolve('moduleConfigService') as ModuleConfigService

    const judgeInfo = await verifyBountyJudge(em, auth, configService)
    if (!judgeInfo) return NextResponse.json({ error: 'Not a bounty judge' }, { status: 403 })

    const url = new URL(req.url)
    const parsed = querySchema.parse({
      page: url.searchParams.get('page') ?? undefined,
      pageSize: url.searchParams.get('pageSize') ?? undefined,
      status: url.searchParams.get('status') ?? undefined,
      sortField: url.searchParams.get('sortField') ?? undefined,
      sortDir: url.searchParams.get('sortDir') ?? undefined,
    })

    const filters: Record<string, unknown> = {
      tenantId: auth.tenantId,
      organizationId: auth.orgId,
      deletedAt: null,
    }
    if (parsed.status) filters.status = parsed.status

    const sortFieldMap: Record<string, string> = {
      created_at: 'createdAt',
      total_points: 'totalPoints',
      status: 'status',
      title: 'title',
      github_created_at: 'githubCreatedAt',
    }
    const sortField = sortFieldMap[parsed.sortField] ?? 'createdAt'

    const [prs, total] = await em.findAndCount(
      BountyPullRequest,
      filters as FilterQuery<BountyPullRequest>,
      {
        orderBy: { [sortField]: parsed.sortDir } as Record<string, 'asc' | 'desc'>,
        limit: parsed.pageSize,
        offset: (parsed.page - 1) * parsed.pageSize,
      },
    )

    // Batch resolve participant + team names
    const participantIds = [...new Set(prs.map(pr => pr.participantId).filter(Boolean))] as string[]
    const teamIds = [...new Set(prs.map(pr => pr.teamId).filter(Boolean))] as string[]

    const participantMap = new Map<string, { name: string | null; github_username: string | null }>()
    if (participantIds.length > 0) {
      const rows = await em.getConnection().execute(
        `SELECT cp.id, cu.first_name, cu.last_name, cp.github_username
         FROM competitions_participation cp
         JOIN customer_accounts_user cu ON cu.id = cp.customer_user_id
         WHERE cp.id = ANY(?)`,
        [participantIds],
      )
      for (const r of rows) {
        participantMap.set(r.id, {
          name: [r.first_name, r.last_name].filter(Boolean).join(' ') || null,
          github_username: r.github_username,
        })
      }
    }

    const teamMap = new Map<string, string>()
    if (teamIds.length > 0) {
      const rows = await em.getConnection().execute(
        `SELECT id, name FROM teams_team WHERE id = ANY(?)`,
        [teamIds],
      )
      for (const r of rows) {
        teamMap.set(r.id, r.name)
      }
    }

    return NextResponse.json({
      items: prs.map(pr => ({
        id: pr.id,
        github_pr_number: pr.githubPrNumber,
        github_pr_url: pr.githubPrUrl,
        title: pr.title,
        description: pr.description,
        github_author: pr.githubAuthor,
        participant_id: pr.participantId,
        team_id: pr.teamId,
        status: pr.status,
        classifications: pr.classifications,
        classification_confidence: pr.classificationConfidence,
        classification_summary: pr.classificationSummary,
        total_points: pr.totalPoints,
        points_override: pr.pointsOverride,
        is_duplicate: pr.isDuplicate,
        duplicate_of_id: pr.duplicateOfId,
        duplicate_marked_by: pr.duplicateMarkedBy,
        duplicate_similarity: pr.duplicateSimilarity,
        split_group_id: pr.splitGroupId,
        is_split_child: pr.isSplitChild,
        github_created_at: pr.githubCreatedAt,
        created_at: pr.createdAt,
        _participant: pr.participantId
          ? (participantMap.get(pr.participantId) ?? { name: null, github_username: null })
          : { name: null, github_username: null },
        _team: pr.teamId
          ? { name: teamMap.get(pr.teamId) ?? null }
          : { name: null },
      })),
      total,
      page: parsed.page,
      pageSize: parsed.pageSize,
      totalPages: Math.ceil(total / parsed.pageSize),
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', details: error.issues }, { status: 422 })
    }
    console.error('[bounties/portal/judge/prs] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Bounties Portal',
  summary: 'List bounty PRs for portal judge',
  methods: { GET: { summary: 'List all bounty PRs for judging (portal)' } },
}

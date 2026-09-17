import { NextResponse } from 'next/server'
import { getCustomerAuthFromRequest } from '@open-mercato/core/modules/customer_accounts/lib/customerAuth'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager } from '@mikro-orm/postgresql'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { normalizeNeededSkills } from '../../../lib/recruitment'
import { rawAll } from '@/lib/db'

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

    const pageSize = Math.min(Number(url.searchParams.get('pageSize') ?? '50'), 100)
    const page = Math.max(Number(url.searchParams.get('page') ?? '1'), 1)
    const sortField = url.searchParams.get('sortField') ?? 'name'
    const sortDir = url.searchParams.get('sortDir') === 'desc' ? 'desc' : 'asc'
    const nameFilter = url.searchParams.get('name')

    // Recruitment filters — the team side of "who is looking for whom".
    const recruitingOnly = url.searchParams.get('recruiting') === 'true'
    const skillFilter = normalizeNeededSkills((url.searchParams.get('skills') ?? '').split(','))

    const allowedSortFields = ['name', 'created_at', 'status']
    const safeSortField = allowedSortFields.includes(sortField) ? sortField : 'name'

    const container = await createRequestContainer()
    const em = container.resolve('em') as EntityManager

    // Build the WHERE clause once and share it between the page query and the count query.
    // Column names are hardcoded here; every value goes through a positional placeholder.
    const conds: string[] = [
      't.competition_id = ?',
      't.tenant_id = ?',
      't.deleted_at IS NULL',
    ]
    const values: unknown[] = [competitionId, auth.tenantId]

    if (nameFilter) {
      conds.push('t.name ILIKE ?')
      values.push(`%${nameFilter}%`)
    }

    if (recruitingOnly) {
      conds.push('t.looking_for_members = true')
    }

    // `needed_skills` is a jsonb array of free text, so the match is on the case-folded
    // element. `skillFilter` went through `normalizeNeededSkills`, so it is never empty here —
    // which matters, because `execute()` inlines an empty array as `IN ()` and that does not
    // parse (see lib/db.ts).
    //
    // `jsonb_typeof(...) = 'array'` is not decoration: `jsonb_array_elements_text` raises
    // "cannot extract elements from a scalar" on a row whose jsonb is not an array, and one such
    // row would take down the whole browse page rather than just itself.
    if (skillFilter.length > 0) {
      conds.push(`jsonb_typeof(t.needed_skills) = 'array' AND EXISTS (
        SELECT 1 FROM jsonb_array_elements_text(t.needed_skills) AS wanted(skill)
         WHERE lower(btrim(wanted.skill)) IN (?)
      )`)
      values.push(skillFilter.map((skill) => skill.toLocaleLowerCase()))
    }

    const whereSql = conds.join(' AND ')

    // Count total before pagination
    const countRows = await rawAll<{ count: string | number }>(em,
      `SELECT COUNT(t.id) AS "count" FROM teams_team t WHERE ${whereSql}`,
      values,
    )
    const total = Number(countRows[0]?.count ?? 0)

    // Apply sort and pagination.
    // `safeSortField` is constrained to `allowedSortFields` above and `sortDir` to 'asc' | 'desc',
    // so both are safe to interpolate as identifiers/keywords.
    type TeamRow = {
      id: string
      competition_id: string
      track_id: string | null
      name: string
      description: string | null
      status: string
      is_finalist: boolean
      table_number: number | null
      table_location: string | null
      is_active: boolean
      created_at: Date | string
      looking_for_members: boolean
      needed_skills: unknown
      recruitment_note: string | null
    }
    const items = await rawAll<TeamRow>(em,
      `SELECT t.id, t.competition_id, t.track_id, t.name, t.description, t.status,
              t.is_finalist, t.table_number, t.table_location, t.is_active, t.created_at,
              t.looking_for_members, t.needed_skills, t.recruitment_note
         FROM teams_team t
        WHERE ${whereSql}
        ORDER BY t.${safeSortField} ${sortDir}
        LIMIT ? OFFSET ?`,
      [...values, pageSize, (page - 1) * pageSize],
    )

    // Fetch member counts and track assignments
    const teamIds = items.map((t) => t.id)
    let memberCounts = new Map<string, number>()
    const teamTrackMap = new Map<string, string[]>()
    if (teamIds.length > 0) {
      const counts = await rawAll<{ team_id: string; count: string | number }>(em,
        `SELECT team_id, COUNT(id) AS "count" FROM teams_team_member
           WHERE team_id IN (?) AND left_at IS NULL
           GROUP BY team_id`,
        [teamIds],
      )
      memberCounts = new Map(counts.map((r) => [r.team_id, Number(r.count)]))

      const trackRows = await rawAll<{ team_id: string; track_id: string }>(em,
        `SELECT team_id, track_id FROM teams_team_track WHERE team_id IN (?)`,
        [teamIds],
      )
      for (const row of trackRows) {
        const existing = teamTrackMap.get(row.team_id) ?? []
        existing.push(row.track_id)
        teamTrackMap.set(row.team_id, existing)
      }
    }

    const result = items.map((t) => ({
      id: t.id,
      competition_id: t.competition_id,
      track_id: t.track_id ?? null,
      track_ids: teamTrackMap.get(t.id) ?? [],
      name: t.name,
      description: t.description ?? null,
      status: t.status,
      is_finalist: Boolean(t.is_finalist),
      table_number: t.table_number ?? null,
      table_location: t.table_location ?? null,
      is_active: Boolean(t.is_active),
      created_at: t.created_at,
      looking_for_members: Boolean(t.looking_for_members),
      // A closed posting is withheld, not deleted: the team keeps its list for the next time it
      // reopens, and nobody browsing sees wants the team is no longer advertising.
      //
      // Normalized on read as well as on write: the column is jsonb, so a row written before
      // this shipped (or by anything other than update-recruitment) can still hold junk.
      needed_skills: t.looking_for_members ? normalizeNeededSkills(t.needed_skills) : [],
      recruitment_note: t.looking_for_members ? (t.recruitment_note ?? null) : null,
      _teams: { memberCount: memberCounts.get(t.id) ?? 0 },
    }))

    return NextResponse.json({
      items: result,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    console.error('[portal/browse-teams] GET error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export const openApi: OpenApiRouteDoc = {
  tag: 'Teams',
  summary: 'Browse teams (portal)',
  methods: {
    GET: {
      summary: 'List teams for portal participants. `recruiting=true` narrows to teams with an open '
        + 'recruitment posting; `skills=a,b` narrows to teams recruiting for any of those skills '
        + '(case-insensitive). A closed posting reports no skills and no note.',
    },
  },
}

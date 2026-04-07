import { z } from 'zod'
import { NextResponse } from 'next/server'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { getAuthFromRequest } from '@open-mercato/shared/lib/auth/server'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import { CompetitionParticipation, ParticipantProfile } from '../../data/entities'
import { participationCrudEvents, participationCrudIndexer } from '../../commands/participations'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'

const ENTITY_ID = 'competitions:competition_participation'

const querySchema = z.object({
  id: z.string().uuid().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(50),
  sortField: z.string().optional().default('created_at'),
  sortDir: z.enum(['asc', 'desc']).optional().default('desc'),
  competition_id: z.string().uuid().optional(),
  role: z.string().optional(),
  checked_in: z.coerce.boolean().optional(),
  coc_accepted: z.coerce.boolean().optional(),
  has_discord: z.enum(['true', 'false']).optional(),
})

const SORT_ALLOWED: Record<string, string> = { id: 'id', role: 'role', checked_in: 'checkedIn', created_at: 'createdAt' }

// Direct ORM query — bypasses query index so all records are returned
export async function GET(request: Request) {
  const auth = await getAuthFromRequest(request)
  if (!auth?.sub || !auth.tenantId) {
    return NextResponse.json({ error: 'Auth required' }, { status: 401 })
  }

  const url = new URL(request.url)
  const params = Object.fromEntries(url.searchParams)
  const q = querySchema.parse(params)

  const where: FilterQuery<CompetitionParticipation> = {
    tenantId: auth.tenantId,
    deletedAt: null,
  } as FilterQuery<CompetitionParticipation>
  if (q.id) (where as Record<string, unknown>).id = q.id
  if (q.competition_id) (where as Record<string, unknown>).competitionId = q.competition_id
  if (q.role) (where as Record<string, unknown>).role = q.role
  if (q.checked_in !== undefined) (where as Record<string, unknown>).checkedIn = q.checked_in
  if (q.coc_accepted !== undefined) (where as Record<string, unknown>).cocAccepted = q.coc_accepted

  const sortProp = SORT_ALLOWED[q.sortField] ?? 'createdAt'
  const container = await createRequestContainer()
  const em = container.resolve('em') as EntityManager

  const [items, total] = await em.findAndCount(CompetitionParticipation, where, {
    orderBy: { [sortProp]: q.sortDir } as any,
    limit: q.pageSize,
    offset: (q.page - 1) * q.pageSize,
  })

  // Resolve discord nicks from participant profiles
  const customerUserIds = items.map((p) => p.customerUserId)
  const profiles = customerUserIds.length > 0
    ? await em.find(ParticipantProfile, {
        customerUserId: { $in: customerUserIds },
        tenantId: auth.tenantId,
      } as FilterQuery<ParticipantProfile>)
    : []
  const profileMap = new Map(profiles.map((p) => [p.customerUserId, p]))

  let mapped = items.map((p) => ({
    id: p.id,
    competition_id: p.competitionId,
    customer_user_id: p.customerUserId,
    role: p.role,
    checked_in: p.checkedIn,
    checked_in_at: p.checkedInAt ?? null,
    coc_accepted: p.cocAccepted,
    privacy_policy_accepted: p.privacyPolicyAccepted,
    profile_complete: p.profileComplete,
    looking_for_team: p.lookingForTeam,
    discord_nick: profileMap.get(p.customerUserId)?.discordNick ?? null,
    created_at: p.createdAt,
  }))

  // Apply has_discord filter (post-join filter)
  let filteredTotal = total
  if (q.has_discord !== undefined) {
    const hasDiscord = q.has_discord === 'true'
    mapped = mapped.filter((p) => hasDiscord ? !!p.discord_nick : !p.discord_nick)
    filteredTotal = mapped.length
  }

  return NextResponse.json({
    items: mapped,
    total: filteredTotal,
    page: q.page,
    pageSize: q.pageSize,
    totalPages: Math.ceil(filteredTotal / q.pageSize),
  })
}

const rawBodySchema = z.object({}).passthrough()

const crud = makeCrudRoute({
  metadata: {
    GET: { requireAuth: true, requireFeatures: ['competitions.participants.manage'] },
    POST: { requireAuth: true, requireFeatures: ['competitions.participants.manage'] },
    PUT: { requireAuth: true, requireFeatures: ['competitions.participants.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['competitions.participants.manage'] },
  },
  orm: {
    entity: CompetitionParticipation,
    idField: 'id',
    orgField: 'organizationId',
    tenantField: 'tenantId',
    softDeleteField: 'deletedAt',
  },
  events: { module: 'competitions', entity: 'participation', persistent: true },
  indexer: { entityType: ENTITY_ID },
  list: {
    schema: querySchema,
    entityId: ENTITY_ID,
    fields: ['id', 'competition_id', 'customer_user_id', 'role', 'checked_in', 'checked_in_at', 'coc_accepted', 'privacy_policy_accepted', 'profile_complete', 'looking_for_team', 'tenant_id', 'organization_id', 'created_at'],
    sortFieldMap: { id: 'id', role: 'role', checked_in: 'checked_in', created_at: 'created_at' },
    buildFilters: async () => ({}),
    transformItem: (item) => item,
  },
  actions: {
    create: {
      commandId: 'competitions.participations.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'competitions.participations.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'competitions.participations.delete',
      response: () => ({ ok: true }),
    },
  },
})

export const { metadata } = crud
export const { POST, PUT, DELETE } = crud

export const openApi: OpenApiRouteDoc = {
  tag: 'Competitions',
  summary: 'Participation management',
  methods: {
    GET: { summary: 'List competition participations' },
    POST: { summary: 'Register a participant' },
    PUT: { summary: 'Update a participation' },
    DELETE: { summary: 'Remove a participation' },
  },
}

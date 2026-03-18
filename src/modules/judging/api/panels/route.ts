import { z } from 'zod'
import { NextResponse, type NextRequest } from 'next/server'
import { makeCrudRoute } from '@open-mercato/shared/lib/crud/factory'
import { E } from '@/.mercato/generated/entities.ids.generated'
import { createRequestContainer } from '@open-mercato/shared/lib/di/container'

import { JudgePanel, JudgePanelJudge, JudgePanelTrack } from '../../data/entities'
import { listPanelSchema, addPanelJudgeSchema, removePanelJudgeSchema, addPanelTrackSchema, removePanelTrackSchema, panelListItemSchema } from '../../data/validators'
import { panelCrudEvents } from '../../commands/judging'
import type { Where, WhereValue } from '@open-mercato/shared/lib/query/types'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import type { AuthContext } from '@open-mercato/shared/lib/auth/server'
import type { EntityManager } from '@mikro-orm/postgresql'
import { createJudgingCrudOpenApi, createJudgingPagedListResponseSchema, createdSchema, okSchema, errorSchema } from '../openapi'

// ---------------------------------------------------------------------------
// Query (list) schema
// ---------------------------------------------------------------------------

const querySchema = z
  .object({
    id: z.string().uuid().optional(),
    page: z.coerce.number().min(1).default(1),
    pageSize: z.coerce.number().min(1).max(100).default(50),
    sortField: z.string().optional().default('name'),
    sortDir: z.enum(['asc', 'desc']).optional().default('asc'),
    competitionId: z.string().uuid().optional(),
    round: z.enum(['PRELIMINARY', 'FINAL']).optional(),
  })
  .passthrough()

const rawBodySchema = z.object({}).passthrough()

type Query = z.infer<typeof querySchema>

// Column references
const id = 'id'
const competition_id = 'competition_id'
const name = 'name'
const round = 'round'
const tenant_id = 'tenant_id'
const organization_id = 'organization_id'
const created_at = 'created_at'
const deleted_at = 'deleted_at'

const listFields = [id, competition_id, name, round, tenant_id, organization_id, created_at, deleted_at]

const sortFieldMap: Record<string, unknown> = { id, name, round, created_at }

type BaseFields = {
  id: string
  competition_id: string
  name: string
  round: string
  tenant_id: string
  organization_id: string
  created_at: Date
  deleted_at: Date | null
}

export const { metadata, GET, POST, PUT, DELETE } = makeCrudRoute({
  metadata: {
    GET: { requireAuth: false },
    POST: { requireAuth: true, requireFeatures: ['judging.panels.manage'] },
    PUT: { requireAuth: true, requireFeatures: ['judging.panels.manage'] },
    DELETE: { requireAuth: true, requireFeatures: ['judging.panels.manage'] },
  },
  orm: {
    entity: JudgePanel,
    idField: 'id',
  },
  events: { module: 'judging', entity: 'panel', persistent: true },
  list: {
    entityId: E.judging.judge_panel,
    schema: querySchema,
    fields: listFields,
    sortFieldMap,
    buildFilters: async (q: Query): Promise<Where<BaseFields>> => {
      const filters: Where<BaseFields> = {}
      const F = filters as Record<string, WhereValue>
      if (q.id) F.id = q.id
      if (q.competitionId) F.competition_id = q.competitionId
      if (q.round) F.round = q.round
      F.deleted_at = null
      return filters
    },
    transformItem: (item: BaseFields) => ({
      id: String(item.id),
      competition_id: String(item.competition_id),
      name: String(item.name),
      round: String(item.round),
      created_at: item.created_at,
    }),
  },
  actions: {
    create: {
      commandId: 'judging.panel.create',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: ({ result }) => ({ id: String(result.id) }),
      status: 201,
    },
    update: {
      commandId: 'judging.panel.update',
      schema: rawBodySchema,
      mapInput: ({ parsed }) => parsed,
      response: () => ({ ok: true }),
    },
    delete: {
      commandId: 'judging.panel.delete',
      response: () => ({ ok: true }),
    },
  },
})

// ---------------------------------------------------------------------------
// Sub-resource: Panel Judges — POST /api/judging/panels?action=addJudge
// ---------------------------------------------------------------------------

const originalPost = POST

export { originalPost }

// We expose additional actions through the main route using action param
// This is handled via separate route files or query param actions

export const openApi: OpenApiRouteDoc = createJudgingCrudOpenApi({
  resourceName: 'JudgePanel',
  pluralName: 'Judge Panels',
  querySchema,
  listResponseSchema: createJudgingPagedListResponseSchema(panelListItemSchema),
  create: {
    schema: rawBodySchema,
    description: 'Creates a new judge panel.',
    responseSchema: createdSchema,
  },
  update: {
    schema: rawBodySchema,
    description: 'Updates an existing judge panel by id.',
    responseSchema: okSchema,
  },
  del: {
    schema: z.object({ id: z.string().uuid() }),
    description: 'Soft-deletes a judge panel by id.',
    responseSchema: okSchema,
  },
})

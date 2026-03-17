import { z } from 'zod'
import { makeApiHandler } from '@open-mercato/shared/lib/api/handler'
import { CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import type { EntityManager, FilterQuery } from '@mikro-orm/postgresql'
import type { DataEngine } from '@open-mercato/shared/lib/data/engine'
import { CompetitionParticipation, ParticipationRole } from '../../../data/entities'
import { bulkImportItemSchema, participationRoleSchema } from '../../../data/validators'
import type { OpenApiRouteDoc } from '@open-mercato/shared/lib/openapi'
import { competitionsTag, errorSchema } from '../../openapi'

const bulkImportBodySchema = z.object({
  competitionId: z.string().uuid(),
  participants: z.array(bulkImportItemSchema).min(1).max(500),
})

const bulkImportResponseSchema = z.object({
  created: z.number(),
  errors: z.array(z.object({
    row: z.number(),
    error: z.string(),
  })),
})

export const metadata = {
  POST: { requireAuth: true, requireFeatures: ['competitions.participants.manage'] },
}

export const POST = makeApiHandler({
  schema: bulkImportBodySchema,
  async handler({ parsed, container, auth }) {
    const tenantId = auth?.tenantId
    if (!tenantId) throw new CrudHttpError(400, { error: 'Tenant context is required' })
    const organizationId = auth?.orgId
    if (!organizationId) throw new CrudHttpError(400, { error: 'Organization context is required' })

    const em = container.resolve('em') as EntityManager
    const de = container.resolve('dataEngine') as DataEngine

    let created = 0
    const errors: Array<{ row: number; error: string }> = []

    for (let i = 0; i < parsed.participants.length; i++) {
      const participant = parsed.participants[i]
      try {
        // Check if a customer user exists with this email via the customer_accounts module
        // For now, create the participation record with a placeholder customerUserId.
        // In production, this would look up or invite the user first.
        // TODO: integrate with customer_accounts invitation flow

        // Attempt to find existing user by email using a raw query
        const rows = await em.getConnection().execute(
          `SELECT id FROM customer_accounts_user WHERE email = ? AND tenant_id = ? LIMIT 1`,
          [participant.email, tenantId],
        )

        let customerUserId: string

        if (rows.length > 0) {
          customerUserId = rows[0].id
        } else {
          // Create a minimal customer user record for the invitation
          const userRows = await em.getConnection().execute(
            `INSERT INTO customer_accounts_user (id, email, name, tenant_id, organization_id, created_at, updated_at)
             VALUES (gen_random_uuid(), ?, ?, ?, ?, now(), now())
             RETURNING id`,
            [participant.email, participant.name, tenantId, organizationId],
          )
          customerUserId = userRows[0].id
        }

        // Check for duplicate participation
        const existing = await em.findOne(CompetitionParticipation, {
          competitionId: parsed.competitionId,
          customerUserId,
          tenantId,
        } as FilterQuery<CompetitionParticipation>)

        if (existing) {
          errors.push({ row: i + 1, error: `Participant with email ${participant.email} is already registered` })
          continue
        }

        await de.createOrmEntity({
          entity: CompetitionParticipation,
          data: {
            competitionId: parsed.competitionId,
            customerUserId,
            role: (participant.role ?? 'participant') as ParticipationRole,
            tenantId,
            organizationId,
          },
        })

        created++
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        errors.push({ row: i + 1, error: message })
      }
    }

    return { created, errors }
  },
})

export const openApi: OpenApiRouteDoc = {
  POST: {
    tags: [competitionsTag],
    summary: 'Bulk import participants',
    description: 'Imports multiple participants for a competition. Creates customer user invitations and participation records. Processing is synchronous.',
    requestBody: {
      content: {
        'application/json': {
          schema: bulkImportBodySchema,
        },
      },
    },
    responses: {
      200: {
        description: 'Bulk import result with created count and any row-level errors',
        content: { 'application/json': { schema: bulkImportResponseSchema } },
      },
      400: {
        description: 'Invalid request body',
        content: { 'application/json': { schema: errorSchema } },
      },
    },
  },
}

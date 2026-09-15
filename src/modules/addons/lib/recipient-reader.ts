import type { EntityManager } from '@mikro-orm/postgresql'
import { CustomerUser } from '@open-mercato/core/modules/customer_accounts/data/entities'
import { findWithDecryption } from '@open-mercato/shared/lib/encryption/find'
import { z } from 'zod'
import { MAX_BATCH_RECIPIENTS, paginationSchema, participationRoleSchema, uuidSchema } from '../data/validators'

const scopeSchema = z.object({ tenantId: uuidSchema, organizationId: uuidSchema }).strict()
export type AddonRecipientScope = z.infer<typeof scopeSchema>
const competitionRowSchema = z.object({ id: uuidSchema, name: z.string() })
const recipientRowSchema = z.object({ customerUserId: uuidSchema, role: participationRoleSchema })
const countSchema = z.array(z.object({ totalCount: z.coerce.number().int().nonnegative().safe() }))
const optionsSchema = z.object({
  customerUserIds: z.array(uuidSchema).max(10_000).transform((ids) => [...new Set(ids)].sort()).optional(),
  limit: z.number().int().min(1).max(MAX_BATCH_RECIPIENTS + 1).default(MAX_BATCH_RECIPIENTS + 1),
  offset: z.number().int().nonnegative().safe().default(0),
  lock: z.boolean().default(false),
}).strict()

/** Read-only cross-module boundary. Raw queries deliberately never select account PII. */
export function createAddonRecipientReader() {
  async function competition(em: EntityManager, inputScope: AddonRecipientScope, inputId: string, options: { lock?: boolean } = {}) {
    const scope = scopeSchema.parse(inputScope)
    const id = uuidSchema.parse(inputId)
    const params = [scope.tenantId, scope.organizationId, id]
    if (options.lock) {
      if (!em.getTransactionContext()) throw new Error('addons_transaction_required')
      // Lock before testing active/deleted state, including records invalidated since preview.
      await em.execute('select id from competitions_competition where tenant_id = ? and organization_id = ? and id = ? for update', params)
    }
    const rows = competitionRowSchema.array().parse(await em.execute(
      'select id, name from competitions_competition where tenant_id = ? and organization_id = ? and id = ? and is_active = true and deleted_at is null', params,
    ))
    return rows[0] ?? null
  }

  return {
    competition,
    async competitions(em: EntityManager, inputScope: AddonRecipientScope, inputPage: { page: number; pageSize: number }) {
      const scope = scopeSchema.parse(inputScope)
      const { page, pageSize } = paginationSchema.parse(inputPage)
      const offset = z.number().int().nonnegative().safe().parse((page - 1) * pageSize)
      const where = 'from competitions_competition where tenant_id = ? and organization_id = ? and is_active = true and deleted_at is null'
      const params = [scope.tenantId, scope.organizationId]
      const counts = countSchema.parse(await em.execute(`select count(*) as "totalCount" ${where}`, params))
      const items = competitionRowSchema.array().parse(await em.execute(`select id, name ${where} order by name, id limit ? offset ?`, [...params, pageSize, offset]))
      return { items, totalCount: counts[0]?.totalCount ?? 0, page, pageSize }
    },
    async eligible(em: EntityManager, inputScope: AddonRecipientScope, inputCompetitionId: string, inputRoles: string[], inputOptions: z.input<typeof optionsSchema> = {}) {
      const scope = scopeSchema.parse(inputScope)
      const competitionId = uuidSchema.parse(inputCompetitionId)
      const roles = z.array(participationRoleSchema).parse(inputRoles)
      const { customerUserIds, limit, offset, lock } = optionsSchema.parse(inputOptions)
      if (lock && (!customerUserIds || customerUserIds.length > MAX_BATCH_RECIPIENTS)) throw new Error('addons_frozen_selection_required')
      if (customerUserIds?.length === 0) return { items: [], totalCount: 0 }
      if (lock) {
        if (!await competition(em, scope, competitionId, { lock: true })) return { items: [], totalCount: 0 }
        // Do not filter status/role before locking: revalidate against the final locked state.
        await em.execute(`select id from competitions_participation
          where tenant_id = ? and organization_id = ? and competition_id = ? and customer_user_id in (?)
          order by id for update`, [scope.tenantId, scope.organizationId, competitionId, customerUserIds])
        await em.execute(`select id from customer_users where tenant_id = ? and organization_id = ? and id in (?)
          order by id for update`, [scope.tenantId, scope.organizationId, customerUserIds])
      }
      const where = `from competitions_participation p
        join competitions_competition c on c.id = p.competition_id and c.tenant_id = p.tenant_id and c.organization_id = p.organization_id
        join customer_users u on u.id = p.customer_user_id and u.tenant_id = p.tenant_id and u.organization_id = p.organization_id
        where p.tenant_id = ? and p.organization_id = ? and p.competition_id = ?
        and p.deleted_at is null and c.is_active = true and c.deleted_at is null
        and u.is_active = true and u.deleted_at is null and p.role in (?)
        ${customerUserIds ? 'and p.customer_user_id in (?)' : ''}`
      const params: unknown[] = [scope.tenantId, scope.organizationId, competitionId, roles.length ? [...new Set(roles)].sort() : ['judge', 'mentor', 'participant']]
      if (customerUserIds) params.push(customerUserIds)
      const counts = countSchema.parse(await em.execute(`select count(distinct p.customer_user_id) as "totalCount" ${where}`, params))
      const items = recipientRowSchema.array().parse(await em.execute(`select p.customer_user_id as "customerUserId", min(p.role) as role ${where}
        group by p.customer_user_id order by role, p.customer_user_id limit ? offset ?`, [...params, limit, offset]))
      return { items, totalCount: counts[0]?.totalCount ?? 0 }
    },
    async display(em: EntityManager, inputScope: AddonRecipientScope, inputIds: string[]) {
      const scope = scopeSchema.parse(inputScope)
      const ids = [...new Set(z.array(uuidSchema).max(100).parse(inputIds))]
      const result = new Map<string, { displayName: string | null; email: string | null }>()
      if (!ids.length) return result
      const users = await findWithDecryption(em, CustomerUser, { ...scope, id: { $in: ids }, deletedAt: null }, {
        fields: ['id', 'displayName', 'email', 'tenantId', 'organizationId'],
      }, scope)
      for (const user of users) result.set(user.id, { displayName: user.displayName ?? null, email: user.email ?? null })
      return result
    },
  }
}

export type AddonRecipientReader = ReturnType<typeof createAddonRecipientReader>

import { isDeepStrictEqual } from 'node:util'
import { z } from 'zod'
import { runRouteMutationGuards } from '@open-mercato/shared/lib/crud/route-mutation-guard'
import { addonKeySchema, attemptStatusSchema, batchStatusSchema, deliveryModeSchema, participationRoleSchema, reasonCodeSchema, selectionKindSchema } from '../data/validators'
import type { AddonRequestContext } from './request-context'
import { AddonError } from './errors'

const scoped = { id: z.string().uuid(), tenantId: z.string().uuid(), organizationId: z.string().uuid() }
export const assignmentWriteSchema = z.object({
  ...scoped, competitionId: z.string().uuid(), customerUserId: z.string().uuid(), addonKey: addonKeySchema,
  assignedBy: z.string().uuid(), assignedAt: z.date(),
}).strict()
export const batchWriteSchema = z.object({
  ...scoped, competitionId: z.string().uuid(), addonKey: addonKeySchema, mode: deliveryModeSchema,
  createdBy: z.string().uuid(), requestId: z.string().uuid(), selectionKind: selectionKindSchema,
  roles: z.array(participationRoleSchema), requestedCustomerUserIds: z.array(z.string().uuid()).nullable(),
  status: batchStatusSchema, expiresAt: z.date(), confirmedAt: z.date().nullable(), finishedAt: z.date().nullable(),
  recipientCount: z.number().int().min(1).max(1000), succeededCount: z.number().int().nonnegative(),
  failedCount: z.number().int().nonnegative(), skippedCount: z.number().int().nonnegative(),
}).strict()
export const attemptWriteSchema = z.object({
  ...scoped, batchId: z.string().uuid(), customerUserId: z.string().uuid(), assignmentId: z.string().uuid().nullable(),
  mode: deliveryModeSchema, status: attemptStatusSchema, reasonCode: reasonCodeSchema.nullable(),
  attemptNumber: z.number().int().positive().nullable(), startedAt: z.date().nullable(), finishedAt: z.date().nullable(),
}).strict()

export async function guardWrite<T extends z.ZodType<Record<string, unknown>>>(
  ctx: AddonRequestContext, callbacks: Array<() => Promise<void>>, entity: string,
  operation: 'create' | 'update', schema: T, source: z.input<T>,
): Promise<z.output<T>> {
  const original = schema.parse(source)
  const result = await runRouteMutationGuards({
    container: ctx.container, req: ctx.req,
    auth: { userId: ctx.userId, tenantId: ctx.tenantId, organizationId: ctx.organizationId, userFeatures: ctx.userFeatures },
    input: { resourceKind: `addons:${entity}`, resourceId: String(original.id), operation, mutationPayload: original },
  })
  if (!result.ok) throw result.response
  const parsed = schema.safeParse({ ...original, ...result.modifiedPayload })
  // All persisted fields are identity, frozen membership, execution evidence or scope.
  // Changing any of them requires a fresh preview; guards may allow or block these writes.
  if (!parsed.success || !isDeepStrictEqual(parsed.data, original)) throw new AddonError('selection_changed', 409)
  callbacks.push(result.runAfterSuccess)
  return parsed.data
}

export async function afterCommit(callbacks: Array<() => Promise<void>>) {
  for (const callback of callbacks) {
    try { await callback() } catch { console.error('[addons] guard_callback_failed') }
  }
}

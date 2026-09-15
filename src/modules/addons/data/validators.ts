import { z } from 'zod'

export const MAX_BATCH_RECIPIENTS = 1_000
export const DRAFT_TTL_MS = 15 * 60 * 1_000
export const addonKeySchema = z.literal('mercato_sandboxes')
export const deliveryModeSchema = z.enum(['mock', 'real'])
export const participationRoleSchema = z.enum(['participant', 'mentor', 'judge'])
export const batchStatusSchema = z.enum(['draft', 'completed', 'completed_with_errors', 'cancelled', 'expired'])
export const attemptStatusSchema = z.enum(['selected', 'pending', 'succeeded', 'failed', 'skipped', 'cancelled', 'expired'])
export const reasonCodeSchema = z.enum(['mock_failure', 'already_succeeded', 'already_pending', 'no_longer_eligible', 'assignment_unavailable'])
export const selectionKindSchema = z.enum(['explicit', 'all_filtered'])
export const uuidSchema = z.string().uuid().transform((value) => value.toLowerCase())

const rolesSchema = z.array(participationRoleSchema).max(100).transform((roles) => [...new Set(roles)].sort())
const selectionSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('explicit'),
    // The service rejects empty/oversize normalized sets with the specified domain errors.
    customerUserIds: z.array(uuidSchema).max(10_000).transform((ids) => [...new Set(ids)].sort()),
    roles: rolesSchema,
  }).strict(),
  z.object({ kind: z.literal('all_filtered'), roles: rolesSchema }).strict(),
])

export const prepareBatchSchema = z.object({
  requestId: uuidSchema,
  competitionId: uuidSchema,
  mode: z.literal('mock'),
  selection: selectionSchema,
}).strict()

const positiveIntegerQuerySchema = z.union([
  z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  z.string().regex(/^[1-9]\d*$/).transform(Number).pipe(z.number().int().positive().max(Number.MAX_SAFE_INTEGER)),
])
export const paginationSchema = z.object({
  page: positiveIntegerQuerySchema.default(1),
  pageSize: positiveIntegerQuerySchema.pipe(z.number().max(100)).default(25),
}).strict()
export const competitionsQuerySchema = paginationSchema
export const batchesQuerySchema = paginationSchema.extend({ competitionId: uuidSchema })
export const recipientsQuerySchema = batchesQuerySchema.extend({ roles: rolesSchema.default([]) })
export const emptyMutationSchema = z.object({}).strict()

export type AddonKey = z.infer<typeof addonKeySchema>
export type DeliveryMode = z.infer<typeof deliveryModeSchema>
export type ParticipationRole = z.infer<typeof participationRoleSchema>
export type BatchStatus = z.infer<typeof batchStatusSchema>
export type AttemptStatus = z.infer<typeof attemptStatusSchema>
export type ReasonCode = z.infer<typeof reasonCodeSchema>
export type SelectionKind = z.infer<typeof selectionKindSchema>
export type PrepareBatchInput = z.infer<typeof prepareBatchSchema>
export type Pagination = z.infer<typeof paginationSchema>
export type RecipientsQuery = z.infer<typeof recipientsQuerySchema>

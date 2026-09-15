import { z } from 'zod'
import { addonKeySchema, deliveryModeSchema, batchStatusSchema, attemptStatusSchema, reasonCodeSchema, participationRoleSchema } from './validators'
const id = z.string().uuid()
const timestamp = z.string().datetime()
const count = z.number().int().nonnegative()
export const mockStatusSchema = z.enum(['not_simulated', 'pending', 'failed', 'succeeded'])
export const batchSummarySchema = z.object({
  id, competitionId: id, addonKey: addonKeySchema, mode: deliveryModeSchema, status: batchStatusSchema,
  createdBy: id, createdAt: timestamp, expiresAt: timestamp, confirmedAt: timestamp.nullable(), finishedAt: timestamp.nullable(),
  recipientCount: count, succeededCount: count, failedCount: count, skippedCount: count,
}).strict()
export const preparedBatchSchema = z.object({ id, status: batchStatusSchema, competitionId: id, competitionName: z.string(), mode: deliveryModeSchema, recipientCount: count, expiresAt: timestamp }).strict()
const page = { totalCount: count, page: z.number().int().positive(), pageSize: z.number().int().min(1).max(100) }
const display = { customerUserId: id, displayName: z.string().nullable(), email: z.string().nullable() }
export const competitionsResponseSchema = z.object({ items: z.array(z.object({ id, name: z.string() }).strict()), ...page }).strict()
export const recipientsResponseSchema = z.object({ items: z.array(z.object({ ...display, role: participationRoleSchema, assignmentId: id.nullable(), mockStatus: mockStatusSchema }).strict()), ...page }).strict()
export const batchListResponseSchema = z.object({ items: z.array(batchSummarySchema), ...page }).strict()
export const batchDetailResponseSchema = z.object({ batch: batchSummarySchema, items: z.array(z.object({ ...display, role: participationRoleSchema.nullable(), assignmentId: id.nullable(), status: attemptStatusSchema, reasonCode: reasonCodeSchema.nullable(), attemptNumber: z.number().int().positive().nullable(), startedAt: timestamp.nullable(), finishedAt: timestamp.nullable() }).strict()), ...page }).strict()
export type BatchSummary = z.infer<typeof batchSummarySchema>
export type PreparedBatch = z.infer<typeof preparedBatchSchema>
export type CompetitionsResponse = z.infer<typeof competitionsResponseSchema>
export type RecipientsResponse = z.infer<typeof recipientsResponseSchema>
export type BatchListResponse = z.infer<typeof batchListResponseSchema>
export type BatchDetailResponse = z.infer<typeof batchDetailResponseSchema>

import { z } from 'zod'
import { batchStatusSchema, attemptStatusSchema, participationRoleSchema, reasonCodeSchema, uuidSchema } from '../data/validators'

export const competitionSchema = z.object({ id: uuidSchema, name: z.string() })
export const recipientSchema = z.object({ customerUserId: uuidSchema, displayName: z.string().nullable(), email: z.string().nullable(), role: participationRoleSchema, assignmentId: uuidSchema.nullable(), mockStatus: z.string() })
export const batchSchema = z.object({ id: uuidSchema, competitionId: uuidSchema, addonKey: z.literal('mercato_sandboxes'), mode: z.enum(['mock', 'real']), status: batchStatusSchema, createdBy: uuidSchema, createdAt: z.string(), expiresAt: z.string(), confirmedAt: z.string().nullable(), finishedAt: z.string().nullable(), recipientCount: z.number(), succeededCount: z.number(), failedCount: z.number(), skippedCount: z.number() })
export const previewSchema = z.object({ id: uuidSchema, status: batchStatusSchema, competitionId: uuidSchema, competitionName: z.string(), mode: z.literal('mock'), recipientCount: z.number(), expiresAt: z.string() })
export const resultSchema = z.object({ customerUserId: uuidSchema, displayName: z.string().nullable(), email: z.string().nullable(), role: participationRoleSchema.nullable(), assignmentId: uuidSchema.nullable(), status: attemptStatusSchema, reasonCode: reasonCodeSchema.nullable(), attemptNumber: z.number().nullable(), startedAt: z.string().nullable(), finishedAt: z.string().nullable() })
export function paginated<S extends z.ZodType>(schema: S) { return z.object({ items: z.array(schema), totalCount: z.number(), page: z.number(), pageSize: z.number() }) }
export const detailSchema = paginated(resultSchema).extend({ batch: batchSchema })
export type Recipient = z.infer<typeof recipientSchema>
export type Batch = z.infer<typeof batchSchema>
export type Result = z.infer<typeof resultSchema>
export type Preview = z.infer<typeof previewSchema>

export function toggleSelection(ids: string[], id: string): string[] { return ids.includes(id) ? ids.filter((value) => value !== id) : [...ids, id] }
export function selectionCount(allFiltered: boolean, ids: string[], total: number): number { return allFiltered ? total : ids.length }
export function mayConfirm(batch: Pick<Batch, 'status' | 'expiresAt' | 'createdBy' | 'mode'>, userId: string | null, canSend: boolean, now = Date.now()): boolean { return canSend && batch.createdBy === userId && batch.mode === 'mock' && batch.status === 'draft' && new Date(batch.expiresAt).getTime() > now }

import { z } from 'zod'

export const incidentSeverityValues = ['low', 'medium', 'high', 'critical'] as const
export const incidentStatusValues = ['reported', 'under_review', 'resolved', 'dismissed'] as const

/**
 * `incidents_report.reported_user_id` is a uuid FK, so a typed-in person's name can never be
 * stored there. The portal form used to invite exactly that ("Full name or User ID"), and the
 * resulting 422 carried no field information, so the report looked accepted and vanished (#103).
 * The message is the one the reporter is shown next to the field, so it has to say what to do,
 * not just what is wrong.
 */
export const REPORTED_USER_ID_ERROR =
  'Select the reported person from the participant list, or leave this field empty and describe them in your report.'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * An unselected picker sends `''` (or `null`, or nothing at all) rather than a uuid; all three
 * mean "no person selected" and must not be an error. Anything else has to be a real uuid.
 */
const optionalUserId = z
  .string()
  .nullish()
  .refine((value) => value == null || value.trim() === '' || UUID_RE.test(value.trim()), {
    message: REPORTED_USER_ID_ERROR,
  })
  .transform((value) => (value == null || value.trim() === '' ? null : value.trim()))

export const createIncidentSchema = z.object({
  competition_id: z.string().uuid(),
  description: z.string().min(1),
  severity: z.enum(incidentSeverityValues).default('low'),
  reported_user_id: optionalUserId,
  anonymous: z.boolean().default(false),
})

/**
 * Collapse a ZodError into `{ <top-level field>: <first message> }` so an API can hand a caller
 * something it can render *on the field* instead of a bare "Validation failed". Built from
 * `issues` directly rather than via the deprecated `error.flatten()`.
 */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const field = issue.path[0]
    if (typeof field !== 'string') continue
    if (fieldErrors[field]) continue
    fieldErrors[field] = issue.message
  }
  return fieldErrors
}

export const updateIncidentSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(incidentStatusValues).optional(),
  admin_notes: z.string().nullable().optional(),
  severity: z.enum(incidentSeverityValues).optional(),
})

export const resolveIncidentSchema = z.object({
  id: z.string().uuid(),
  resolution_description: z.string().min(1),
  status: z.enum(['resolved', 'dismissed'] as const).default('resolved'),
})

export type CreateIncidentInput = z.infer<typeof createIncidentSchema>
export type UpdateIncidentInput = z.infer<typeof updateIncidentSchema>
export type ResolveIncidentInput = z.infer<typeof resolveIncidentSchema>

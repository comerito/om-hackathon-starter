import { CrudHttpError, isUniqueViolation } from '@open-mercato/shared/lib/crud/errors'

/**
 * Name of the Postgres unique constraint backing
 * `@Unique({ properties: ['slug', 'tenantId'] })` on `competitions_competition`
 * (created by `Migration20260319120000_competitions`).
 *
 * Matching on the constraint name is deliberate: a competition write can violate other
 * constraints too, and only this one means "the slug is taken". Everything else must keep
 * bubbling up as a 500 rather than being mislabelled a conflict.
 */
export const COMPETITION_SLUG_UNIQUE_CONSTRAINT = 'competitions_competition_slug_tenant_id_unique'

/**
 * Builds the 409 returned when a competition slug is already used inside the tenant.
 *
 * The body carries `fieldErrors.slug` on purpose: `mapCrudServerErrorToFormErrors`
 * (`@open-mercato/ui/backend/utils/serverErrors`) reads that key, so `CrudForm` attaches the
 * message to the Slug input instead of only flashing a toast.
 */
export function competitionSlugConflictError(slug?: string | null, cause?: unknown): CrudHttpError {
  const trimmed = typeof slug === 'string' ? slug.trim() : ''
  const message = trimmed
    ? `A competition with the slug "${trimmed}" already exists. Pick a different slug.`
    : 'A competition with this slug already exists. Pick a different slug.'
  return new CrudHttpError(409, { error: message, fieldErrors: { slug: message } }, { cause })
}

/**
 * Runs a competition write and converts a slug+tenant unique-constraint violation into a
 * 409 (`CrudHttpError`), which `makeCrudRoute`'s error handler turns into a JSON response.
 * Any other failure — including unique violations on other constraints — is rethrown
 * untouched so it is not silently downgraded to a conflict.
 */
export async function withCompetitionSlugConflict<T>(
  run: () => Promise<T>,
  slug?: string | null,
): Promise<T> {
  try {
    return await run()
  } catch (err) {
    if (isUniqueViolation(err, COMPETITION_SLUG_UNIQUE_CONSTRAINT)) {
      throw competitionSlugConflictError(slug, err)
    }
    throw err
  }
}

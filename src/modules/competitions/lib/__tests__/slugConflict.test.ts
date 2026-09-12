import { isCrudHttpError, type CrudHttpError } from '@open-mercato/shared/lib/crud/errors'
import { mapCrudServerErrorToFormErrors } from '@open-mercato/ui/backend/utils/serverErrors'
import {
  COMPETITION_SLUG_UNIQUE_CONSTRAINT,
  competitionSlugConflictError,
  withCompetitionSlugConflict,
} from '../slugConflict'

/**
 * MikroORM wraps the driver error in a `UniqueConstraintViolationException` whose constructor
 * copies every own property of the pg error onto itself, so `code`/`constraint`/`detail` are
 * readable straight off the thrown value. These factories reproduce that shape.
 */
function pgUniqueViolation(constraint: string, columns: string): Error {
  return Object.assign(
    new Error(`insert into "competitions_competition" ... - duplicate key value violates unique constraint "${constraint}"`),
    {
      code: '23505',
      constraint,
      detail: `Key (${columns})=(hackon-e2e-2026, 11111111-1111-1111-1111-111111111111) already exists.`,
      table: 'competitions_competition',
    },
  )
}

const slugViolation = () => pgUniqueViolation(COMPETITION_SLUG_UNIQUE_CONSTRAINT, 'slug, tenant_id')

async function captureConflict(run: () => Promise<unknown>): Promise<CrudHttpError> {
  try {
    await run()
  } catch (err) {
    if (!isCrudHttpError(err)) throw new Error(`Expected a CrudHttpError, got: ${String(err)}`)
    return err
  }
  throw new Error('Expected the call to reject')
}

describe('competitionSlugConflictError', () => {
  it('is a 409 naming the conflicting slug on both the message and the slug field', () => {
    const err = competitionSlugConflictError('hackon-e2e-2026')
    expect(err.status).toBe(409)
    expect(err.body.error).toContain('hackon-e2e-2026')
    expect(err.body.fieldErrors).toEqual({ slug: err.body.error })
  })

  it('falls back to a generic message when no slug is known', () => {
    const err = competitionSlugConflictError(undefined)
    expect(err.body.error).toBe('A competition with this slug already exists. Pick a different slug.')
    expect(err.body.fieldErrors).toEqual({ slug: err.body.error })
  })

  it('keeps the original driver error as the cause for logging', () => {
    const driverError = slugViolation()
    expect(competitionSlugConflictError('x', driverError).cause).toBe(driverError)
  })
})

describe('withCompetitionSlugConflict', () => {
  it('returns the write result untouched when nothing throws', async () => {
    const created = { id: 'comp-1' }
    await expect(withCompetitionSlugConflict(async () => created, 'hackon-e2e-2026')).resolves.toBe(created)
  })

  it('maps the slug+tenant unique violation to a 409 (create path)', async () => {
    const err = await captureConflict(() =>
      withCompetitionSlugConflict(async () => { throw slugViolation() }, 'hackon-e2e-2026'),
    )
    expect(err.status).toBe(409)
    expect(err.body.error).toContain('hackon-e2e-2026')
    expect((err.body.fieldErrors as Record<string, string>).slug).toContain('hackon-e2e-2026')
  })

  it('maps the same violation on a rename (update path) even when the driver error only names the constraint in its message', async () => {
    const bare = Object.assign(
      new Error(`update "competitions_competition" ... - duplicate key value violates unique constraint "${COMPETITION_SLUG_UNIQUE_CONSTRAINT}"`),
      { code: '23505' },
    )
    const err = await captureConflict(() =>
      withCompetitionSlugConflict(async () => { throw bare }, 'renamed-slug'),
    )
    expect(err.status).toBe(409)
    expect(err.body.error).toContain('renamed-slug')
  })

  it('looks through a wrapped cause', async () => {
    const wrapped = new Error('Flush failed', { cause: slugViolation() })
    const err = await captureConflict(() => withCompetitionSlugConflict(async () => { throw wrapped }, 'hackon-e2e-2026'))
    expect(err.status).toBe(409)
  })

  it('rethrows a unique violation on a DIFFERENT constraint untouched', async () => {
    const other = pgUniqueViolation('competitions_participation_email_competition_id_unique', 'email, competition_id')
    await expect(withCompetitionSlugConflict(async () => { throw other }, 'hackon-e2e-2026')).rejects.toBe(other)
  })

  it('rethrows non-unique database errors untouched', async () => {
    const fkViolation = Object.assign(new Error('violates foreign key constraint'), { code: '23503' })
    await expect(withCompetitionSlugConflict(async () => { throw fkViolation }, 'hackon-e2e-2026')).rejects.toBe(fkViolation)
  })

  it('rethrows ordinary errors untouched', async () => {
    const boom = new Error('boom')
    await expect(withCompetitionSlugConflict(async () => { throw boom }, 'hackon-e2e-2026')).rejects.toBe(boom)
  })
})

describe('backoffice form surfacing', () => {
  it('the 409 body lands on the CrudForm slug field', () => {
    // `createCrud` -> `raiseCrudError` rethrows an Error carrying the parsed JSON body;
    // `CrudForm` then runs it through `mapCrudServerErrorToFormErrors`.
    const body = competitionSlugConflictError('hackon-e2e-2026').body
    const raised = Object.assign(new Error(String(body.error)), body, { status: 409 })

    const { message, fieldErrors } = mapCrudServerErrorToFormErrors(raised)
    expect(fieldErrors?.slug).toContain('hackon-e2e-2026')
    expect(message).toContain('hackon-e2e-2026')
  })
})

import { z } from 'zod'
import { createIncidentSchema, REPORTED_USER_ID_ERROR, zodFieldErrors } from '../validators'

const COMPETITION_ID = '11111111-1111-4111-8111-111111111111'
const USER_ID = '22222222-2222-4222-8222-222222222222'

function base(overrides: Record<string, unknown> = {}) {
  return {
    competition_id: COMPETITION_ID,
    description: 'Someone was harassed in the main hall.',
    severity: 'medium',
    anonymous: false,
    ...overrides,
  }
}

describe('createIncidentSchema.reported_user_id', () => {
  // The #103 regression: the portal form invited a NAME, the schema demanded a uuid, and the
  // resulting error carried no field information, so the whole report was dropped in silence.
  it('rejects a free-text person name with a field-scoped, actionable message', () => {
    const result = createIncidentSchema.safeParse(base({ reported_user_id: 'Bravo Member' }))

    expect(result.success).toBe(false)
    if (result.success) return
    expect(zodFieldErrors(result.error)).toEqual({ reported_user_id: REPORTED_USER_ID_ERROR })
  })

  it('accepts a resolved participant uuid', () => {
    const result = createIncidentSchema.safeParse(base({ reported_user_id: USER_ID }))

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.reported_user_id).toBe(USER_ID)
  })

  it.each([
    ['omitted', {}],
    ['null', { reported_user_id: null }],
    ['an empty string', { reported_user_id: '' }],
    ['whitespace only', { reported_user_id: '   ' }],
  ])('treats %s as "no person selected" rather than an error', (_label, overrides) => {
    const result = createIncidentSchema.safeParse(base(overrides))

    expect(result.success).toBe(true)
    if (!result.success) return
    expect(result.data.reported_user_id).toBeNull()
  })

  it('never lets a bad reported_user_id mask the rest of the report', () => {
    // A dropped safety report is the severe failure; the reporter must be told exactly which
    // field to fix, including when more than one is wrong.
    const result = createIncidentSchema.safeParse(base({ description: '', reported_user_id: 'Bravo Member' }))

    expect(result.success).toBe(false)
    if (result.success) return
    const fieldErrors = zodFieldErrors(result.error)
    expect(Object.keys(fieldErrors).sort()).toEqual(['description', 'reported_user_id'])
    expect(fieldErrors.reported_user_id).toBe(REPORTED_USER_ID_ERROR)
  })
})

describe('zodFieldErrors', () => {
  it('keeps the first message per top-level field and ignores non-string paths', () => {
    const schema = z.object({ a: z.string().min(3, 'too short'), b: z.array(z.string().min(1, 'empty')) })
    const result = schema.safeParse({ a: 'x', b: [''] })

    expect(result.success).toBe(false)
    if (result.success) return
    expect(zodFieldErrors(result.error)).toEqual({ a: 'too short', b: 'empty' })
  })

  it('returns an empty map for an error with no field paths', () => {
    const result = z.string().safeParse(42)

    expect(result.success).toBe(false)
    if (result.success) return
    expect(zodFieldErrors(result.error)).toEqual({})
  })
})

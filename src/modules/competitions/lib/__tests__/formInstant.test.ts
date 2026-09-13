import { toFormInstant } from '../formInstant'
import { updateMilestoneSchema } from '../../data/validators'

/**
 * Regression tests for issue #122 (milestone `due_date` drifting by the timezone offset on
 * every save) — the same defect the competition edit form had in #81.
 *
 * The drift assertions are written in terms of the *measured* UTC offset so they hold in any
 * `TZ`, including the `TZ=UTC` case where the offset is zero and no drift is observable.
 */
describe('toFormInstant', () => {
  const storedInstant = '2026-03-23T07:00:00.000Z'

  it('keeps a stored ISO-8601 UTC instant intact', () => {
    expect(toFormInstant(storedInstant)).toBe(storedInstant)
  })

  it('normalises a Postgres-style zoned timestamp to a full ISO-8601 UTC instant', () => {
    expect(toFormInstant('2026-03-23 07:00:00+00')).toBe(storedInstant)
  })

  it('normalises a Date to a full ISO-8601 UTC instant', () => {
    expect(toFormInstant(new Date(storedInstant))).toBe(storedInstant)
  })

  it('returns an empty string for an absent value', () => {
    expect(toFormInstant(null)).toBe('')
    expect(toFormInstant(undefined)).toBe('')
    expect(toFormInstant('')).toBe('')
    expect(toFormInstant(new Date('nope'))).toBe('')
  })

  it('passes an unparseable value through rather than inventing an instant', () => {
    expect(toFormInstant('not a date')).toBe('not a date')
  })
})

describe('milestone due_date save round-trip (issue #122)', () => {
  const storedInstant = '2026-03-23T07:00:00.000Z'
  const milestoneId = '00000000-0000-4000-8000-000000000001'

  /** What the edit form now submits: the loaded instant, forwarded untouched. */
  function saveUnchanged(stored: string): string {
    const loaded = toFormInstant(stored)
    const parsed = updateMilestoneSchema.parse({ id: milestoneId, due_date: loaded })
    return parsed.due_date as string
  }

  /** What the edit form used to submit: zone-less load, re-parsed as browser-local on submit. */
  function saveUnchangedBeforeFix(stored: string): string {
    const loaded = new Date(stored).toISOString().slice(0, 16)
    const parsed = updateMilestoneSchema.parse({
      id: milestoneId,
      due_date: new Date(loaded).toISOString(),
    })
    return parsed.due_date as string
  }

  it('leaves the stored instant byte-identical after a no-op save', () => {
    expect(saveUnchanged(storedInstant)).toBe(storedInstant)
  })

  it('does not drift over repeated no-op saves', () => {
    let value = storedInstant
    for (let i = 0; i < 5; i += 1) value = saveUnchanged(value)
    expect(value).toBe(storedInstant)
  })

  it('the pre-fix round-trip shifted the instant by the browser UTC offset', () => {
    const drifted = saveUnchangedBeforeFix(storedInstant)
    const deltaMinutes = (new Date(drifted).getTime() - new Date(storedInstant).getTime()) / 60_000
    // The zone-less string is re-read as local wall-clock time, so the stored instant moves by
    // exactly the offset in effect at the shifted instant.
    expect(deltaMinutes).toBe(new Date(drifted).getTimezoneOffset())

    // Under `TZ=UTC` the offset is zero and no drift is observable; everywhere else the shift is
    // real and accumulates with every further save.
    if (new Date(drifted).getTimezoneOffset() !== 0) {
      expect(drifted).not.toBe(storedInstant)
      expect(saveUnchangedBeforeFix(drifted)).not.toBe(drifted)
    }
  })
})

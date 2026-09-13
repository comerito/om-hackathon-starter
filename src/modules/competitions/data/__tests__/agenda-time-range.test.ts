import {
  TIME_RANGE_MESSAGE,
  agendaItemFormSchema,
  bulkAgendaItemRowSchema,
  createAgendaItemSchema,
  createCompetitionSchema,
  isOrderedTimeRange,
  updateAgendaItemSchema,
  updateCompetitionSchema,
} from '../validators'

const COMPETITION_ID = '11111111-1111-4111-8111-111111111111'
const AGENDA_ITEM_ID = '22222222-2222-4222-8222-222222222222'

const START = '2026-09-15T18:00:00.000Z'
const BEFORE_START = '2026-09-15T09:00:00.000Z'
const AFTER_START = '2026-09-15T19:30:00.000Z'

function agendaCreateInput(overrides: Record<string, unknown> = {}) {
  return {
    competition_id: COMPETITION_ID,
    title: 'Opening ceremony',
    starts_at: START,
    ends_at: AFTER_START,
    ...overrides,
  }
}

function agendaUpdateInput(overrides: Record<string, unknown> = {}) {
  return { id: AGENDA_ITEM_ID, ...overrides }
}

function bulkRowInput(overrides: Record<string, unknown> = {}) {
  return { title: 'Opening ceremony', starts_at: START, ends_at: AFTER_START, ...overrides }
}

function competitionCreateInput(overrides: Record<string, unknown> = {}) {
  return {
    name: 'Hackon 2026',
    slug: 'hackon-2026',
    starts_at: START,
    ends_at: AFTER_START,
    code_of_conduct_url: 'https://example.com/coc',
    ...overrides,
  }
}

/** The single `ends_at` issue a rejected range is expected to produce. */
function endsAtIssue(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
  expect(result.success).toBe(false)
  const issues = result.error?.issues ?? []
  expect(issues).toHaveLength(1)
  expect(issues[0].path).toEqual(['ends_at'])
  expect(issues[0].message).toBe(TIME_RANGE_MESSAGE)
}

describe('isOrderedTimeRange', () => {
  it('accepts a range that ends after it starts', () => {
    expect(isOrderedTimeRange(START, AFTER_START)).toBe(true)
  })

  it('rejects a range that ends before it starts', () => {
    expect(isOrderedTimeRange(START, BEFORE_START)).toBe(false)
  })

  it('rejects a zero-length range', () => {
    expect(isOrderedTimeRange(START, START)).toBe(false)
  })

  it('compares instants, not strings, across equivalent offsets', () => {
    // 20:00+02:00 is 18:00Z — the same instant as START, so still zero-length.
    expect(isOrderedTimeRange(START, '2026-09-15T20:00:00.000+02:00')).toBe(false)
    expect(isOrderedTimeRange(START, '2026-09-15T20:01:00.000+02:00')).toBe(true)
  })

  it.each([
    ['both missing', undefined, undefined],
    ['start missing', undefined, AFTER_START],
    ['end missing', START, undefined],
    ['start null', null, AFTER_START],
    ['empty strings', '', ''],
    ['start unparseable', 'not-a-date', AFTER_START],
    ['end unparseable', START, 'not-a-date'],
  ])('stays out of the way when %s', (_label, start, end) => {
    expect(isOrderedTimeRange(start, end)).toBe(true)
  })
})

describe('createAgendaItemSchema', () => {
  it('accepts an item that ends after it starts', () => {
    const result = createAgendaItemSchema.safeParse(agendaCreateInput())
    expect(result.success).toBe(true)
  })

  it('rejects the reported case: ends_at nine hours before starts_at', () => {
    endsAtIssue(createAgendaItemSchema.safeParse(agendaCreateInput({ ends_at: BEFORE_START })))
  })

  it('rejects a zero-length slot', () => {
    endsAtIssue(createAgendaItemSchema.safeParse(agendaCreateInput({ ends_at: START })))
  })

  it('reports the missing field, not an ordering error, when a bound is absent', () => {
    const result = createAgendaItemSchema.safeParse(agendaCreateInput({ ends_at: undefined }))
    expect(result.success).toBe(false)
    const paths = (result.error?.issues ?? []).map((issue) => issue.path.join('.'))
    expect(paths).toEqual(['ends_at'])
    expect(result.error?.issues[0].message).not.toBe(TIME_RANGE_MESSAGE)
  })
})

describe('updateAgendaItemSchema', () => {
  it('accepts a range that ends after it starts', () => {
    const result = updateAgendaItemSchema.safeParse(
      agendaUpdateInput({ starts_at: START, ends_at: AFTER_START }),
    )
    expect(result.success).toBe(true)
  })

  it('rejects an inverted range', () => {
    endsAtIssue(updateAgendaItemSchema.safeParse(agendaUpdateInput({ starts_at: START, ends_at: BEFORE_START })))
  })

  it('rejects a zero-length range', () => {
    endsAtIssue(updateAgendaItemSchema.safeParse(agendaUpdateInput({ starts_at: START, ends_at: START })))
  })

  it.each([
    ['neither bound', {}],
    ['only starts_at', { starts_at: START }],
    ['only ends_at', { ends_at: BEFORE_START }],
  ])('accepts a partial update carrying %s (the command re-checks against the stored row)', (_label, patch) => {
    const result = updateAgendaItemSchema.safeParse(agendaUpdateInput(patch))
    expect(result.success).toBe(true)
  })
})

describe('bulkAgendaItemRowSchema', () => {
  it('accepts a row that ends after it starts', () => {
    expect(bulkAgendaItemRowSchema.safeParse(bulkRowInput()).success).toBe(true)
  })

  it('rejects an inverted row', () => {
    endsAtIssue(bulkAgendaItemRowSchema.safeParse(bulkRowInput({ ends_at: BEFORE_START })))
  })

  it('rejects a zero-length row', () => {
    endsAtIssue(bulkAgendaItemRowSchema.safeParse(bulkRowInput({ ends_at: START })))
  })
})

describe('agendaItemFormSchema', () => {
  it('rejects an inverted range and points the issue at ends_at', () => {
    endsAtIssue(agendaItemFormSchema.safeParse({ starts_at: START, ends_at: BEFORE_START }))
  })

  it('rejects a zero-length range', () => {
    endsAtIssue(agendaItemFormSchema.safeParse({ starts_at: START, ends_at: START }))
  })

  it('keeps every other form key so parsing never drops payload data', () => {
    const result = agendaItemFormSchema.safeParse({
      id: AGENDA_ITEM_ID,
      competition_id: COMPETITION_ID,
      title: 'Opening ceremony',
      starts_at: START,
      ends_at: AFTER_START,
      is_mandatory: true,
      order: 3,
      cf_room: 'Main hall',
    })
    expect(result.success).toBe(true)
    expect(result.data).toEqual({
      id: AGENDA_ITEM_ID,
      competition_id: COMPETITION_ID,
      title: 'Opening ceremony',
      starts_at: START,
      ends_at: AFTER_START,
      is_mandatory: true,
      order: 3,
      cf_room: 'Main hall',
    })
  })

  it('leaves an empty bound to the form-level required check', () => {
    const result = agendaItemFormSchema.safeParse({ starts_at: '', ends_at: '' })
    expect(result.success).toBe(false)
    for (const issue of result.error?.issues ?? []) {
      expect(issue.message).not.toBe(TIME_RANGE_MESSAGE)
    }
  })
})

describe('competition schemas', () => {
  it('accepts a competition that ends after it starts', () => {
    expect(createCompetitionSchema.safeParse(competitionCreateInput()).success).toBe(true)
  })

  it('rejects a competition that ends before it starts', () => {
    endsAtIssue(createCompetitionSchema.safeParse(competitionCreateInput({ ends_at: BEFORE_START })))
  })

  it('rejects a zero-length competition', () => {
    endsAtIssue(createCompetitionSchema.safeParse(competitionCreateInput({ ends_at: START })))
  })

  it('rejects an inverted range on update', () => {
    endsAtIssue(
      updateCompetitionSchema.safeParse({ id: COMPETITION_ID, starts_at: START, ends_at: BEFORE_START }),
    )
  })

  it('accepts an update that touches neither bound', () => {
    expect(updateCompetitionSchema.safeParse({ id: COMPETITION_ID, name: 'Renamed' }).success).toBe(true)
  })
})

import {
  sandboxInvitationSchema,
  updateParticipationSchema,
} from '../validators'

const COMPETITION_ID = '11111111-1111-4111-8111-111111111111'
const PARTICIPATION_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const PARTICIPATION_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

describe('sandboxInvitationSchema', () => {
  it('accepts a selected list of any length, including more than 100 ids', () => {
    const participationIds = Array.from({ length: 101 }, (_, index) => {
      const suffix = String(index + 1).padStart(12, '0')
      return `00000000-0000-4000-8000-${suffix}`
    })

    const parsed = sandboxInvitationSchema.parse({
      competition_id: COMPETITION_ID,
      selection: { mode: 'selected', participation_ids: participationIds },
    })

    expect(parsed.selection).toEqual({
      mode: 'selected',
      participation_ids: participationIds,
    })
  })

  it('rejects select-all leftover from the picker', () => {
    const result = sandboxInvitationSchema.safeParse({
      competition_id: COMPETITION_ID,
      selection: { mode: 'all' },
    })

    expect(result.success).toBe(false)
  })

  it('rejects an empty selected list', () => {
    const result = sandboxInvitationSchema.safeParse({
      competition_id: COMPETITION_ID,
      selection: { mode: 'selected', participation_ids: [] },
    })

    expect(result.success).toBe(false)
  })

  it('rejects selected mode without participation_ids', () => {
    const result = sandboxInvitationSchema.safeParse({
      competition_id: COMPETITION_ID,
      selection: { mode: 'selected' },
    })

    expect(result.success).toBe(false)
  })

  it('accepts two selected participation ids', () => {
    const parsed = sandboxInvitationSchema.parse({
      competition_id: COMPETITION_ID,
      selection: {
        mode: 'selected',
        participation_ids: [PARTICIPATION_A, PARTICIPATION_B],
      },
    })

    expect(parsed.selection).toEqual({
      mode: 'selected',
      participation_ids: [PARTICIPATION_A, PARTICIPATION_B],
    })
  })
})

describe('updateParticipationSchema', () => {
  it('does not accept a client-supplied sandbox invitation timestamp', () => {
    const parsed = updateParticipationSchema.parse({
      id: PARTICIPATION_A,
      mercato_sandboxes_invited_at: '2026-09-15T10:32:00.000Z',
      mercatoSandboxesInvitedAt: '2026-09-15T10:32:00.000Z',
    })

    expect(parsed).toEqual({ id: PARTICIPATION_A })
  })
})

import {
  MAX_RESOLVE_USER_IDS,
  normalizeRequestedUserIds,
  selectVisibleUserIds,
} from '../portalUserVisibility'

describe('normalizeRequestedUserIds', () => {
  it('returns an empty list for a missing or blank parameter', () => {
    expect(normalizeRequestedUserIds(null)).toEqual([])
    expect(normalizeRequestedUserIds('')).toEqual([])
    expect(normalizeRequestedUserIds(' , ,')).toEqual([])
  })

  it('trims, drops blanks and de-duplicates while preserving order', () => {
    expect(normalizeRequestedUserIds('b, a ,b,,a,c')).toEqual(['b', 'a', 'c'])
  })

  it('caps the list at MAX_RESOLVE_USER_IDS after de-duplication', () => {
    const distinct = Array.from({ length: MAX_RESOLVE_USER_IDS + 10 }, (_, i) => `id-${i}`)
    expect(normalizeRequestedUserIds(distinct.join(','))).toHaveLength(MAX_RESOLVE_USER_IDS)

    // Padding with repeats must not smuggle extra distinct ids past the cap.
    const padded = [...distinct.slice(0, MAX_RESOLVE_USER_IDS), 'id-0', 'id-1'].join(',')
    expect(normalizeRequestedUserIds(padded)).toHaveLength(MAX_RESOLVE_USER_IDS)
  })
})

describe('selectVisibleUserIds', () => {
  const caller = 'caller-1'

  it('keeps users who share a competition with the caller', () => {
    expect(
      selectVisibleUserIds({
        requestedIds: ['peer-1', 'peer-2'],
        callerUserId: caller,
        callerCompetitionIds: ['comp-a'],
        candidateParticipations: [
          { competitionId: 'comp-a', customerUserId: 'peer-1' },
          { competitionId: 'comp-a', customerUserId: 'peer-2' },
        ],
      }),
    ).toEqual(['peer-1', 'peer-2'])
  })

  it('drops users whose only participation is in another competition (issue #119)', () => {
    expect(
      selectVisibleUserIds({
        requestedIds: ['stranger-1', 'peer-1'],
        callerUserId: caller,
        callerCompetitionIds: ['comp-a'],
        candidateParticipations: [
          { competitionId: 'comp-b', customerUserId: 'stranger-1' },
          { competitionId: 'comp-a', customerUserId: 'peer-1' },
        ],
      }),
    ).toEqual(['peer-1'])
  })

  it('drops every requested id when the caller participates in nothing', () => {
    expect(
      selectVisibleUserIds({
        requestedIds: ['peer-1'],
        callerUserId: caller,
        callerCompetitionIds: [],
        candidateParticipations: [{ competitionId: 'comp-a', customerUserId: 'peer-1' }],
      }),
    ).toEqual([])
  })

  it('always resolves the caller themself', () => {
    expect(
      selectVisibleUserIds({
        requestedIds: [caller, 'stranger-1'],
        callerUserId: caller,
        callerCompetitionIds: [],
        candidateParticipations: [],
      }),
    ).toEqual([caller])
  })

  it('never returns an id that was not requested', () => {
    expect(
      selectVisibleUserIds({
        requestedIds: ['peer-1'],
        callerUserId: caller,
        callerCompetitionIds: ['comp-a'],
        candidateParticipations: [
          { competitionId: 'comp-a', customerUserId: 'peer-1' },
          { competitionId: 'comp-a', customerUserId: 'peer-9' },
        ],
      }),
    ).toEqual(['peer-1'])
  })
})

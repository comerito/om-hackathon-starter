import {
  MIN_PARTICIPANT_SEARCH_LENGTH,
  maskEmail,
  matchesParticipantNamePrefix,
  parseParticipantSearchQuery,
} from '../participantSearch'

describe('parseParticipantSearchQuery', () => {
  it('rejects queries shorter than the minimum', () => {
    expect(parseParticipantSearchQuery(null)).toEqual({ kind: 'too-short' })
    expect(parseParticipantSearchQuery('')).toEqual({ kind: 'too-short' })
    expect(parseParticipantSearchQuery('al')).toEqual({ kind: 'too-short' })
    expect(parseParticipantSearchQuery('  a  ')).toEqual({ kind: 'too-short' })
    expect(MIN_PARTICIPANT_SEARCH_LENGTH).toBe(3)
  })

  it('treats anything containing @ as an exact-address lookup', () => {
    expect(parseParticipantSearchQuery('Alpha@Hackon.Test')).toEqual({
      kind: 'email',
      email: 'alpha@hackon.test',
    })
    // A half-typed domain is still an address query — and an exact match finds nothing,
    // which is the point.
    expect(parseParticipantSearchQuery('@hackon')).toEqual({ kind: 'email', email: '@hackon' })
  })

  it('treats everything else as a name prefix', () => {
    expect(parseParticipantSearchQuery(' Alpha ')).toEqual({ kind: 'name', prefix: 'alpha' })
  })
})

describe('matchesParticipantNamePrefix', () => {
  const roster = [
    { displayName: 'Alpha Tester', email: 'alpha@hackon.test' },
    { displayName: 'Bravo Builder', email: 'bravo@hackon.test' },
    { displayName: 'Judy Judge', email: 'judy.judge@example.com' },
  ]

  it('does not let a mail-domain fragment enumerate the roster (issue #120)', () => {
    // (`test` is deliberately absent: it is a legitimate prefix of the name token "Tester",
    // and prefix-of-a-name is exactly what this search is for.)
    for (const fragment of ['hackon', 'example', '.com', 'ackon', 'kon.test']) {
      expect(roster.filter((u) => matchesParticipantNamePrefix(u, fragment))).toEqual([])
    }
  })

  it('matches a prefix of any name token', () => {
    expect(matchesParticipantNamePrefix(roster[0], 'alp')).toBe(true)
    expect(matchesParticipantNamePrefix(roster[0], 'tes')).toBe(true)
    expect(matchesParticipantNamePrefix(roster[2], 'jud')).toBe(true)
  })

  it('matches a multi-word needle against the whole display name', () => {
    // What the invite autocomplete actually sends as the user keeps typing: every keystroke of
    // "Alpha Tester" must keep matching, not just the first word.
    for (const needle of ['Alp', 'Alpha', 'Alpha ', 'Alpha T', 'Alpha Tes', 'Alpha Tester']) {
      expect(matchesParticipantNamePrefix(roster[0], needle)).toBe(true)
    }
    expect(matchesParticipantNamePrefix(roster[2], 'Judy Judge')).toBe(true)
  })

  it('keeps a multi-word needle prefix-anchored, not a substring search', () => {
    // The whole-name arm must not become "contains": it is anchored at position 0 of the name.
    expect(matchesParticipantNamePrefix(roster[0], 'lpha Tester')).toBe(false)
    expect(matchesParticipantNamePrefix(roster[0], 'Tester Alpha')).toBe(false)
    expect(matchesParticipantNamePrefix(roster[0], 'Alpha Testers')).toBe(false)
    expect(matchesParticipantNamePrefix(roster[1], 'Alpha Tester')).toBe(false)
  })

  it('collapses whitespace runs inside both the name and the needle', () => {
    expect(matchesParticipantNamePrefix({ displayName: 'Alpha   Tester' }, 'Alpha T')).toBe(true)
    expect(matchesParticipantNamePrefix(roster[0], 'Alpha    Tester')).toBe(true)
  })

  it('matches a prefix of the address local part but never of the domain', () => {
    expect(matchesParticipantNamePrefix({ displayName: null, email: 'charlie@hackon.test' }, 'cha')).toBe(true)
    expect(matchesParticipantNamePrefix({ displayName: null, email: 'charlie@hackon.test' }, 'hackon')).toBe(false)
  })

  it('is case-insensitive and ignores surrounding whitespace', () => {
    expect(matchesParticipantNamePrefix(roster[0], ' ALP ')).toBe(true)
  })

  it('refuses to match below the minimum length even when called directly', () => {
    expect(matchesParticipantNamePrefix(roster[0], 'al')).toBe(false)
  })

  it('tolerates missing fields', () => {
    expect(matchesParticipantNamePrefix({}, 'alp')).toBe(false)
    expect(matchesParticipantNamePrefix({ displayName: null, email: null }, 'alp')).toBe(false)
  })
})

describe('maskEmail', () => {
  it('keeps the first character and the domain, hiding the rest', () => {
    expect(maskEmail('alpha@hackon.test')).toBe('a***@hackon.test')
    expect(maskEmail('judy.judge@example.com')).toBe('j***@example.com')
  })

  it('uses a fixed number of stars so the local-part length stays hidden', () => {
    expect(maskEmail('a@hackon.test')).toBe('a***@hackon.test')
    expect(maskEmail('averyverylonglocalpart@hackon.test')).toBe('a***@hackon.test')
  })

  it('discloses nothing for values that are not address-shaped', () => {
    expect(maskEmail('@hackon.test')).toBe('***')
    expect(maskEmail('alpha@')).toBe('***')
    expect(maskEmail('not-an-address')).toBe('***')
    expect(maskEmail(null)).toBe('')
    expect(maskEmail('')).toBe('')
  })
})

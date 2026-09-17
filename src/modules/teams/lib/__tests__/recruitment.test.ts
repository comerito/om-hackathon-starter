import {
  MAX_NEEDED_SKILLS,
  MAX_SKILL_LENGTH,
  isRecruiting,
  normalizeNeededSkills,
  skillKey,
  skillOverlap,
} from '../recruitment'

describe('skillKey', () => {
  it('trims and case-folds so the same skill typed differently compares equal', () => {
    expect(skillKey('  React ')).toBe('react')
    expect(skillKey('REACT')).toBe(skillKey('react'))
  })
})

describe('normalizeNeededSkills', () => {
  it('returns an empty list for anything that is not an array', () => {
    expect(normalizeNeededSkills(undefined)).toEqual([])
    expect(normalizeNeededSkills(null)).toEqual([])
    expect(normalizeNeededSkills('React')).toEqual([])
    expect(normalizeNeededSkills({ 0: 'React' })).toEqual([])
  })

  it('trims entries and drops blank ones', () => {
    expect(normalizeNeededSkills([' React ', '', '   ', 'Postgres'])).toEqual(['React', 'Postgres'])
  })

  it('ignores non-string entries rather than stringifying them', () => {
    expect(normalizeNeededSkills(['React', 42, null, { name: 'Go' }, 'Go'])).toEqual(['React', 'Go'])
  })

  it('de-duplicates case-insensitively and keeps the first spelling', () => {
    expect(normalizeNeededSkills(['React', 'react', 'REACT'])).toEqual(['React'])
  })

  it('truncates over-long entries to the chip budget', () => {
    const long = 'a'.repeat(MAX_SKILL_LENGTH + 20)
    expect(normalizeNeededSkills([long])).toEqual(['a'.repeat(MAX_SKILL_LENGTH)])
  })

  it('caps the list length', () => {
    const many = Array.from({ length: MAX_NEEDED_SKILLS + 5 }, (_, i) => `skill-${i}`)
    const result = normalizeNeededSkills(many)
    expect(result).toHaveLength(MAX_NEEDED_SKILLS)
    expect(result[0]).toBe('skill-0')
  })

  it('counts duplicates against the cap only once', () => {
    const result = normalizeNeededSkills(['React', 'react', 'Postgres'])
    expect(result).toEqual(['React', 'Postgres'])
  })
})

describe('skillOverlap', () => {
  it('returns the matches in the team spelling and the team order', () => {
    expect(skillOverlap(['React', 'Postgres', 'Figma'], ['postgres', 'REACT'])).toEqual([
      'React',
      'Postgres',
    ])
  })

  it('is empty when the team asked for nothing', () => {
    expect(skillOverlap([], ['React'])).toEqual([])
    expect(skillOverlap(undefined, ['React'])).toEqual([])
  })

  it('is empty when the candidate lists nothing', () => {
    expect(skillOverlap(['React'], [])).toEqual([])
    expect(skillOverlap(['React'], null)).toEqual([])
  })

  it('tolerates junk inside the candidate list', () => {
    expect(skillOverlap(['React'], ['React', 7, null])).toEqual(['React'])
  })

  it('ignores whitespace-only candidate entries', () => {
    expect(skillOverlap(['React'], ['   '])).toEqual([])
  })
})

describe('isRecruiting', () => {
  it('is true only for an explicitly open posting', () => {
    expect(isRecruiting({ lookingForMembers: true })).toBe(true)
    expect(isRecruiting({ lookingForMembers: false })).toBe(false)
    expect(isRecruiting({ lookingForMembers: null })).toBe(false)
    expect(isRecruiting({})).toBe(false)
  })

  it('stays true for an open posting that lists no skills yet', () => {
    expect(isRecruiting({ lookingForMembers: true })).toBe(true)
  })
})

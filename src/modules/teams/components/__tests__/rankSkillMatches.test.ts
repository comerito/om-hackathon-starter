import { rankSkillMatches } from '../SkillMatchedCandidates'

type Person = Parameters<typeof rankSkillMatches>[0][number]

function person(over: Partial<Person> & { customer_user_id: string; display_name: string }): Person {
  return {
    role: 'participant',
    skills: [],
    has_team: false,
    looking_for_team: false,
    specialty: null,
    ...over,
  }
}

describe('rankSkillMatches', () => {
  const needed = ['React', 'Postgres']

  it('only suggests people who actually match', () => {
    const result = rankSkillMatches([
      person({ customer_user_id: '1', display_name: 'Ada', skills: ['React'] }),
      person({ customer_user_id: '2', display_name: 'Linus', skills: ['Kotlin'] }),
    ], needed)

    expect(result.map((p) => p.display_name)).toEqual(['Ada'])
    expect(result[0].matched).toEqual(['React'])
  })

  it('never suggests somebody who already has a team', () => {
    const result = rankSkillMatches([
      person({ customer_user_id: '1', display_name: 'Ada', skills: ['React'], has_team: true }),
    ], needed)

    expect(result).toEqual([])
  })

  it('never suggests mentors or judges', () => {
    const result = rankSkillMatches([
      person({ customer_user_id: '1', display_name: 'Grace', skills: ['React'], role: 'mentor' }),
      person({ customer_user_id: '2', display_name: 'Alan', skills: ['React'], role: 'judge' }),
    ], needed)

    expect(result).toEqual([])
  })

  it('puts the strongest overlap first', () => {
    const result = rankSkillMatches([
      person({ customer_user_id: '1', display_name: 'Ada', skills: ['React'] }),
      person({ customer_user_id: '2', display_name: 'Barbara', skills: ['postgres', 'REACT'] }),
    ], needed)

    expect(result.map((p) => p.display_name)).toEqual(['Barbara', 'Ada'])
    expect(result[0].matched).toEqual(['React', 'Postgres'])
  })

  it('breaks an equal overlap in favour of somebody looking for a team', () => {
    const result = rankSkillMatches([
      person({ customer_user_id: '1', display_name: 'Ada', skills: ['React'] }),
      person({ customer_user_id: '2', display_name: 'Barbara', skills: ['React'], looking_for_team: true }),
    ], needed)

    expect(result.map((p) => p.display_name)).toEqual(['Barbara', 'Ada'])
  })

  it('falls back to a stable alphabetical order', () => {
    const result = rankSkillMatches([
      person({ customer_user_id: '1', display_name: 'Zoe', skills: ['React'] }),
      person({ customer_user_id: '2', display_name: 'Ada', skills: ['React'] }),
    ], needed)

    expect(result.map((p) => p.display_name)).toEqual(['Ada', 'Zoe'])
  })

  it('suggests nobody when the team asked for nothing', () => {
    const result = rankSkillMatches([
      person({ customer_user_id: '1', display_name: 'Ada', skills: ['React'] }),
    ], [])

    expect(result).toEqual([])
  })

  it('tolerates a missing skills list on a profile', () => {
    const result = rankSkillMatches([
      person({ customer_user_id: '1', display_name: 'Ada', skills: null }),
    ], needed)

    expect(result).toEqual([])
  })
})

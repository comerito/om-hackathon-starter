import {
  STAGE_SEQUENCE,
  isAfterStage,
  isAtOrAfterStage,
  stageIndex,
  teamsMissingTrack,
} from '../stages'

describe('STAGE_SEQUENCE', () => {
  it('mirrors the persisted STAGE_ORDER in data/entities.ts', () => {
    expect([...STAGE_SEQUENCE]).toEqual([
      'draft', 'open', 'team_formation', 'track_selection',
      'hacking', 'demos', 'deliberation', 'finished', 'archived',
    ])
  })
})

describe('stage comparisons', () => {
  it('places a stage by its position in the lifecycle', () => {
    expect(stageIndex('draft')).toBe(0)
    expect(stageIndex('hacking')).toBe(4)
    expect(stageIndex('archived')).toBe(STAGE_SEQUENCE.length - 1)
  })

  it('answers false for an unknown, null or empty stage rather than guessing', () => {
    expect(stageIndex(null)).toBe(-1)
    expect(stageIndex('')).toBe(-1)
    expect(stageIndex('not_a_stage')).toBe(-1)
    expect(isAtOrAfterStage(undefined, 'hacking')).toBe(false)
    expect(isAtOrAfterStage('not_a_stage', 'hacking')).toBe(false)
    expect(isAfterStage(null, 'track_selection')).toBe(false)
  })

  it('treats the reference stage itself as "at or after" but not "after"', () => {
    expect(isAtOrAfterStage('hacking', 'hacking')).toBe(true)
    expect(isAfterStage('hacking', 'hacking')).toBe(false)
    expect(isAfterStage('demos', 'hacking')).toBe(true)
    expect(isAtOrAfterStage('track_selection', 'hacking')).toBe(false)
  })
})

describe('teamsMissingTrack', () => {
  const aurora = { id: 't-aurora', name: 'Team Aurora', trackId: null }
  const borealis = { id: 't-borealis', name: 'Team Borealis', trackId: null }
  const solo = { id: 't-solo', name: 'Team Solo', trackId: null }

  it('flags only the team with no track assignment at all', () => {
    const assignments = new Map<string, string[]>([
      ['t-aurora', ['track-ai']],
      ['t-borealis', ['track-green']],
    ])

    expect(teamsMissingTrack([aurora, borealis, solo], assignments)).toEqual([solo])
  })

  it('accepts the deprecated single-track column as an assignment', () => {
    const legacy = { id: 't-legacy', name: 'Legacy Team', trackId: 'track-ai' }

    expect(teamsMissingTrack([legacy], new Map())).toEqual([])
  })

  it('treats an empty assignment list the same as a missing one', () => {
    expect(teamsMissingTrack([solo], new Map([['t-solo', []]]))).toEqual([solo])
  })

  it('returns nothing when every team has a track', () => {
    const assignments = new Map<string, string[]>([['t-aurora', ['track-ai']]])

    expect(teamsMissingTrack([aurora], assignments)).toEqual([])
    expect(teamsMissingTrack([], new Map())).toEqual([])
  })

  it('handles a multi-track team', () => {
    const assignments = new Map<string, string[]>([['t-aurora', ['track-ai', 'track-green']]])

    expect(teamsMissingTrack([aurora], assignments)).toEqual([])
  })
})

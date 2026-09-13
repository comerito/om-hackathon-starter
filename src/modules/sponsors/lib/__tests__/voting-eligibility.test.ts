import {
  DEFAULT_VOTES_PER_PERSON,
  VOTING_CLOSES_AT_STAGE,
  VOTING_OPENS_AT_STAGE,
  evaluateVotingWindow,
  isVotingStage,
} from '../voting-eligibility'

const ALL_STAGES = [
  'draft', 'open', 'team_formation', 'track_selection',
  'hacking', 'demos', 'deliberation', 'finished', 'archived',
]

const OPEN_STAGES = ['hacking', 'demos']
const CLOSED_STAGES = ALL_STAGES.filter((s) => !OPEN_STAGES.includes(s))

const now = new Date('2026-03-20T12:00:00.000Z')

describe('isVotingStage', () => {
  it.each(OPEN_STAGES)('is open during %s', (stage) => {
    expect(isVotingStage(stage)).toBe(true)
  })

  it.each(CLOSED_STAGES)('is closed during %s', (stage) => {
    expect(isVotingStage(stage)).toBe(false)
  })

  it('fails closed for an unknown or missing stage', () => {
    expect(isVotingStage('not_a_stage')).toBe(false)
    expect(isVotingStage('')).toBe(false)
    expect(isVotingStage(null)).toBe(false)
    expect(isVotingStage(undefined)).toBe(false)
  })

  it('pins the window to the documented stage boundaries', () => {
    expect(VOTING_OPENS_AT_STAGE).toBe('hacking')
    expect(VOTING_CLOSES_AT_STAGE).toBe('deliberation')
    expect(DEFAULT_VOTES_PER_PERSON).toBe(3)
  })
})

describe('evaluateVotingWindow — stage gate', () => {
  // The bug reported in #107: peerVotingConfig as the back office actually
  // writes it, with both instants null, during deliberation.
  const defaultConfig = {
    enabled: true,
    votesPerPerson: 3,
    votingStartsAt: null,
    votingEndsAt: null,
    allowVoteChange: false,
  }

  it.each(OPEN_STAGES)('is open during %s with the default config', (stage) => {
    expect(evaluateVotingWindow({ stage, config: defaultConfig, now })).toEqual({ open: true })
  })

  it('closes once the competition reaches deliberation', () => {
    expect(evaluateVotingWindow({ stage: 'deliberation', config: defaultConfig, now })).toEqual({
      open: false,
      reason: 'voting_closed',
      message: 'Voting has closed for this competition',
    })
  })

  it.each(['deliberation', 'finished', 'archived'])('stays closed at %s', (stage) => {
    const state = evaluateVotingWindow({ stage, config: defaultConfig, now })
    expect(state.open).toBe(false)
    expect(state.open === false && state.reason).toBe('voting_closed')
  })

  it.each(['draft', 'open', 'team_formation', 'track_selection'])('is not open yet at %s', (stage) => {
    const state = evaluateVotingWindow({ stage, config: defaultConfig, now })
    expect(state.open).toBe(false)
    expect(state.open === false && state.reason).toBe('voting_not_open_yet')
  })

  it('fails closed for an unknown stage', () => {
    const state = evaluateVotingWindow({ stage: 'not_a_stage', config: defaultConfig, now })
    expect(state.open).toBe(false)
    expect(state.open === false && state.reason).toBe('voting_closed')
  })

  it('treats a missing config as an enabled default', () => {
    expect(evaluateVotingWindow({ stage: 'demos', now })).toEqual({ open: true })
    expect(evaluateVotingWindow({ stage: 'demos', config: null, now })).toEqual({ open: true })
    expect(evaluateVotingWindow({ stage: 'deliberation', now }).open).toBe(false)
  })
})

describe('evaluateVotingWindow — organiser switch', () => {
  it('is closed when peer voting is disabled, whatever the stage', () => {
    const state = evaluateVotingWindow({ stage: 'demos', config: { enabled: false }, now })
    expect(state).toEqual({
      open: false,
      reason: 'voting_disabled',
      message: 'Peer voting is not enabled for this competition',
    })
  })

  it('does not treat a missing `enabled` flag as disabled', () => {
    expect(evaluateVotingWindow({ stage: 'demos', config: { votesPerPerson: 5 }, now })).toEqual({ open: true })
  })
})

describe('evaluateVotingWindow — explicit instants', () => {
  it('closes after votingEndsAt even while the stage is open', () => {
    const state = evaluateVotingWindow({
      stage: 'demos',
      config: { votingEndsAt: '2026-03-20T11:00:00.000Z' },
      now,
    })
    expect(state.open).toBe(false)
    expect(state.open === false && state.reason).toBe('voting_window_ended')
  })

  it('stays open before votingEndsAt', () => {
    expect(evaluateVotingWindow({
      stage: 'demos',
      config: { votingEndsAt: '2026-03-20T13:00:00.000Z' },
      now,
    })).toEqual({ open: true })
  })

  it('is not open before votingStartsAt', () => {
    const state = evaluateVotingWindow({
      stage: 'hacking',
      config: { votingStartsAt: '2026-03-20T18:00:00.000Z' },
      now,
    })
    expect(state.open).toBe(false)
    expect(state.open === false && state.reason).toBe('voting_window_not_started')
  })

  it('cannot widen the stage window — an open instant range during deliberation is still closed', () => {
    const state = evaluateVotingWindow({
      stage: 'deliberation',
      config: { votingStartsAt: '2026-03-01T00:00:00.000Z', votingEndsAt: '2026-04-01T00:00:00.000Z' },
      now,
    })
    expect(state.open).toBe(false)
    expect(state.open === false && state.reason).toBe('voting_closed')
  })

  it('ignores blank and unparseable instants rather than closing on them', () => {
    expect(evaluateVotingWindow({ stage: 'demos', config: { votingEndsAt: '   ' }, now })).toEqual({ open: true })
    expect(evaluateVotingWindow({ stage: 'demos', config: { votingEndsAt: 'yesterday' }, now })).toEqual({ open: true })
    expect(evaluateVotingWindow({ stage: 'demos', config: { votingStartsAt: 'soon' }, now })).toEqual({ open: true })
  })

  it('compares instants, not strings, across UTC offsets', () => {
    // 2026-03-20T12:30:00+02:00 === 10:30Z, i.e. already past `now`.
    const state = evaluateVotingWindow({
      stage: 'demos',
      config: { votingEndsAt: '2026-03-20T12:30:00+02:00' },
      now,
    })
    expect(state.open).toBe(false)
    expect(state.open === false && state.reason).toBe('voting_window_ended')
  })

  it('defaults `now` to the current time', () => {
    expect(evaluateVotingWindow({ stage: 'demos', config: { votingEndsAt: '2000-01-01T00:00:00.000Z' } }).open).toBe(false)
    expect(evaluateVotingWindow({ stage: 'demos', config: { votingEndsAt: '2999-01-01T00:00:00.000Z' } }).open).toBe(true)
  })
})

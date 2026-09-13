import {
  AUTO_PANEL,
  eligibleScoringPanelIds,
  resolveScoringPanel,
  type ResolveScoringPanelInput,
} from '../panelScope'

const COMPETITION_A = '11111111-1111-4111-8111-111111111111'
const COMPETITION_B = '22222222-2222-4222-8222-222222222222'
const PANEL_A1 = 'aaaaaaaa-1111-4111-8111-111111111111'
const PANEL_A2 = 'bbbbbbbb-2222-4222-8222-222222222222'
const PANEL_B1 = 'cccccccc-3333-4333-8333-333333333333'
const PROJECT = '44444444-4444-4444-8444-444444444444'
const TRACK = '55555555-5555-4555-8555-555555555555'
const OTHER_TRACK = '66666666-6666-4666-8666-666666666666'

function input(overrides: Partial<ResolveScoringPanelInput> = {}): ResolveScoringPanelInput {
  return {
    memberships: [{ panelId: PANEL_A1, competitionId: COMPETITION_A, round: 'preliminary' }],
    panelTracks: [{ panelId: PANEL_A1, trackId: TRACK }],
    project: { id: PROJECT, competitionId: COMPETITION_A, trackId: TRACK },
    requestedPanelId: AUTO_PANEL,
    round: 'preliminary',
    ...overrides,
  }
}

describe('eligibleScoringPanelIds', () => {
  it('keeps only panels of the competition that owns the project', () => {
    const eligible = eligibleScoringPanelIds(input({
      memberships: [
        { panelId: PANEL_B1, competitionId: COMPETITION_B },
        { panelId: PANEL_A1, competitionId: COMPETITION_A },
      ],
      panelTracks: [
        { panelId: PANEL_B1, trackId: TRACK },
        { panelId: PANEL_A1, trackId: TRACK },
      ],
    }))
    expect(eligible).toEqual([PANEL_A1])
  })

  it('drops a panel whose tracks do not cover the project', () => {
    expect(eligibleScoringPanelIds(input({
      panelTracks: [{ panelId: PANEL_A1, trackId: OTHER_TRACK }],
    }))).toEqual([])
  })

  it('treats a panel with no track assignments as covering nothing', () => {
    // Same reading `my-assignments` uses: a panel with no tracks is offered no projects, so it
    // must not be able to score one either.
    expect(eligibleScoringPanelIds(input({ panelTracks: [] }))).toEqual([])
  })

  it('deduplicates and orders by id so `auto` is deterministic', () => {
    const eligible = eligibleScoringPanelIds(input({
      memberships: [
        { panelId: PANEL_A2, competitionId: COMPETITION_A },
        { panelId: PANEL_A1, competitionId: COMPETITION_A },
        { panelId: PANEL_A2, competitionId: COMPETITION_A },
      ],
      panelTracks: [
        { panelId: PANEL_A2, trackId: TRACK },
        { panelId: PANEL_A1, trackId: TRACK },
      ],
    }))
    expect(eligible).toEqual([PANEL_A1, PANEL_A2])
  })
})

describe('resolveScoringPanel', () => {
  it('rejects a caller who sits on no panel at all', () => {
    // The reported bug: this path used to fall back to the all-zeros sentinel UUID and the
    // score was persisted as if a panel had produced it.
    expect(resolveScoringPanel(input({ memberships: [], panelTracks: [] }))).toEqual({
      ok: false,
      reason: 'not_assigned',
    })
  })

  it('rejects a judge whose only panels belong to another competition', () => {
    expect(resolveScoringPanel(input({
      memberships: [{ panelId: PANEL_B1, competitionId: COMPETITION_B }],
      panelTracks: [{ panelId: PANEL_B1, trackId: TRACK }],
    }))).toEqual({ ok: false, reason: 'not_assigned' })
  })

  it('distinguishes "not on a panel here" from "panel does not cover this track"', () => {
    expect(resolveScoringPanel(input({
      panelTracks: [{ panelId: PANEL_A1, trackId: OTHER_TRACK }],
    }))).toEqual({ ok: false, reason: 'track_not_covered' })
  })

  it('resolves `auto` to a panel of the project\'s own competition', () => {
    // Judy Judge sits on panels in two competitions (issue #106): the panel stored must be the
    // one belonging to the scored project, not whichever membership row was read first.
    expect(resolveScoringPanel(input({
      memberships: [
        { panelId: PANEL_B1, competitionId: COMPETITION_B, round: 'preliminary' },
        { panelId: PANEL_A1, competitionId: COMPETITION_A, round: 'preliminary' },
      ],
      panelTracks: [
        { panelId: PANEL_B1, trackId: TRACK },
        { panelId: PANEL_A1, trackId: TRACK },
      ],
    }))).toEqual({ ok: true, panelId: PANEL_A1 })
  })

  it('prefers the panel whose round matches the round being scored', () => {
    expect(resolveScoringPanel(input({
      memberships: [
        { panelId: PANEL_A1, competitionId: COMPETITION_A, round: 'final' },
        { panelId: PANEL_A2, competitionId: COMPETITION_A, round: 'preliminary' },
      ],
      panelTracks: [
        { panelId: PANEL_A1, trackId: TRACK },
        { panelId: PANEL_A2, trackId: TRACK },
      ],
      round: 'preliminary',
    }))).toEqual({ ok: true, panelId: PANEL_A2 })
  })

  it('still resolves when no panel matches the round — the round only breaks ties', () => {
    // The portal scoring page hardcodes `round: 'preliminary'`; excluding a `final` panel would
    // lock a judge out of a competition whose only panel is configured that way.
    expect(resolveScoringPanel(input({
      memberships: [{ panelId: PANEL_A1, competitionId: COMPETITION_A, round: 'final' }],
      round: 'preliminary',
    }))).toEqual({ ok: true, panelId: PANEL_A1 })
  })

  it('accepts an explicit panel id the caller is eligible for', () => {
    expect(resolveScoringPanel(input({
      memberships: [
        { panelId: PANEL_A1, competitionId: COMPETITION_A },
        { panelId: PANEL_A2, competitionId: COMPETITION_A },
      ],
      panelTracks: [
        { panelId: PANEL_A1, trackId: TRACK },
        { panelId: PANEL_A2, trackId: TRACK },
      ],
      requestedPanelId: PANEL_A2,
    }))).toEqual({ ok: true, panelId: PANEL_A2 })
  })

  it('rejects an explicit panel from another competition', () => {
    expect(resolveScoringPanel(input({
      memberships: [
        { panelId: PANEL_A1, competitionId: COMPETITION_A },
        { panelId: PANEL_B1, competitionId: COMPETITION_B },
      ],
      panelTracks: [
        { panelId: PANEL_A1, trackId: TRACK },
        { panelId: PANEL_B1, trackId: TRACK },
      ],
      requestedPanelId: PANEL_B1,
    }))).toEqual({ ok: false, reason: 'panel_not_eligible' })
  })

  it('rejects an explicit panel the caller does not sit on', () => {
    expect(resolveScoringPanel(input({ requestedPanelId: PANEL_A2 })))
      .toEqual({ ok: false, reason: 'panel_not_eligible' })
  })

  it('never returns the all-zeros sentinel', () => {
    const denied = resolveScoringPanel(input({
      memberships: [],
      panelTracks: [],
      requestedPanelId: '00000000-0000-0000-0000-000000000000',
    }))
    expect(denied.ok).toBe(false)
  })
})

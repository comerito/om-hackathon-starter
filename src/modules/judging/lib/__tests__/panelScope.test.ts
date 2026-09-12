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

function input(overrides: Partial<ResolveScoringPanelInput> = {}): ResolveScoringPanelInput {
  return {
    memberships: [{ panelId: PANEL_A1, competitionId: COMPETITION_A }],
    project: { id: PROJECT, competitionId: COMPETITION_A, trackId: TRACK },
    requestedPanelId: AUTO_PANEL,
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
    }))
    expect(eligible).toEqual([PANEL_A1])
  })

  it('deduplicates and orders by id so `auto` is deterministic', () => {
    const eligible = eligibleScoringPanelIds(input({
      memberships: [
        { panelId: PANEL_A2, competitionId: COMPETITION_A },
        { panelId: PANEL_A1, competitionId: COMPETITION_A },
        { panelId: PANEL_A2, competitionId: COMPETITION_A },
      ],
    }))
    expect(eligible).toEqual([PANEL_A1, PANEL_A2])
  })
})

describe('resolveScoringPanel', () => {
  it('rejects a caller who sits on no panel at all', () => {
    // The reported bug: this path used to fall back to the all-zeros sentinel UUID and the
    // score was persisted as if a panel had produced it.
    expect(resolveScoringPanel(input({ memberships: [] }))).toEqual({
      ok: false,
      reason: 'not_assigned',
    })
  })

  it('rejects a judge whose only panels belong to another competition', () => {
    expect(resolveScoringPanel(input({
      memberships: [{ panelId: PANEL_B1, competitionId: COMPETITION_B }],
    }))).toEqual({ ok: false, reason: 'not_assigned' })
  })

  it('resolves `auto` to a panel of the project\'s own competition', () => {
    // Judy Judge sits on panels in two competitions (issue #106): the panel stored must be the
    // one belonging to the scored project, not whichever membership row was read first.
    expect(resolveScoringPanel(input({
      memberships: [
        { panelId: PANEL_B1, competitionId: COMPETITION_B },
        { panelId: PANEL_A1, competitionId: COMPETITION_A },
      ],
    }))).toEqual({ ok: true, panelId: PANEL_A1 })
  })

  it('accepts an explicit panel id the caller is eligible for', () => {
    expect(resolveScoringPanel(input({
      memberships: [
        { panelId: PANEL_A1, competitionId: COMPETITION_A },
        { panelId: PANEL_A2, competitionId: COMPETITION_A },
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
      requestedPanelId: '00000000-0000-0000-0000-000000000000',
    }))
    expect(denied.ok).toBe(false)
  })
})

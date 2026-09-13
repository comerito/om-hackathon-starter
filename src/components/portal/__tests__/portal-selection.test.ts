import {
  MIN_STAGE_FOR_ITEM,
  PORTAL_SELECTION_KEYS,
  filterNavItemsByStage,
  isSamePortalSelection,
} from '../portal-selection'

/**
 * Regression guard for issue #115: stage-gated sidebar items ("Moj projekt") stayed hidden after
 * the competition advanced, until a full page reload.
 *
 * The re-read half of that bug lives in `usePortalSelection` (a React effect); the decision half
 * is this pure filter, and it is what makes "the stage advanced, so the item appears" assertable
 * without a DOM.
 */

const item = (id: string) => ({ id })

const NAV = [
  item('competitions.portal-dashboard'),
  item('projects.portal-my-project'),
  item('judging.portal-presentations'),
  item('judging.portal-results'),
  item('sponsors.portal-voting'),
]

const ids = (items: Array<{ id: string }>) => items.map((i) => i.id)

describe('filterNavItemsByStage', () => {
  it('leaves ungated items alone at every stage', () => {
    for (const stage of [null, 'draft', 'team_formation', 'archived', 'nonsense']) {
      expect(ids(filterNavItemsByStage(NAV, stage, 'participant'))).toContain('competitions.portal-dashboard')
    }
  })

  it('hides every gated item while the stage is unknown', () => {
    expect(ids(filterNavItemsByStage(NAV, null, 'participant'))).toEqual(['competitions.portal-dashboard'])
  })

  it('treats an unrecognised stage as unknown rather than as "latest"', () => {
    expect(ids(filterNavItemsByStage(NAV, 'not_a_stage', 'participant'))).toEqual(['competitions.portal-dashboard'])
  })

  // The reproduction in #115: the stage advances to team_formation and "My Project" must appear.
  it('reveals My Project once the competition reaches team_formation', () => {
    expect(ids(filterNavItemsByStage(NAV, 'open', 'participant'))).not.toContain('projects.portal-my-project')
    expect(ids(filterNavItemsByStage(NAV, 'team_formation', 'participant'))).toContain('projects.portal-my-project')
    expect(ids(filterNavItemsByStage(NAV, 'hacking', 'participant'))).toContain('projects.portal-my-project')
  })

  it('applies each gate at its own minimum stage, not all at once', () => {
    expect(ids(filterNavItemsByStage(NAV, 'demos', 'participant'))).toEqual([
      'competitions.portal-dashboard',
      'projects.portal-my-project',
      'judging.portal-presentations',
      'sponsors.portal-voting',
    ])
    expect(ids(filterNavItemsByStage(NAV, 'deliberation', 'participant'))).toContain('judging.portal-results')
  })

  it('skips role-scoped gates for roles they do not name', () => {
    // Judges/mentors see the judging pages regardless of stage; participants do not.
    const mentor = ids(filterNavItemsByStage(NAV, 'hacking', 'mentor'))
    expect(mentor).toContain('judging.portal-presentations')
    expect(mentor).toContain('judging.portal-results')
    expect(mentor).toContain('sponsors.portal-voting')
    expect(ids(filterNavItemsByStage(NAV, 'hacking', 'participant'))).not.toContain('judging.portal-presentations')
  })

  it('applies role-scoped gates when the role is not yet known', () => {
    // A null role must not be read as "some other role" — that would leak participant-only pages.
    expect(ids(filterNavItemsByStage(NAV, 'hacking', null))).not.toContain('judging.portal-results')
  })

  it('does not mutate the input array', () => {
    const input = [...NAV]
    filterNavItemsByStage(input, 'draft', 'participant')
    expect(input).toHaveLength(NAV.length)
  })
})

describe('portal selection storage keys', () => {
  it('stays on the hackon: namespace the rest of the portal reads', () => {
    expect(Object.values(PORTAL_SELECTION_KEYS)).toEqual([
      'hackon:selected-competition',
      'hackon:selected-competition-stage',
      'hackon:selected-competition-role',
    ])
  })

  it('gates exactly the items the sidebar groups know about', () => {
    // A gate for an id that no longer exists silently stops gating anything.
    expect(MIN_STAGE_FOR_ITEM.map((r) => r.id)).toEqual([
      'projects.portal-my-project',
      'judging.portal-presentations',
      'judging.portal-results',
      'sponsors.portal-voting',
    ])
  })
})

describe('isSamePortalSelection', () => {
  const base = { competitionId: 'c1', stage: 'hacking', role: 'participant' }

  it('is true for equal selections', () => {
    expect(isSamePortalSelection(base, { ...base })).toBe(true)
  })

  it('notices a stage change — the field #115 is about', () => {
    expect(isSamePortalSelection(base, { ...base, stage: 'demos' })).toBe(false)
  })

  it('notices competition and role changes', () => {
    expect(isSamePortalSelection(base, { ...base, competitionId: 'c2' })).toBe(false)
    expect(isSamePortalSelection(base, { ...base, role: 'mentor' })).toBe(false)
  })
})

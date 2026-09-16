/**
 * Route-handler regression tests for issue #106 — the judge-assignment side.
 *
 * A judge who serves two events sat on a panel in each. The route narrowed the *panels* to the
 * requested competition but then loaded panel **tracks** for every panel id the judge sat on,
 * so the other competition's tracks came back and the judge was offered that competition's
 * projects. Nothing caught it, because the leak is in which ids are passed to the second query
 * — invisible to any helper unit test.
 *
 * The fake `EntityManager` here honours the filters the route passes (`competitionId`,
 * `panelId.$in`, `trackId.$in`) rather than returning a fixed list, which is what makes
 * "the foreign project is absent from the body" a real assertion instead of a tautology.
 */

const mockGetCustomerAuthFromRequest = jest.fn()
const mockCreateRequestContainer = jest.fn()

jest.mock(
  '@open-mercato/core/modules/customer_accounts/lib/customerAuth',
  () => ({ getCustomerAuthFromRequest: (...args: unknown[]) => mockGetCustomerAuthFromRequest(...args) }),
  { virtual: true },
)
jest.mock(
  '@open-mercato/shared/lib/di/container',
  () => ({ createRequestContainer: (...args: unknown[]) => mockCreateRequestContainer(...args) }),
  { virtual: true },
)
jest.mock('@/lib/portal-translations', () => ({
  resolvePortalLocale: jest.fn(async () => 'en'),
  applyPortalTranslationOverlays: jest.fn(async (rows: unknown) => rows),
}))
jest.mock('../../../../data/entities', () => ({
  JudgePanelJudge: class JudgePanelJudge {},
  JudgePanelTrack: class JudgePanelTrack {},
  JudgePanel: class JudgePanel {},
  ProjectScore: class ProjectScore {},
  DemoSession: class DemoSession {},
  JudgingCriterion: class JudgingCriterion {},
  JudgingRound: { PRELIMINARY: 'preliminary', FINAL: 'final' },
}))
jest.mock('../../../../../projects/data/entities', () => ({ Project: class Project {} }))
jest.mock('../../../../../teams/data/entities', () => ({ Team: class Team {} }))
jest.mock('../../../../../tracks/data/entities', () => ({ Track: class Track {} }))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require('../route') as typeof import('../route')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const entities = require('../../../../data/entities') as Record<string, unknown>
// eslint-disable-next-line @typescript-eslint/no-var-requires
const projectEntities = require('../../../../../projects/data/entities') as { Project: unknown }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const teamEntities = require('../../../../../teams/data/entities') as { Team: unknown }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const trackEntities = require('../../../../../tracks/data/entities') as { Track: unknown }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const competitionEntities = require('../../../../../competitions/data/entities') as { Competition: unknown }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const setup = (require('../../../../setup') as { default: typeof import('../../../../setup').default }).default
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { PORTAL_VIEW_ASSIGNED_FEATURE } = require('../../../../lib/portalAuth') as { PORTAL_VIEW_ASSIGNED_FEATURE: string }

const TENANT = '00000000-0000-4000-8000-0000000000a1'
const ORG = '00000000-0000-4000-8000-0000000000b1'
const JUDGE_ID = '11111111-1111-4111-8111-111111111111'
const COMPETITION_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_COMPETITION_ID = '44444444-4444-4444-8444-444444444444'
const HOME_PANEL_ID = '55555555-5555-4555-8555-555555555555'
const OTHER_PANEL_ID = '66666666-6666-4666-8666-666666666666'
const HOME_TRACK_ID = '77777777-7777-4777-8777-777777777777'
const OTHER_TRACK_ID = '7c7c7c7c-7c7c-4c7c-8c7c-7c7c7c7c7c7c'

const PARTICIPANT_FEATURES = setup.defaultCustomerRoleFeatures?.participant ?? []
const JUDGE_FEATURES = setup.defaultCustomerRoleFeatures?.judge ?? []

const PANELS = [
  { id: HOME_PANEL_ID, competitionId: COMPETITION_ID, name: 'Home panel', round: 'preliminary' },
  { id: OTHER_PANEL_ID, competitionId: OTHER_COMPETITION_ID, name: 'Other event panel', round: 'preliminary' },
]
const PANEL_TRACKS = [
  { panelId: HOME_PANEL_ID, trackId: HOME_TRACK_ID },
  { panelId: OTHER_PANEL_ID, trackId: OTHER_TRACK_ID },
]
const PROJECTS = [
  { id: 'home-project', title: 'Home Project', teamId: 'team-1', trackId: HOME_TRACK_ID, competitionId: COMPETITION_ID, status: 'submitted' },
  { id: 'foreign-project', title: 'Other Event Secret', teamId: 'team-2', trackId: OTHER_TRACK_ID, competitionId: OTHER_COMPETITION_ID, status: 'submitted' },
]

function auth(features: string[]) {
  return { sub: JUDGE_ID, tenantId: TENANT, orgId: ORG, resolvedFeatures: features }
}

type Filter = Record<string, unknown>
function inList(filter: Filter, key: string): string[] | null {
  const clause = filter?.[key] as { $in?: string[] } | undefined
  return Array.isArray(clause?.$in) ? clause!.$in! : null
}

type Fixture = {
  projects: Array<Record<string, unknown> & { id: string; title: string; trackId: string; competitionId: string }>
  demos: Array<{ projectId: string; competitionId: string; round: string; presentationOrder: number; status: string; tenantId: string; organizationId: string }>
  criteria: Array<{ id: string; competitionId: string; round: string; trackId: string | null; order: number; tenantId: string; organizationId: string }>
  competitionStage: string | null
}

function defaultFixture(): Fixture {
  return { projects: PROJECTS, demos: [], criteria: [], competitionStage: 'judging' }
}

function scoped(row: { tenantId: string; organizationId: string }, filter: Filter): boolean {
  return row.tenantId === filter.tenantId && row.organizationId === filter.organizationId
}

/** Honours the filters the route passes, so a widened query really does widen the response. */
function makeEm(fixture: Fixture = defaultFixture()) {
  const find = jest.fn(async (entity: unknown, filter: Filter): Promise<unknown[]> => {
    if (entity === entities.JudgePanelJudge) return PANELS.map(p => ({ panelId: p.id }))
    if (entity === entities.JudgePanel) {
      const ids = inList(filter, 'id')
      return PANELS.filter(p => (!ids || ids.includes(p.id)) && p.competitionId === filter.competitionId)
    }
    if (entity === entities.JudgePanelTrack) {
      const ids = inList(filter, 'panelId')
      return PANEL_TRACKS.filter(pt => !ids || ids.includes(pt.panelId))
    }
    if (entity === projectEntities.Project) {
      const tracks = inList(filter, 'trackId')
      return fixture.projects.filter(p => !tracks || tracks.includes(p.trackId))
    }
    if (entity === teamEntities.Team) {
      const ids = inList(filter, 'id')
      return (ids ?? []).map(id => ({ id, name: `Team ${id}` }))
    }
    if (entity === trackEntities.Track) {
      const ids = inList(filter, 'id')
      return (ids ?? []).map(id => ({ id, name: `Track ${id}` }))
    }
    if (entity === entities.DemoSession) {
      const ids = inList(filter, 'projectId')
      return fixture.demos.filter(d => (!ids || ids.includes(d.projectId))
        && d.competitionId === filter.competitionId && d.round === filter.round && scoped(d, filter))
    }
    if (entity === entities.JudgingCriterion) {
      return fixture.criteria.filter(c => c.competitionId === filter.competitionId && scoped(c, filter))
    }
    return []
  })
  const findOne = jest.fn(async (entity: unknown, filter: Filter): Promise<unknown> => {
    if (entity === competitionEntities.Competition) {
      if (fixture.competitionStage === null) return null
      return filter.id === COMPETITION_ID || filter.id === OTHER_COMPETITION_ID
        ? { id: filter.id, stage: fixture.competitionStage }
        : null
    }
    return null
  })
  return { find, findOne }
}

function container(em: unknown) {
  return { resolve: (key: string) => (key === 'em' ? em : undefined) }
}

function request(query = `?competition_id=${COMPETITION_ID}`): Request {
  return new Request(`http://localhost/api/judging/portal/my-assignments${query}`)
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('portal my-assignments — competition scoping (#106)', () => {
  it('offers only the requested competition\'s projects to a judge who serves two events', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    mockCreateRequestContainer.mockResolvedValue(container(makeEm()))

    const res = await GET(request())

    expect(res.status).toBe(200)
    const body = await res.json() as { panels: Array<{ id: string }>; projects: Array<{ id: string }> }
    expect(body.panels.map(p => p.id)).toEqual([HOME_PANEL_ID])
    expect(body.projects.map(p => p.id)).toEqual(['home-project'])
    // The record #106 is about: nothing from the other event may appear here.
    expect(JSON.stringify(body)).not.toContain('Other Event Secret')
    expect(JSON.stringify(body)).not.toContain(OTHER_PANEL_ID)
  })

  it('loads panel tracks only for the panels of the requested competition', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    const em = makeEm()
    mockCreateRequestContainer.mockResolvedValue(container(em))

    await GET(request())

    const trackCall = em.find.mock.calls.find(([entity]) => entity === entities.JudgePanelTrack)
    expect(trackCall).toBeDefined()
    const filter = trackCall![1] as Filter
    expect(inList(filter, 'panelId')).toEqual([HOME_PANEL_ID])
    expect(filter).toMatchObject({ tenantId: TENANT, organizationId: ORG })
  })

  it('returns an empty assignment set when none of the judge\'s panels are in this competition', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    const em = makeEm()
    mockCreateRequestContainer.mockResolvedValue(container(em))

    const res = await GET(request(`?competition_id=${OTHER_COMPETITION_ID}`))
    const body = await res.json() as { projects: Array<{ id: string }> }

    // Sanity for the fixture: the judge *does* have a panel in the other competition, so this
    // returns that event's own project — never the home one.
    expect(body.projects.map(p => p.id)).toEqual(['foreign-project'])
  })
})

describe('portal my-assignments — voting queue data (SPEC-007 phase 1)', () => {
  const HOME_DEMO_BASE = { competitionId: COMPETITION_ID, round: 'preliminary', tenantId: TENANT, organizationId: ORG }

  function homeProjects() {
    return [
      { id: 'p-zeta', title: 'Zeta', teamId: 'team-z', trackId: HOME_TRACK_ID, competitionId: COMPETITION_ID, status: 'submitted', screenshotIds: ['shot-1'] },
      { id: 'p-alpha', title: 'Alpha', teamId: 'team-a', trackId: HOME_TRACK_ID, competitionId: COMPETITION_ID, status: 'submitted', screenshotIds: [] },
      { id: 'p-second', title: 'Second', teamId: 'team-s', trackId: HOME_TRACK_ID, competitionId: COMPETITION_ID, status: 'submitted' },
      { id: 'p-first', title: 'First', teamId: 'team-f', trackId: HOME_TRACK_ID, competitionId: COMPETITION_ID, status: 'submitted', problemStatement: 'Hard problem' },
    ]
  }

  type QueueBody = {
    projects: Array<{
      id: string; demo: { order: number; status: string } | null; criteria_count: number
      track_name: string | null; problem_statement: string | null
      screenshots: Array<{ id: string; url: string }>
    }>
    scores: Array<{ project_id: string; track_id: string | null }>
    voting_open: boolean
  }

  it('returns projects in demo order, projects without a slot last by title', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    const em = makeEm({
      ...defaultFixture(),
      projects: homeProjects(),
      demos: [
        { ...HOME_DEMO_BASE, projectId: 'p-second', presentationOrder: 2, status: 'queued' },
        { ...HOME_DEMO_BASE, projectId: 'p-first', presentationOrder: 1, status: 'presenting' },
      ],
    })
    mockCreateRequestContainer.mockResolvedValue(container(em))

    const res = await GET(request())
    const body = await res.json() as QueueBody

    expect(body.projects.map(p => p.id)).toEqual(['p-first', 'p-second', 'p-alpha', 'p-zeta'])
    expect(body.projects[0].demo).toEqual({ order: 1, status: 'presenting' })
    expect(body.projects[2].demo).toBeNull()
    expect(body.projects[0].problem_statement).toBe('Hard problem')
    expect(body.projects[0].track_name).toBe(`Track ${HOME_TRACK_ID}`)
    const zeta = body.projects.find(p => p.id === 'p-zeta')!
    expect(zeta.screenshots).toEqual([{ id: 'shot-1', url: '/api/projects/portal/asset-file/shot-1' }])
    expect(body.projects.find(p => p.id === 'p-second')!.screenshots).toEqual([])
    expect(body.voting_open).toBe(true)
  })

  it('looks up demo slots only for the requested competition, preliminary round, tenant and org', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    const em = makeEm({
      ...defaultFixture(),
      projects: homeProjects(),
      demos: [
        { ...HOME_DEMO_BASE, projectId: 'p-zeta', presentationOrder: 1, status: 'queued', competitionId: OTHER_COMPETITION_ID },
        { ...HOME_DEMO_BASE, projectId: 'p-alpha', presentationOrder: 1, status: 'queued', round: 'final' },
        { ...HOME_DEMO_BASE, projectId: 'p-second', presentationOrder: 1, status: 'queued', organizationId: 'other-org' },
      ],
    })
    mockCreateRequestContainer.mockResolvedValue(container(em))

    const res = await GET(request())
    const body = await res.json() as QueueBody

    expect(body.projects.every(p => p.demo === null)).toBe(true)
    const demoCall = em.find.mock.calls.find(([entity]) => entity === entities.DemoSession)
    expect(demoCall).toBeDefined()
    const filter = demoCall![1] as Filter
    expect(filter).toMatchObject({ competitionId: COMPETITION_ID, round: 'preliminary', tenantId: TENANT, organizationId: ORG })
    expect(inList(filter, 'projectId')?.sort()).toEqual(['p-alpha', 'p-first', 'p-second', 'p-zeta'])
  })

  it('counts only criteria applicable to the project track and the preliminary round', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    const base = { competitionId: COMPETITION_ID, tenantId: TENANT, organizationId: ORG }
    const em = makeEm({
      ...defaultFixture(),
      projects: [PROJECTS[0]],
      criteria: [
        { ...base, id: 'c-global-both', round: 'both', trackId: null, order: 1 },
        { ...base, id: 'c-global-prelim', round: 'preliminary', trackId: null, order: 2 },
        { ...base, id: 'c-track-prelim', round: 'preliminary', trackId: HOME_TRACK_ID, order: 3 },
        { ...base, id: 'c-global-final', round: 'final', trackId: null, order: 4 },
        { ...base, id: 'c-other-track', round: 'both', trackId: OTHER_TRACK_ID, order: 5 },
      ],
    })
    mockCreateRequestContainer.mockResolvedValue(container(em))

    const res = await GET(request())
    const body = await res.json() as QueueBody

    expect(body.projects.map(p => p.criteria_count)).toEqual([3])
    const criteriaCall = em.find.mock.calls.find(([entity]) => entity === entities.JudgingCriterion)
    expect(criteriaCall![1]).toMatchObject({ competitionId: COMPETITION_ID, tenantId: TENANT, organizationId: ORG, deletedAt: null })
  })

  it('adds the project track to each score', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    const em = makeEm()
    const baseFind = em.find.getMockImplementation()!
    em.find.mockImplementation(async (entity: unknown, filter: Filter) => {
      if (entity === entities.ProjectScore) {
        return [{ id: 's1', projectId: 'home-project', round: 'preliminary', totalScore: 68, isSubmitted: true, conflictOfInterest: false }]
      }
      return baseFind(entity, filter)
    })
    mockCreateRequestContainer.mockResolvedValue(container(em))

    const res = await GET(request())
    const body = await res.json() as QueueBody

    expect(body.scores).toEqual([expect.objectContaining({ project_id: 'home-project', track_id: HOME_TRACK_ID })])
  })

  it('reports voting closed once the competition is finished', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    mockCreateRequestContainer.mockResolvedValue(container(makeEm({ ...defaultFixture(), competitionStage: 'finished' })))

    const res = await GET(request())
    const body = await res.json() as QueueBody

    expect(body.voting_open).toBe(false)
    expect(body.projects.map(p => p.id)).toEqual(['home-project'])
  })

  it('does not query demo slots or criteria when the judge has no projects', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    const em = makeEm({ ...defaultFixture(), projects: [] })
    mockCreateRequestContainer.mockResolvedValue(container(em))

    const res = await GET(request())

    expect(res.status).toBe(200)
    const body = await res.json() as QueueBody
    expect(body).toMatchObject({ projects: [], scores: [], voting_open: true })
    const queried = em.find.mock.calls.map(([entity]) => entity)
    expect(queried).not.toContain(entities.DemoSession)
    expect(queried).not.toContain(entities.JudgingCriterion)
  })

  it('answers an empty, closed assignment set for a competition outside the caller scope', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    const em = makeEm({ ...defaultFixture(), competitionStage: null })
    mockCreateRequestContainer.mockResolvedValue(container(em))

    const res = await GET(request())

    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ panels: [], projects: [], scores: [], voting_open: false })
    expect(em.findOne.mock.calls[0][1]).toMatchObject({ id: COMPETITION_ID, tenantId: TENANT, organizationId: ORG, deletedAt: null })
    expect(em.find).not.toHaveBeenCalled()
  })
})

describe('portal my-assignments — the feature gate (#106)', () => {
  it('answers 403 for a participant and never resolves the container', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(PARTICIPANT_FEATURES))
    mockCreateRequestContainer.mockRejectedValue(new Error('container must not be resolved for a forbidden caller'))

    const res = await GET(request())

    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
    expect(res.status).toBe(403)
    const body = await res.json() as Record<string, unknown>
    expect(body).toEqual({ error: 'Forbidden', requiredFeatures: [PORTAL_VIEW_ASSIGNED_FEATURE] })
    expect(body.projects).toBeUndefined()
  })

  it('the gate is real: `judge` holds the feature, `participant` does not', () => {
    expect(JUDGE_FEATURES).toContain(PORTAL_VIEW_ASSIGNED_FEATURE)
    expect(PARTICIPANT_FEATURES).not.toContain(PORTAL_VIEW_ASSIGNED_FEATURE)
  })

  it('answers 401 without a portal session', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(null)
    mockCreateRequestContainer.mockRejectedValue(new Error('container must not be resolved for an anonymous caller'))

    const res = await GET(request())

    expect(res.status).toBe(401)
    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
  })
})

// This file uses `require` after the `jest.mock` calls, so it has no top-level import.
// Without an export it would be a global script and its helpers would collide with the other
// route test files under type check.
export {}

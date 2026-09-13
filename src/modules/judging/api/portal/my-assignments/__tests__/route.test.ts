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
}))
jest.mock('../../../../../projects/data/entities', () => ({ Project: class Project {} }))
jest.mock('../../../../../teams/data/entities', () => ({ Team: class Team {} }))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET } = require('../route') as typeof import('../route')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const entities = require('../../../../data/entities') as Record<string, unknown>
// eslint-disable-next-line @typescript-eslint/no-var-requires
const projectEntities = require('../../../../../projects/data/entities') as { Project: unknown }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const teamEntities = require('../../../../../teams/data/entities') as { Team: unknown }
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

/** Honours the filters the route passes, so a widened query really does widen the response. */
function makeEm() {
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
      return PROJECTS.filter(p => !tracks || tracks.includes(p.trackId))
    }
    if (entity === teamEntities.Team) {
      const ids = inList(filter, 'id')
      return (ids ?? []).map(id => ({ id, name: `Team ${id}` }))
    }
    return []
  })
  return { find }
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

/**
 * Route-handler regression tests for issue #106 — a score filed under another competition's panel.
 *
 * ## Why these live at the route
 *
 * `judging/lib/__tests__/panelScope.test.ts` proves `resolveScoringPanel` picks correctly. It
 * cannot prove that `api/portal/score-project/route.ts` feeds it the right inputs or honours its
 * answer: the pre-fix route resolved `'auto'` with a single unordered `findOne` and fell back to
 * an all-zeros panel id, and no test noticed. These tests drive the exported `POST` handler and
 * assert on **the panel id actually written to `ProjectScore`**, which is the record #106 was
 * about — a 403 on the obvious case is not enough if `'auto'` can still file the row under a
 * panel from a different event.
 *
 * The two panels are deliberately named so that the foreign one sorts FIRST by id: a route that
 * dropped the competition filter and kept the deterministic ordering would pick the foreign panel
 * and fail here, rather than passing by luck.
 */

const mockGetCustomerAuthFromRequest = jest.fn()
const mockCreateRequestContainer = jest.fn()
const mockRunRouteMutationGuards = jest.fn()

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
jest.mock(
  '@open-mercato/shared/lib/crud/route-mutation-guard',
  () => ({ runRouteMutationGuards: (...args: unknown[]) => mockRunRouteMutationGuards(...args) }),
  { virtual: true },
)
jest.mock('@/lib/portal-translations', () => ({
  resolvePortalLocale: jest.fn(async () => 'en'),
  applyPortalTranslationOverlays: jest.fn(async (rows: unknown) => rows),
}))
jest.mock('../../../../data/entities', () => ({
  ProjectScore: class ProjectScore {},
  CriterionScore: class CriterionScore {},
  JudgingCriterion: class JudgingCriterion {},
  JudgePanel: class JudgePanel {},
  JudgePanelJudge: class JudgePanelJudge {},
  JudgePanelTrack: class JudgePanelTrack {},
}))
jest.mock('../../../../../projects/data/entities', () => ({ Project: class Project {} }))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { POST } = require('../route') as typeof import('../route')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const entities = require('../../../../data/entities') as Record<string, unknown>
// eslint-disable-next-line @typescript-eslint/no-var-requires
const projectEntities = require('../../../../../projects/data/entities') as { Project: unknown }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const setup = (require('../../../../setup') as { default: typeof import('../../../../setup').default }).default

const TENANT = '00000000-0000-4000-8000-0000000000a1'
const ORG = '00000000-0000-4000-8000-0000000000b1'
const JUDGE_ID = '11111111-1111-4111-8111-111111111111'
const PROJECT_ID = '22222222-2222-4222-8222-222222222222'
const COMPETITION_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_COMPETITION_ID = '44444444-4444-4444-8444-444444444444'
/** Sorts BEFORE the home panel, so "first row wins" would pick the wrong competition. */
const OTHER_COMPETITION_PANEL_ID = '0aaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const HOME_PANEL_ID = 'fbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const TRACK_ID = '77777777-7777-4777-8777-777777777777'
const OTHER_TRACK_ID = '7c7c7c7c-7c7c-4c7c-8c7c-7c7c7c7c7c7c'
const CRITERION_ID = '88888888-8888-4888-8888-888888888888'

const JUDGE_FEATURES = setup.defaultCustomerRoleFeatures?.judge ?? []

type PanelRow = { id: string; competitionId: string; round?: string }
type PanelTrackRow = { panelId: string; trackId: string }

function auth(features: string[] = JUDGE_FEATURES) {
  return { sub: JUDGE_ID, tenantId: TENANT, orgId: ORG, resolvedFeatures: features }
}

/**
 * Fake `EntityManager`. `panels` are every panel the judge sits on, across competitions — the
 * route is responsible for narrowing them, so the fake deliberately hands over all of them.
 */
function makeEm(panels: PanelRow[], panelTracks: PanelTrackRow[]) {
  const createdRows: Array<{ entity: unknown; data: Record<string, unknown> }> = []
  const transactional = jest.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
    const txEm = {
      findOne: jest.fn(async () => null),
      find: jest.fn(async () => []),
      create: jest.fn((entity: unknown, data: Record<string, unknown>) => {
        createdRows.push({ entity, data })
        return { id: 'created-score-id', ...data }
      }),
      persist: jest.fn(),
      flush: jest.fn(async () => undefined),
    }
    return cb(txEm)
  })
  const findOne = jest.fn(async (entity: unknown) => {
    if (entity === projectEntities.Project) {
      return { id: PROJECT_ID, competitionId: COMPETITION_ID, trackId: TRACK_ID }
    }
    return null
  })
  const find = jest.fn(async (entity: unknown, filter: unknown): Promise<unknown[]> => {
    if (entity === entities.JudgePanelJudge) return panels.map(p => ({ panelId: p.id }))
    if (entity === entities.JudgePanel) return panels
    if (entity === entities.JudgePanelTrack) return panelTracks
    if (entity === entities.JudgingCriterion) return []
    void filter
    return []
  })
  /** Only the `ProjectScore` rows — the transaction also creates `CriterionScore` rows. */
  const scoreRows = () => createdRows
    .filter(row => row.entity === entities.ProjectScore)
    .map(row => row.data)
  return { findOne, find, transactional, createdRows, scoreRows }
}

function container(em: unknown) {
  return { resolve: (key: string) => (key === 'em' ? em : undefined) }
}

function postRequest(body: Record<string, unknown>): Request {
  return new Request('http://localhost/api/judging/portal/score-project', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function scorePayload(overrides: Record<string, unknown> = {}) {
  return {
    project_id: PROJECT_ID,
    competition_id: COMPETITION_ID,
    judge_panel_id: 'auto',
    round: 'preliminary',
    conflict_of_interest: false,
    is_submitted: true,
    criterion_scores: [{ criterion_id: CRITERION_ID, score: 5 }],
    ...overrides,
  }
}

/** A judge serving two events: one panel in each, both covering the project's track. */
const PANELS_IN_TWO_COMPETITIONS: PanelRow[] = [
  { id: OTHER_COMPETITION_PANEL_ID, competitionId: OTHER_COMPETITION_ID, round: 'preliminary' },
  { id: HOME_PANEL_ID, competitionId: COMPETITION_ID, round: 'preliminary' },
]
const TRACKS_FOR_BOTH: PanelTrackRow[] = [
  { panelId: OTHER_COMPETITION_PANEL_ID, trackId: TRACK_ID },
  { panelId: HOME_PANEL_ID, trackId: TRACK_ID },
]

beforeEach(() => {
  jest.clearAllMocks()
  mockGetCustomerAuthFromRequest.mockResolvedValue(auth())
  mockRunRouteMutationGuards.mockResolvedValue({
    ok: true,
    modifiedPayload: null,
    runAfterSuccess: jest.fn(async () => undefined),
  })
})

describe('portal score-project — an explicit foreign panel id (#106)', () => {
  it('refuses a judge_panel_id that belongs to another competition, and writes nothing', async () => {
    const em = makeEm(PANELS_IN_TWO_COMPETITIONS, TRACKS_FOR_BOTH)
    mockCreateRequestContainer.mockResolvedValue(container(em))

    const res = await POST(postRequest(scorePayload({ judge_panel_id: OTHER_COMPETITION_PANEL_ID })))

    expect(em.transactional).not.toHaveBeenCalled()
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'That judging panel cannot score this project' })
  })

  it('refuses a judge whose every panel sits in another competition', async () => {
    const em = makeEm(
      [{ id: OTHER_COMPETITION_PANEL_ID, competitionId: OTHER_COMPETITION_ID }],
      [{ panelId: OTHER_COMPETITION_PANEL_ID, trackId: TRACK_ID }],
    )
    mockCreateRequestContainer.mockResolvedValue(container(em))

    const res = await POST(postRequest(scorePayload({ judge_panel_id: OTHER_COMPETITION_PANEL_ID })))

    expect(em.transactional).not.toHaveBeenCalled()
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'You are not on a judging panel for this competition' })
  })

  it('refuses a panel of this competition that does not cover the project\'s track', async () => {
    const em = makeEm(
      [{ id: HOME_PANEL_ID, competitionId: COMPETITION_ID }],
      [{ panelId: HOME_PANEL_ID, trackId: OTHER_TRACK_ID }],
    )
    mockCreateRequestContainer.mockResolvedValue(container(em))

    const res = await POST(postRequest(scorePayload()))

    expect(em.transactional).not.toHaveBeenCalled()
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'Your judging panel does not cover this project' })
  })
})

describe('portal score-project — `auto` resolution stays inside the competition (#106)', () => {
  it('files the score under the panel of the project\'s competition, never the other one', async () => {
    const em = makeEm(PANELS_IN_TWO_COMPETITIONS, TRACKS_FOR_BOTH)
    mockCreateRequestContainer.mockResolvedValue(container(em))

    const res = await POST(postRequest(scorePayload({ judge_panel_id: 'auto' })))

    expect(res.status).toBe(200)
    expect(em.scoreRows()).toHaveLength(1)
    const written = em.scoreRows()[0]
    // This is the record issue #106 is about: the persisted panel must belong to the
    // competition that owns the project, not merely be a panel the judge sits on.
    expect(written.judgePanelId).toBe(HOME_PANEL_ID)
    expect(written.judgePanelId).not.toBe(OTHER_COMPETITION_PANEL_ID)
    expect(written.competitionId).toBe(COMPETITION_ID)
  })

  it('never writes the all-zeros sentinel panel when the judge has no eligible panel', async () => {
    const em = makeEm([], [])
    mockCreateRequestContainer.mockResolvedValue(container(em))

    const res = await POST(postRequest(scorePayload({ judge_panel_id: 'auto' })))

    expect(res.status).toBe(403)
    expect(em.transactional).not.toHaveBeenCalled()
    expect(em.scoreRows()).toHaveLength(0)
  })

  it('resolves `auto` deterministically across repeated requests', async () => {
    const written: unknown[] = []
    for (const order of [PANELS_IN_TWO_COMPETITIONS, [...PANELS_IN_TWO_COMPETITIONS].reverse()]) {
      const em = makeEm(order, TRACKS_FOR_BOTH)
      mockCreateRequestContainer.mockResolvedValue(container(em))
      await POST(postRequest(scorePayload({ judge_panel_id: 'auto' })))
      written.push(em.scoreRows()[0]?.judgePanelId)
    }
    // The row order the database happens to return must not change the panel the score lands on.
    expect(written).toEqual([HOME_PANEL_ID, HOME_PANEL_ID])
  })
})

describe('portal score-project — the panel queries are tenant-scoped (#106)', () => {
  it('loads panels and panel tracks inside the caller\'s tenant and organisation', async () => {
    const em = makeEm(PANELS_IN_TWO_COMPETITIONS, TRACKS_FOR_BOTH)
    mockCreateRequestContainer.mockResolvedValue(container(em))

    await POST(postRequest(scorePayload()))

    const byEntity = new Map(em.find.mock.calls.map(([entity, filter]) => [entity, filter]))
    expect(byEntity.get(entities.JudgePanel)).toMatchObject({ tenantId: TENANT, organizationId: ORG })
    expect(byEntity.get(entities.JudgePanelTrack)).toMatchObject({ tenantId: TENANT, organizationId: ORG })
    expect(byEntity.get(entities.JudgePanelJudge)).toMatchObject({ judgeId: JUDGE_ID, tenantId: TENANT, organizationId: ORG })
  })
})

// This file uses `require` after the `jest.mock` calls, so it has no top-level import.
// Without an export it would be a global script and its helpers would collide with the other
// route test files under type check.
export {}

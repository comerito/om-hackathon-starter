/**
 * Route-handler regression tests for issue #116 — portal scoring authorization.
 *
 * ## Why these live at the route and not next to the helper
 *
 * `judging/lib/__tests__/portalAuth.test.ts` and `.../panelScope.test.ts` prove the two helpers
 * decide correctly. Neither proves the route *calls* them: with both `requirePortalFeatures`
 * calls deleted from `api/portal/score-project/route.ts` the whole suite still passed, which is
 * exactly the hole #116 reported. These tests drive the exported `GET` / `POST` handlers, so the
 * assertion is on the response a portal client would actually receive.
 *
 * The feature lists are taken from the module's real `setup.ts` rather than written out here —
 * a gate that the `participant` role happens to already satisfy would then fail the test instead
 * of passing it.
 */

import { matchesEntity } from '@open-mercato/shared/lib/crud/mutation-guard-registry'
import setup from '../../../../setup'
import { PORTAL_SCORE_FEATURE } from '../../../../lib/portalAuth'
import { SCORE_RESOURCE_KIND } from '../../../../lib/resourceKinds'
import { MemoryVoteStore } from '../../../../lib/__tests__/memoryVoteStore'

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
// The entity modules only serve as MikroORM class tokens here; the fake `em` dispatches on them.
jest.mock('../../../../data/entities', () => ({
  ProjectScore: class ProjectScore {},
  CriterionScore: class CriterionScore {},
  JudgingCriterion: class JudgingCriterion {},
  JudgePanel: class JudgePanel {},
  JudgePanelJudge: class JudgePanelJudge {},
  JudgePanelTrack: class JudgePanelTrack {},
}))
jest.mock('../../../../../projects/data/entities', () => ({ Project: class Project {} }))
// The transactional write goes through the vote-store port; the in-memory store stands in for
// Postgres (all-or-nothing, serialised). Its SQL is covered by `lib/__tests__/portalVoteStore.test.ts`.
let mockStore: MemoryVoteStore
jest.mock('../../../../lib/portalVoteStore', () => ({ createPortalVoteStore: () => mockStore }))

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { GET, POST } = require('../route') as typeof import('../route')
// eslint-disable-next-line @typescript-eslint/no-var-requires
const entities = require('../../../../data/entities') as {
  ProjectScore: unknown
  CriterionScore: unknown
  JudgingCriterion: unknown
  JudgePanel: unknown
  JudgePanelJudge: unknown
  JudgePanelTrack: unknown
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const projectEntities = require('../../../../../projects/data/entities') as { Project: unknown }
// eslint-disable-next-line @typescript-eslint/no-var-requires
const competitionEntities = require('../../../../../competitions/data/entities') as { Competition: unknown }

const TENANT = '00000000-0000-4000-8000-0000000000a1'
const ORG = '00000000-0000-4000-8000-0000000000b1'
const JUDGE_ID = '11111111-1111-4111-8111-111111111111'
const PROJECT_ID = '22222222-2222-4222-8222-222222222222'
const COMPETITION_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_COMPETITION_ID = '44444444-4444-4444-8444-444444444444'
const OWN_PANEL_ID = '55555555-5555-4555-8555-555555555555'
const FOREIGN_PANEL_ID = '66666666-6666-4666-8666-666666666666'
const TRACK_ID = '77777777-7777-4777-8777-777777777777'
const CRITERION_ID = '88888888-8888-4888-8888-888888888888'
const CRITERION_2_ID = '99999999-9999-4999-8999-999999999999'
const OTHER_TRACK_CRITERION_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'

const PARTICIPANT_FEATURES = setup.defaultCustomerRoleFeatures?.participant ?? []
const JUDGE_FEATURES = setup.defaultCustomerRoleFeatures?.judge ?? []

function auth(features: string[]) {
  return { sub: JUDGE_ID, tenantId: TENANT, orgId: ORG, resolvedFeatures: features }
}

type PanelRow = { id: string; competitionId: string }
type MembershipRow = { panelId: string }
type PanelTrackRow = { panelId: string; trackId: string }

type CriterionRow = { id: string; round: string; trackId: string | null; order: number; weight: number; maxScore: number }

/** Two global criteria (weights 0.6 / 0.4, 10 and 5 points) and one scoped to another track. */
const DEFAULT_CRITERIA: CriterionRow[] = [
  { id: CRITERION_ID, round: 'both', trackId: null, order: 1, weight: 0.6, maxScore: 10 },
  { id: CRITERION_2_ID, round: 'preliminary', trackId: null, order: 2, weight: 0.4, maxScore: 5 },
  { id: OTHER_TRACK_CRITERION_ID, round: 'both', trackId: '7c7c7c7c-7c7c-4c7c-8c7c-7c7c7c7c7c7c', order: 3, weight: 1, maxScore: 10 },
]

type EmOptions = {
  /** Panels the caller sits on, as `JudgePanel` rows. */
  panels?: PanelRow[]
  /**
   * `judging_panel_track` rows. A panel that covers no track can score nothing, so the default
   * gives every supplied panel the project's own track: these tests are about the *competition*
   * scope, and track coverage has its own suite in `route.panel-scope.test.ts`. Pass an explicit
   * value to exercise a panel that does not cover the project.
   */
  panelTracks?: PanelTrackRow[]
  project?: { id: string; competitionId: string; trackId: string } | null
  /** Stage the route sees before the guard (the store has its own, read under the lock). */
  stage?: string
  criteria?: CriterionRow[]
  /** Existing score row as the pre-guard lookup sees it (decides create vs update). */
  existingScore?: { id: string } | null
}

/**
 * Minimal `EntityManager` stand-in. It dispatches on the entity class the route passes, so a
 * route that skips a lookup (or performs one it should not have reached) is visible in the
 * recorded calls rather than silently absorbed.
 */
function makeEm(options: EmOptions = {}) {
  const panels = options.panels ?? []
  const panelTracks = options.panelTracks
    ?? panels.map((p): PanelTrackRow => ({ panelId: p.id, trackId: TRACK_ID }))
  const project = options.project === undefined
    ? { id: PROJECT_ID, competitionId: COMPETITION_ID, trackId: TRACK_ID }
    : options.project
  const findOne = jest.fn(async (entity: unknown) => {
    if (entity === projectEntities.Project) return project
    if (entity === competitionEntities.Competition) return { id: COMPETITION_ID, stage: options.stage ?? 'judging' }
    if (entity === entities.ProjectScore) return options.existingScore ?? null
    return null
  })
  const find = jest.fn(async (entity: unknown): Promise<unknown[]> => {
    if (entity === entities.JudgePanelJudge) {
      return panels.map((p): MembershipRow => ({ panelId: p.id }))
    }
    if (entity === entities.JudgePanel) return panels
    if (entity === entities.JudgePanelTrack) return panelTracks
    if (entity === entities.JudgingCriterion) return options.criteria ?? DEFAULT_CRITERIA
    return []
  })
  return { findOne, find }
}

const mockEmit = jest.fn(async () => undefined)

function container(em: unknown) {
  return {
    resolve: (key: string) => {
      if (key === 'em') return em
      if (key === 'eventBus') return { emit: mockEmit }
      return undefined
    },
  }
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
    criterion_scores: [{ criterion_id: CRITERION_ID, stars: 5 }],
    ...overrides,
  }
}

beforeEach(() => {
  jest.clearAllMocks()
  mockStore = new MemoryVoteStore()
  mockRunRouteMutationGuards.mockResolvedValue({
    ok: true,
    modifiedPayload: null,
    runAfterSuccess: jest.fn(async () => undefined),
  })
})

describe('portal score-project — the feature gate (#116)', () => {
  it('the participant role does not carry the scoring feature (guards against a vacuous gate)', () => {
    expect(JUDGE_FEATURES).toContain(PORTAL_SCORE_FEATURE)
    expect(PARTICIPANT_FEATURES).not.toContain(PORTAL_SCORE_FEATURE)
    expect(PARTICIPANT_FEATURES).not.toContain('*')
  })

  it('POST answers 403 for a participant and never resolves the container', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(PARTICIPANT_FEATURES))
    mockCreateRequestContainer.mockRejectedValue(new Error('container must not be resolved for a forbidden caller'))

    const res = await POST(postRequest(scorePayload()))

    // Asserted before the status: with the gate deleted this is the assertion that fails, and it
    // names the actual defect — an unauthorised caller reaching the data layer.
    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
    expect(mockRunRouteMutationGuards).not.toHaveBeenCalled()
    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({
      error: 'Forbidden',
      requiredFeatures: [PORTAL_SCORE_FEATURE],
    })
  })

  it('GET answers 403 for a participant and leaks no criteria or score', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(PARTICIPANT_FEATURES))
    mockCreateRequestContainer.mockRejectedValue(new Error('container must not be resolved for a forbidden caller'))

    const res = await GET(new Request(
      `http://localhost/api/judging/portal/score-project?project_id=${PROJECT_ID}&competition_id=${COMPETITION_ID}`,
    ))

    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body).toEqual({ error: 'Forbidden', requiredFeatures: [PORTAL_SCORE_FEATURE] })
    expect(body.criteria).toBeUndefined()
    expect(body.score).toBeUndefined()
  })

  it('POST answers 401 when there is no portal session', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(null)
    mockCreateRequestContainer.mockRejectedValue(new Error('container must not be resolved for an anonymous caller'))

    const res = await POST(postRequest(scorePayload()))

    expect(res.status).toBe(401)
    expect(mockCreateRequestContainer).not.toHaveBeenCalled()
  })
})

describe('portal score-project — the panel gate (#116)', () => {
  it('refuses a judge who sits on no panel of the project\'s competition, and writes nothing', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    const em = makeEm({ panels: [{ id: FOREIGN_PANEL_ID, competitionId: OTHER_COMPETITION_ID }] })
    mockCreateRequestContainer.mockResolvedValue(container(em))

    const res = await POST(postRequest(scorePayload()))

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body).toEqual({ error: 'You are not on a judging panel for this competition' })
    expect(body.score_id).toBeUndefined()
    expect(mockStore.calls).toEqual([])
  })

  it('refuses a judge who names a panel outside the project\'s competition', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    const em = makeEm({
      panels: [
        { id: OWN_PANEL_ID, competitionId: COMPETITION_ID },
        { id: FOREIGN_PANEL_ID, competitionId: OTHER_COMPETITION_ID },
      ],
    })
    mockCreateRequestContainer.mockResolvedValue(container(em))

    const res = await POST(postRequest(scorePayload({ judge_panel_id: FOREIGN_PANEL_ID })))

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'That judging panel cannot score this project' })
    expect(mockStore.calls).toEqual([])
  })

  it('reports an unknown project as 404 without disclosing anything', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    const em = makeEm({ project: null })
    mockCreateRequestContainer.mockResolvedValue(container(em))

    const res = await POST(postRequest(scorePayload()))

    expect(res.status).toBe(404)
    await expect(res.json()).resolves.toEqual({ error: 'Project not found' })
    expect(mockStore.calls).toEqual([])
  })

  it('lets an eligible judge through — so the refusals above are not vacuous', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    const em = makeEm({ panels: [{ id: OWN_PANEL_ID, competitionId: COMPETITION_ID }] })
    mockCreateRequestContainer.mockResolvedValue(container(em))

    const res = await POST(postRequest(scorePayload()))

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toMatchObject({ ok: true, score_id: mockStore.onlyScore()!.id })
    expect(mockStore.commits).toBe(1)
  })
})

describe('portal score-project — the mutation-guard registry (#116)', () => {
  it('reports a resource kind a `judging.*` wildcard guard actually matches', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    const em = makeEm({ panels: [{ id: OWN_PANEL_ID, competitionId: COMPETITION_ID }] })
    mockCreateRequestContainer.mockResolvedValue(container(em))

    await POST(postRequest(scorePayload()))

    expect(mockRunRouteMutationGuards).toHaveBeenCalledTimes(1)
    const passed = mockRunRouteMutationGuards.mock.calls[0][0] as {
      input: { resourceKind: string; operation: string }
      auth: { userId: string; userFeatures: string[] }
    }
    expect(passed.input.resourceKind).toBe(SCORE_RESOURCE_KIND)
    expect(matchesEntity('judging.*', passed.input.resourceKind)).toBe(true)
    expect(passed.input.operation).toBe('create')
    expect(passed.auth.userFeatures).toEqual(JUDGE_FEATURES)
  })

  it('returns the guard\'s refusal and writes nothing when a guard blocks', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    const em = makeEm({ panels: [{ id: OWN_PANEL_ID, competitionId: COMPETITION_ID }] })
    mockCreateRequestContainer.mockResolvedValue(container(em))
    mockRunRouteMutationGuards.mockResolvedValue({
      ok: false,
      response: new Response(JSON.stringify({ error: 'Scoring is closed' }), { status: 403 }),
    })

    const res = await POST(postRequest(scorePayload()))

    expect(res.status).toBe(403)
    await expect(res.json()).resolves.toEqual({ error: 'Scoring is closed' })
    expect(mockStore.calls).toEqual([])
  })
})

describe('portal score-project — per-click vote save (SPEC-007 step 7)', () => {
  const SCORE_KEY = { projectId: PROJECT_ID, judgeId: JUDGE_ID, round: 'preliminary', tenantId: TENANT, organizationId: ORG }
  const EARLIER = new Date('2026-09-01T09:00:00Z')

  function eligibleEm(options: EmOptions = {}) {
    return makeEm({ panels: [{ id: OWN_PANEL_ID, competitionId: COMPETITION_ID }], ...options })
  }

  async function post(body: Record<string, unknown>, options: EmOptions = {}) {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    const em = eligibleEm(options)
    mockCreateRequestContainer.mockResolvedValue(container(em))
    const res = await POST(postRequest(body))
    return { res, body: await res.json() as Record<string, unknown>, em }
  }

  function emittedIds(): string[] {
    return (mockEmit.mock.calls as unknown as Array<[string, Record<string, unknown>]>).map(([id]) => id)
  }

  it('recomputes a partial save from every persisted row, not just the one sent', async () => {
    mockStore.seed(SCORE_KEY, [{ criterionId: CRITERION_ID, score: 8, scale: 10, note: null }])

    const { res, body } = await post(scorePayload({ criterion_scores: [{ criterion_id: CRITERION_2_ID, stars: 6 }] }))

    expect(res.status).toBe(200)
    // 8★ · 0.6 + 6★ · 0.4 = 7.2 on 0–10 → 72 on 0–100
    expect(body).toEqual({
      ok: true,
      score_id: mockStore.onlyScore()!.id,
      rated_count: 2,
      criteria_count: 2,
      is_voted: true,
      weighted_average: 7.2,
      total_score: 72,
    })
    expect(mockStore.rowsOf(mockStore.onlyScore()!.id).map(r => [r.criterionId, r.score, r.scale])).toEqual([
      [CRITERION_ID, 8, 10],
      [CRITERION_2_ID, 6, 10],
    ])
  })

  it('reports an in-progress vote with its partial average and emits nothing', async () => {
    const { res, body } = await post(scorePayload({ criterion_scores: [{ criterion_id: CRITERION_ID, stars: 7 }] }))

    expect(res.status).toBe(200)
    expect(body).toMatchObject({ rated_count: 1, criteria_count: 2, is_voted: false, weighted_average: 7, total_score: 70 })
    expect(mockStore.onlyScore()).toMatchObject({ isSubmitted: false, submittedAt: null })
    expect(mockEmit).not.toHaveBeenCalled()
  })

  it('marks the vote submitted on the voted transition and emits `judging.score.submitted` once', async () => {
    mockStore.seed(SCORE_KEY, [{ criterionId: CRITERION_ID, score: 9, scale: 10, note: null }])

    const { body } = await post(scorePayload({ criterion_scores: [{ criterion_id: CRITERION_2_ID, stars: 4 }] }))

    expect(body.is_voted).toBe(true)
    const score = mockStore.onlyScore()!
    expect(score.isSubmitted).toBe(true)
    expect(score.submittedAt).toBeInstanceOf(Date)
    expect(emittedIds()).toEqual(['judging.score.submitted'])
    expect(mockEmit.mock.calls[0]).toEqual(['judging.score.submitted', expect.objectContaining({
      projectScoreId: score.id, projectId: PROJECT_ID, judgeId: JUDGE_ID, round: 'preliminary',
      totalScore: 70, competitionId: COMPETITION_ID, tenantId: TENANT, organizationId: ORG,
    })])
  })

  it('keeps a vote voted when a star is changed afterwards, without a new event or timestamp', async () => {
    mockStore.seed({ ...SCORE_KEY, isSubmitted: true, submittedAt: EARLIER, totalScore: 72 }, [
      { criterionId: CRITERION_ID, score: 8, scale: 10, note: null },
      { criterionId: CRITERION_2_ID, score: 6, scale: 10, note: null },
    ])

    const { body } = await post(scorePayload({ criterion_scores: [{ criterion_id: CRITERION_ID, stars: 3 }] }), {
      existingScore: { id: 'existing' },
    })

    // 3 · 0.6 + 6 · 0.4 = 4.2
    expect(body).toMatchObject({ is_voted: true, weighted_average: 4.2, total_score: 42 })
    expect(mockStore.onlyScore()).toMatchObject({ isSubmitted: true, submittedAt: EARLIER, totalScore: 42 })
    expect(mockEmit).not.toHaveBeenCalled()
  })

  it('answers 409 before the guard when results are already published, and writes nothing', async () => {
    const { res, body } = await post(scorePayload(), { stage: 'finished' })

    expect(res.status).toBe(409)
    expect(body).toEqual({ error: 'Voting is closed' })
    expect(mockRunRouteMutationGuards).not.toHaveBeenCalled()
    expect(mockStore.calls).toEqual([])
  })

  it('answers 409 when the stage moves to finished while the row is locked, rolling the save back', async () => {
    mockStore.stage = 'finished'
    const runAfterSuccess = jest.fn(async () => undefined)
    mockRunRouteMutationGuards.mockResolvedValue({ ok: true, modifiedPayload: null, runAfterSuccess })

    const { res, body } = await post(scorePayload())

    expect(res.status).toBe(409)
    expect(body).toEqual({ error: 'Voting is closed' })
    expect(mockStore.rollbacks).toBe(1)
    expect(mockStore.scores.size).toBe(0)
    expect(mockStore.calls).not.toContain('upsertCriterionScores')
    expect(runAfterSuccess).not.toHaveBeenCalled()
    expect(mockEmit).not.toHaveBeenCalled()
  })

  it('answers 422 for a criterion that does not apply to the project, and writes nothing', async () => {
    const { res, body } = await post(scorePayload({
      criterion_scores: [{ criterion_id: CRITERION_ID, stars: 7 }, { criterion_id: OTHER_TRACK_CRITERION_ID, stars: 7 }],
    }))

    expect(res.status).toBe(422)
    expect(body).toEqual({ error: 'Criterion does not apply to this project', criterion_ids: [OTHER_TRACK_CRITERION_ID] })
    expect(mockStore.calls).toEqual([])
  })

  it.each([
    ['stars above 10', { criterion_scores: [{ criterion_id: CRITERION_ID, stars: 11 }] }],
    ['stars below 1', { criterion_scores: [{ criterion_id: CRITERION_ID, stars: 0 }] }],
    ['fractional stars', { criterion_scores: [{ criterion_id: CRITERION_ID, stars: 6.5 }] }],
    ['a non-boolean recusal', { conflict_of_interest: 'yes' }],
  ])('answers 422 for %s', async (_label, overrides) => {
    const { res } = await post(scorePayload(overrides))
    expect(res.status).toBe(422)
    expect(mockStore.calls).toEqual([])
  })

  it('keeps a recusal across a later star save that omits `conflict_of_interest`', async () => {
    mockStore.seed({ ...SCORE_KEY, isSubmitted: true, submittedAt: EARLIER, totalScore: 72 }, [
      { criterionId: CRITERION_ID, score: 8, scale: 10, note: null },
      { criterionId: CRITERION_2_ID, score: 6, scale: 10, note: null },
    ])

    const recuse = await post(scorePayload({ criterion_scores: undefined, conflict_of_interest: true }), { existingScore: { id: 'x' } })
    expect(recuse.body).toMatchObject({ is_voted: false, weighted_average: null, total_score: null, rated_count: 2 })
    expect(mockStore.onlyScore()).toMatchObject({ conflictOfInterest: true, isSubmitted: false, totalScore: null })
    expect(emittedIds()).toEqual(['judging.score.updated'])

    mockEmit.mockClear()
    const starClick = await post(scorePayload({ criterion_scores: [{ criterion_id: CRITERION_ID, stars: 10 }] }), { existingScore: { id: 'x' } })
    expect(starClick.body).toMatchObject({ is_voted: false, total_score: null })
    expect(mockStore.onlyScore()).toMatchObject({ conflictOfInterest: true, isSubmitted: false, totalScore: null })
    expect(mockEmit).not.toHaveBeenCalled()
  })

  it('restores the total and the voted state when the recusal is undone', async () => {
    mockStore.seed({ ...SCORE_KEY, conflictOfInterest: true, isSubmitted: false, submittedAt: EARLIER, totalScore: null }, [
      { criterionId: CRITERION_ID, score: 8, scale: 10, note: null },
      { criterionId: CRITERION_2_ID, score: 6, scale: 10, note: null },
    ])

    const { body } = await post(scorePayload({ criterion_scores: undefined, conflict_of_interest: false }), { existingScore: { id: 'x' } })

    expect(body).toMatchObject({ is_voted: true, weighted_average: 7.2, total_score: 72 })
    expect(mockStore.onlyScore()).toMatchObject({ conflictOfInterest: false, isSubmitted: true, totalScore: 72, submittedAt: EARLIER })
    expect(emittedIds()).toEqual(['judging.score.submitted'])
  })

  it('keeps a submitted legacy 0 rated, so saving another criterion does not drop the vote', async () => {
    mockStore.seed({ ...SCORE_KEY, isSubmitted: true, submittedAt: EARLIER, totalScore: 24 }, [
      { criterionId: CRITERION_ID, score: 0, scale: null, note: null },
      { criterionId: CRITERION_2_ID, score: 3, scale: null, note: null },
    ])

    const { body } = await post(scorePayload({ criterion_scores: [{ criterion_id: CRITERION_2_ID, stars: 10 }] }), { existingScore: { id: 'x' } })

    // Legacy 0/10 → 0 · 0.6 + 10★ · 0.4 = 4.0
    expect(body).toMatchObject({ rated_count: 2, is_voted: true, weighted_average: 4, total_score: 40 })
    expect(mockEmit).not.toHaveBeenCalled()
  })

  it('treats an unsubmitted legacy 0 as not rated', async () => {
    mockStore.seed({ ...SCORE_KEY, isSubmitted: false }, [
      { criterionId: CRITERION_ID, score: 0, scale: null, note: null },
    ])

    const { body } = await post(scorePayload({ criterion_scores: [{ criterion_id: CRITERION_2_ID, stars: 10 }] }), { existingScore: { id: 'x' } })

    expect(body).toMatchObject({ rated_count: 1, is_voted: false })
  })

  it('writes only the fields sent: omitted comment is kept, null clears private notes', async () => {
    mockStore.seed({ ...SCORE_KEY, comment: 'Keep me', privateNotes: 'Secret' })

    await post(scorePayload({ criterion_scores: undefined, private_notes: null }), { existingScore: { id: 'x' } })

    expect(mockStore.onlyScore()).toMatchObject({ comment: 'Keep me', privateNotes: null, conflictOfInterest: false })
  })

  it('reports the guard operation as update for an existing score and runs afterSuccess after the commit', async () => {
    const runAfterSuccess = jest.fn(async () => {
      expect(mockStore.commits).toBe(1)
    })
    mockRunRouteMutationGuards.mockResolvedValue({ ok: true, modifiedPayload: null, runAfterSuccess })

    const { res } = await post(scorePayload(), { existingScore: { id: 'existing-score' } })

    expect(res.status).toBe(200)
    const passed = mockRunRouteMutationGuards.mock.calls[0][0] as { input: { operation: string; resourceId: string } }
    expect(passed.input).toMatchObject({ operation: 'update', resourceId: 'existing-score' })
    expect(runAfterSuccess).toHaveBeenCalledTimes(1)
  })

  it('re-validates and applies a payload rewritten by a guard', async () => {
    mockRunRouteMutationGuards.mockResolvedValue({
      ok: true,
      modifiedPayload: { comment: 'Rewritten by guard' },
      runAfterSuccess: jest.fn(async () => undefined),
    })

    const { res } = await post(scorePayload({ comment: 'Original' }))

    expect(res.status).toBe(200)
    expect(mockStore.onlyScore()?.comment).toBe('Rewritten by guard')
  })

  it('refuses a guard rewrite that breaks the schema', async () => {
    mockRunRouteMutationGuards.mockResolvedValue({
      ok: true,
      modifiedPayload: { criterion_scores: [{ criterion_id: CRITERION_ID, stars: 42 }] },
      runAfterSuccess: jest.fn(async () => undefined),
    })

    const { res } = await post(scorePayload())

    expect(res.status).toBe(422)
    expect(mockStore.calls).toEqual([])
  })

  it('retries the transaction once when a unique violation escapes', async () => {
    mockStore.uniqueViolations = 1

    const { res, body } = await post(scorePayload())

    expect(res.status).toBe(200)
    expect(body.rated_count).toBe(1)
    expect(mockStore.resets).toBe(1)
    expect(mockStore.commits).toBe(1)
  })

  it('answers 500 when the retry hits a unique violation again', async () => {
    mockStore.uniqueViolations = 2
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    const { res } = await post(scorePayload())

    expect(res.status).toBe(500)
    expect(mockStore.commits).toBe(0)
    errorSpy.mockRestore()
  })

  it('still answers 200 when the event bus fails after commit', async () => {
    mockStore.seed(SCORE_KEY, [{ criterionId: CRITERION_ID, score: 9, scale: 10, note: null }])
    mockEmit.mockRejectedValueOnce(new Error('bus down'))
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined)

    const { res } = await post(scorePayload({ criterion_scores: [{ criterion_id: CRITERION_2_ID, stars: 4 }] }))

    expect(res.status).toBe(200)
    expect(mockStore.onlyScore()?.isSubmitted).toBe(true)
    expect(errorSpy).toHaveBeenCalled()
    errorSpy.mockRestore()
  })
})

describe('portal score-project — GET for the voting page (SPEC-007 step 7)', () => {
  it('returns applicable criteria, `scale` on criterion scores and `voting_open`', async () => {
    mockGetCustomerAuthFromRequest.mockResolvedValue(auth(JUDGE_FEATURES))
    const em = makeEm({ stage: 'finished' })
    em.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === projectEntities.Project) return { id: PROJECT_ID, competitionId: COMPETITION_ID, trackId: TRACK_ID }
      if (entity === competitionEntities.Competition) return { id: COMPETITION_ID, stage: 'finished' }
      if (entity === entities.ProjectScore) {
        return {
          id: 'score-1', totalScore: 72, comment: null, privateNotes: null, conflictOfInterest: false,
          isSubmitted: true, submittedAt: new Date('2026-09-01T09:00:00Z'),
        }
      }
      return null
    })
    const baseFind = em.find.getMockImplementation()!
    em.find.mockImplementation(async (entity: unknown) => {
      if (entity === entities.CriterionScore) {
        return [
          { criterionId: CRITERION_ID, score: 8, scale: 10, note: 'Solid' },
          { criterionId: CRITERION_2_ID, score: 3, scale: null, note: null },
        ]
      }
      return baseFind(entity)
    })
    mockCreateRequestContainer.mockResolvedValue(container(em))

    const res = await GET(new Request(
      `http://localhost/api/judging/portal/score-project?project_id=${PROJECT_ID}&competition_id=${COMPETITION_ID}`,
    ))

    expect(res.status).toBe(200)
    const body = await res.json() as {
      criteria: Array<{ id: string }>
      score: { criterion_scores: unknown[]; submitted_at: string | null }
      voting_open: boolean
    }
    expect(body.voting_open).toBe(false)
    expect(body.criteria.map(c => c.id)).toEqual([CRITERION_ID, CRITERION_2_ID])
    expect(body.score.submitted_at).toBe('2026-09-01T09:00:00.000Z')
    expect(body.score.criterion_scores).toEqual([
      { criterion_id: CRITERION_ID, score: 8, scale: 10, note: 'Solid' },
      { criterion_id: CRITERION_2_ID, score: 3, scale: null, note: null },
    ])
    const csCall = em.find.mock.calls.find(([entity]) => entity === entities.CriterionScore) as unknown as [unknown, Record<string, unknown>]
    expect(csCall[1]).toMatchObject({ projectScoreId: 'score-1', tenantId: TENANT, organizationId: ORG })
  })
})
